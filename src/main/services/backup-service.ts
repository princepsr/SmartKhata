/**
 * Backup Service
 *
 * Handles creation and restoration of database backups in a structured ZIP format.
 * Format: backup_YYYYMMDD_HHMM.zip
 * Contents:
 * - data.db: Main SQLite database
 * - settings.json: Application settings export
 * - meta.json: Backup metadata (version, timestamp, etc.)
 */
import fs from 'fs';
import path from 'path';
import { app, dialog } from 'electron';
import AdmZip from 'adm-zip';
import { databaseManager } from '@main/database';
import { migrationRunner } from '@main/database/migrations';
import { SettingsService } from './settings-service';
import { logger } from '@main/utils/logger';
import { BackupMeta } from '@shared/types/ipc';

const backupLogger = logger.forModule('BACKUP');

class BackupService {
  private _settingsService: SettingsService | null = null;

  constructor() {}

  private get settingsService(): SettingsService {
    return SettingsService.getInstance();
  }

  /**
   * Helper to execute a synchronous file operation with retries.
   * Useful for Windows where file locks might not be released immediately.
   */
  private executeWithRetry(operation: () => void, maxRetries = 8, delayMs = 300): void {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        operation();
        return;
      } catch (err) {
        lastError = err;
        // Only retry on permission (EPERM) or busy (EBUSY/ENOLCK) errors
        const isLockError =
          err instanceof Error &&
          (err.message.includes('EPERM') ||
            err.message.includes('EBUSY') ||
            err.message.includes('resource busy'));

        if (isLockError && i < maxRetries - 1) {
          const start = Date.now();
          while (Date.now() - start < delayMs) {
            /* wait sync */
          }
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  /**
   * Opens a folder selection dialog and returns the selected path
   */
  public async selectFolderForBackup(defaultPath?: string): Promise<string | null> {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Select Backup Location',
      defaultPath,
      properties: ['openDirectory'],
    });

    if (canceled || filePaths.length === 0) {
      return null;
    }

    return filePaths[0];
  }

  /**
   * Opens a file selection dialog for backup ZIPs and returns path + metadata
   */
  public async selectBackupFile(
    defaultPath?: string
  ): Promise<{ path: string; meta: BackupMeta } | null> {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Restore Database from Backup',
      defaultPath,
      properties: ['openFile'],
      filters: [{ name: 'SmartKhata Backup', extensions: ['zip'] }],
    });

    if (canceled || filePaths.length === 0) {
      return null;
    }

    const filePath = filePaths[0];
    const meta = this.getBackupMetadata(filePath);

    return { path: filePath, meta };
  }

  /**
   * Create a structured ZIP backup of the current database and settings.
   * If destinationPath is a directory, it generates a timestamped filename with overwrite protection.
   *
   * @param targetPath - Path to save the ZIP or directory to save into
   */
  public async createBackup(targetPath: string): Promise<string> {
    // Ensure target directory exists
    const targetDir =
      fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()
        ? targetPath
        : path.dirname(targetPath);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    let finalPath = targetPath;

    // If target is a directory, generate filename
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const timestamp = `${year}${month}${day}_${hours}${mins}`;

      let fileName = `backup_${timestamp}.zip`;
      finalPath = path.join(targetPath, fileName);

      // Prevent silent overwrite
      let counter = 1;
      while (fs.existsSync(finalPath)) {
        fileName = `backup_${timestamp}_${counter}.zip`;
        finalPath = path.join(targetPath, fileName);
        counter++;
      }
    }

    const tempDbPath = path.join(app.getPath('temp'), `smartkhata_temp_${Date.now()}.db`);

    try {
      backupLogger.info('Starting structured backup...', { destinationPath: finalPath });

      // 1. Backup SQLite DB to a temporary file
      const db = databaseManager.getDatabase();
      await db.backup(tempDbPath);

      // 2. Prepare metadata and settings
      const settings = this.settingsService.getConfig();
      const meta = {
        appName: 'SmartKhata',
        version: app.getVersion(),
        timestamp: new Date().toISOString(),
        schemaVersion: migrationRunner.getCurrentVersion(),
        shopName: this.settingsService.getConfig().shopName || 'SmartKhata Shop',
      };

      // 3. Create ZIP archive
      const zip = new AdmZip();

      // Add files to ZIP
      zip.addLocalFile(tempDbPath, '', 'data.db');
      zip.addFile('settings.json', Buffer.from(JSON.stringify(settings, null, 2), 'utf8'));
      zip.addFile('meta.json', Buffer.from(JSON.stringify(meta, null, 2), 'utf8'));

      // 4. Save ZIP to destination
      zip.writeZip(finalPath);

      backupLogger.info('Structured backup completed successfully', { destinationPath: finalPath });
      return finalPath;
    } catch (error) {
      backupLogger.error('Database backup failed', error);

      let userMessage = 'Backup failed: An unexpected error occurred.';
      if (error instanceof Error) {
        if (error.message.includes('EPERM') || error.message.includes('permission denied')) {
          userMessage =
            "SmartKhata doesn't have permission to save the backup to this location. Please try selecting a different folder.";
        } else if (error.message.includes('ENOSPC')) {
          userMessage =
            'Not enough space on your computer to save the backup. Please free up some disk space and try again.';
        } else {
          userMessage = `Backup failed: ${error.message}`;
        }
      }
      throw new Error(userMessage);
    } finally {
      // Cleanup temp DB file
      if (fs.existsSync(tempDbPath)) {
        try {
          fs.unlinkSync(tempDbPath);
        } catch {
          backupLogger.warn('Failed to cleanup temp database file', { path: tempDbPath });
        }
      }
    }
  }

  /**
   * Restore database from a structured ZIP backup
   * Includes safety backup and atomic swap
   *
   * @param sourcePath - Path to the ZIP backup file to restore from
   */
  public async restoreFromBackup(sourcePath: string): Promise<void> {
    const activeDbPath = databaseManager.getDatabasePath();
    const safetyBackupPath = `${activeDbPath}.safety.${Date.now()}.bak`;
    const tempExtractDir = path.join(app.getPath('temp'), `smartkhata_restore_${Date.now()}`);
    const extractedDbPath = path.join(tempExtractDir, 'data.db');
    let didMoveToSafety = false;

    try {
      backupLogger.info('Starting database restore from ZIP...', { sourcePath });

      // 0. Validate Backup First (Fail Fast)
      await this.validateBackup(sourcePath);

      // 1. Extract ZIP to temporary location
      if (!fs.existsSync(tempExtractDir)) {
        fs.mkdirSync(tempExtractDir, { recursive: true });
      }

      // Read ZIP into buffer first to avoid file descriptor locking issues on Windows
      backupLogger.debug('Reading backup file into memory pool');
      const zipBuffer = fs.readFileSync(sourcePath);
      const zip = new AdmZip(zipBuffer);
      zip.extractAllTo(tempExtractDir, true);

      if (!fs.existsSync(extractedDbPath)) {
        throw new Error(
          'The selected file is not a valid SmartKhata backup (missing database file).'
        );
      }

      // 1.1 Restore Settings (Non-atomic, but safe as they are just a JSON file)
      const extractedSettingsPath = path.join(tempExtractDir, 'settings.json');
      if (fs.existsSync(extractedSettingsPath)) {
        try {
          backupLogger.debug('Restoring application settings');
          const settingsContent = fs.readFileSync(extractedSettingsPath, 'utf8');
          const settings = JSON.parse(settingsContent);
          this.settingsService.updateConfig(settings);
        } catch (settingsError) {
          backupLogger.warn('Failed to restore settings, continuing with database restore', {
            settingsError,
          });
        }
      }

      // 2. Atomic Restore Process

      // Step A: Close current connection
      backupLogger.debug('Closing active database connection');
      databaseManager.close();

      // Settle period to allow Windows to release file descriptors
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Step B: Move current database to safety backup (Atomic Move)
      backupLogger.debug('Moving active database to safety backup', { safetyBackupPath });

      const walFile = `${activeDbPath}-wal`;
      const shmFile = `${activeDbPath}-shm`;

      if (fs.existsSync(activeDbPath)) {
        try {
          // Cleanup WAL/SHM *before* moving the main file to prevent lock interference
          this.executeWithRetry(() => {
            if (fs.existsSync(walFile)) {
              fs.unlinkSync(walFile);
            }
            if (fs.existsSync(shmFile)) {
              fs.unlinkSync(shmFile);
            }
          });

          this.executeWithRetry(() => {
            fs.renameSync(activeDbPath, safetyBackupPath);
          });
          didMoveToSafety = true;
        } catch (renameError) {
          backupLogger.error('Failed to move active DB to safety', renameError);
          throw new Error(
            'The database file is currently in use by another process. Please close any other tools touching the database and try again.'
          );
        }
      }

      // Step C: Perform the restore (copy extracted data.db to active location)
      backupLogger.debug('Copying backup data to active database location');
      try {
        this.executeWithRetry(() => {
          fs.copyFileSync(extractedDbPath, activeDbPath);
        });
      } catch (copyError) {
        backupLogger.error('Failed to copy extracted DB to active', copyError);
        throw new Error(
          'Could not overwrite the existing database. This usually happens if the file is locked or the disk is full.'
        );
      }

      // Step D: Clean up WAL/SHM files to prevent corruption from mixed states (Safety check)
      try {
        if (fs.existsSync(walFile)) {
          fs.unlinkSync(walFile);
        }
        if (fs.existsSync(shmFile)) {
          fs.unlinkSync(shmFile);
        }
      } catch {
        /* ignore, already attempted in Step B */
      }

      // Step E: Re-initialize to verify the new file is loadable
      backupLogger.debug('Re-initializing database');
      databaseManager.initialize();

      // Step E.1: Run migrations (CRITICAL for older backups)
      backupLogger.info('Running pending migrations on restored database');
      await migrationRunner.runPendingMigrations();

      // Step F: Integrity Check
      backupLogger.debug('Running PRAGMA integrity_check');
      const db = databaseManager.getDatabase();
      const integrity = db.pragma('integrity_check') as [{ integrity_check: string }];

      if (integrity[0].integrity_check !== 'ok') {
        throw new Error(
          `The restored database appears to be corrupted: ${integrity[0].integrity_check}`
        );
      }

      backupLogger.info('Database restored and verified successfully');

      // Success! Clean up safety backup
      if (fs.existsSync(safetyBackupPath)) {
        fs.unlinkSync(safetyBackupPath);
      }
    } catch (error) {
      backupLogger.error('Database restore failed', error);

      // ROLLBACK ATTEMPT
      try {
        // Ensure DB is closed before touching files
        try {
          databaseManager.close();
        } catch {
          /* ignore if already closed */
        }

        // Only cleanup and restore if we actually moved the original DB
        if (didMoveToSafety) {
          // Remove the partial/corrupt restored file
          if (fs.existsSync(activeDbPath)) {
            fs.unlinkSync(activeDbPath);
          }

          // Restore safety backup
          if (fs.existsSync(safetyBackupPath)) {
            backupLogger.warn('Rolling back to safety backup...', { safetyBackupPath });
            fs.renameSync(safetyBackupPath, activeDbPath);
          } else {
            backupLogger.error('CRITICAL: Safety backup missing, cannot roll back');
          }
        }

        // Re-initialize (either the restored original or the untouched original)
        databaseManager.initialize();
        if (didMoveToSafety) {
          backupLogger.info('Rollback to safety backup successful');
        }
      } catch (rollbackError) {
        backupLogger.error('CRITICAL: Rollback failed', rollbackError);
      }

      throw new Error(
        error instanceof Error ? error.message : 'Restore failed: An unexpected error occurred.'
      );
    } finally {
      // Cleanup temp extraction directory
      if (fs.existsSync(tempExtractDir)) {
        try {
          fs.rmSync(tempExtractDir, { recursive: true, force: true });
        } catch {
          backupLogger.warn('Failed to cleanup temporary extraction directory', {
            path: tempExtractDir,
          });
        }
      }

      // Final safety net: Ensure DB is initialized if we are not throwing out (should have been handled by rollback)
      // But if rollback failed, we might be in a bad state.
      if (!databaseManager.isReady()) {
        try {
          databaseManager.initialize();
        } catch {
          backupLogger.error('System left in uninitialized state after restore failure');
        }
      }
    }
  }

  /**
   * Validate a backup file before attempting restore
   * Throws descriptive errors if validation fails
   */
  public async validateBackup(sourcePath: string): Promise<void> {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(
        'The backup file could not be found. Please check if it was moved or deleted.'
      );
    }

    let zip: AdmZip;
    try {
      // Use buffer to avoid handle locking
      const buffer = fs.readFileSync(sourcePath);
      zip = new AdmZip(buffer);
    } catch (err) {
      backupLogger.error('Validation read failed', { err, path: sourcePath });
      throw new Error(
        'Could not read the backup file. It might be in use by another application or you may not have read permissions.'
      );
    }

    // Check for required files
    if (!zip.getEntry('data.db')) {
      throw new Error('The selected file is not a valid SmartKhata backup (missing database).');
    }

    const metaEntry = zip.getEntry('meta.json');
    if (!metaEntry) {
      throw new Error('The selected file is not a valid SmartKhata backup (missing metadata).');
    }

    // Validate metadata and schema compatibility
    try {
      const metaContent = metaEntry.getData().toString('utf8');
      const meta = JSON.parse(metaContent);

      if (!meta.schemaVersion) {
        throw new Error('The selected file is not a valid SmartKhata backup (invalid version).');
      }

      const currentSchemaVersion = migrationRunner.getCurrentVersion();
      if (meta.schemaVersion > currentSchemaVersion) {
        throw new Error(
          'This backup was created with a newer version of SmartKhata. Please update your application to the latest version to restore this data.'
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('newer version') ||
          error.message.includes('valid SmartKhata backup'))
      ) {
        throw error;
      }
      throw new Error('The selected backup file appears to be corrupted.');
    }
  }

  /**
   * Read metadata from a backup ZIP without extracting everything
   */
  public getBackupMetadata(sourcePath: string): BackupMeta {
    try {
      const buffer = fs.readFileSync(sourcePath);
      const zip = new AdmZip(buffer);
      const metaEntry = zip.getEntry('meta.json');

      if (!metaEntry) {
        throw new Error(
          'The selected file is not a valid SmartKhata backup (missing metadata file).'
        );
      }

      const metaContent = metaEntry.getData().toString('utf8');
      return JSON.parse(metaContent);
    } catch (error) {
      backupLogger.error('Failed to read backup metadata', { error, sourcePath });
      throw error instanceof Error ? error : new Error('Failed to read backup information.');
    }
  }

  /**
   * Delete older backups from a directory, keeping only N latest
   */
  public rotateBackups(backupDir: string, retainCount: number): void {
    try {
      if (!fs.existsSync(backupDir)) {
        return;
      }

      const files = fs
        .readdirSync(backupDir)
        .filter((f) => f.endsWith('.zip'))
        .map((f) => ({
          name: f,
          path: path.join(backupDir, f),
          mtime: fs.statSync(path.join(backupDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime); // Newest first

      if (files.length > retainCount) {
        const toDelete = files.slice(retainCount);
        backupLogger.info(
          `Rotating backups in ${backupDir}, deleting ${toDelete.length} old files`,
          {
            retaining: retainCount,
            total: files.length,
          }
        );

        for (const file of toDelete) {
          try {
            fs.unlinkSync(file.path);
            backupLogger.debug(`Deleted old backup: ${file.name}`);
          } catch (e) {
            backupLogger.warn(`Failed to delete old backup: ${file.name}`, e);
          }
        }
      }
    } catch (error) {
      backupLogger.error('Failed to rotate backups', error);
    }
  }
}

// Export singleton instance
export const backupService = new BackupService();
