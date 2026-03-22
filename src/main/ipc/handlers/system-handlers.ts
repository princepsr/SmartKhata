/**
 * System IPC Handlers
 *
 * Handles general system operations.
 */

import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { IPCHandler } from '../ipc-handler';
import { databaseManager } from '@main/database';
import { migrationRunner } from '@main/database/migrations';
import { backupService } from '@main/services/backup-service';
import { SettingsService } from '@main/services/settings-service';
import { googleAuthService } from '@main/services/google-auth-service';
import { googleDriveService } from '@main/services/google-drive-service';
import { connectivityService } from '@main/services/connectivity-service';
import { logger } from '@main/utils/logger';
import { SeedRunner } from '@main/database/seed-runner';
import { BackupMeta } from '@shared/types/ipc';
import { getUserFriendlyMessage } from '../../services/errors/service-errors';

export function registerSystemHandlers(): void {
  /**
   * SEED MODULE
   */

  // List available seeds
  IPCHandler.handle<void, string[]>(IPC_CHANNELS.SYSTEM_SEED_LIST, async () => {
    const db = databaseManager.getDatabase();
    const runner = new SeedRunner(db);
    return runner.listSeeds();
  });

  // Run specific seed
  IPCHandler.handle<{ seedFile: string; clearFirst?: boolean }, { success: boolean }>(
    IPC_CHANNELS.SYSTEM_SEED_RUN,
    async (params) => {
      const { seedFile, clearFirst } = params;
      const db = databaseManager.getDatabase();
      const runner = new SeedRunner(db);

      runner.runSeed(seedFile, !!clearFirst);
      return { success: true };
    }
  );

  // Reset database completely
  IPCHandler.handle<void, { success: boolean }>(
    IPC_CHANNELS.SYSTEM_RESET_DB,
    async () => {
      const db = databaseManager.getDatabase();
      const runner = new SeedRunner(db);

      db.transaction(() => {
        runner.clearAllData();
      })();
      
      return { success: true };
    }
  );

  /**
   * Ping Handler
   * Returns "pong" to verify connectivity
   */
  IPCHandler.handle<void, string>(IPC_CHANNELS.SYSTEM_PING, async () => {
    return 'pong';
  });

  /**
   * Get App Info Handler
   * Returns application name and version
   */
  IPCHandler.handle<void, { name: string; version: string; platform: string }>(
    IPC_CHANNELS.SYSTEM_GET_APP_INFO,
    async () => {
      return {
        name: app.getName(),
        version: app.getVersion(),
        platform: process.platform,
      };
    }
  );

  /**
   * Get Database Status Handler
   * Returns database path, schema version, and table count
   */
  IPCHandler.handle<
    void,
    {
      path: string;
      schemaVersion: number;
      tableCount: number;
      isReady: boolean;
      integrityOk: boolean;
      wasCrashDetected: boolean;
      error?: string;
    }
  >(IPC_CHANNELS.SYSTEM_DB_STATUS, async () => {
    const db = databaseManager.getDatabase();
    const status = databaseManager.getStatus();

    // Get schema version
    const schemaVersion = migrationRunner.getCurrentVersion();

    // Get table count
    const tables = db
      .prepare(
        `
        SELECT COUNT(*) as count 
        FROM sqlite_master 
        WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%'
      `
      )
      .get() as { count: number };

    return {
      path: databaseManager.getDatabasePath(),
      schemaVersion,
      tableCount: tables.count,
      isReady: databaseManager.isReady(),
      integrityOk: status.integrityOk,
      wasCrashDetected: status.wasCrashDetected,
      error: status.error,
    };
  });

  /**
   * BACKUP MODULE
   */

  // Manual Backup
  IPCHandler.handle<void, { path: string; lastAutoBackup: string }>(
    IPC_CHANNELS.BACKUP_CREATE,
    async () => {
      const folderPath = path.join(app.getPath('userData'), 'autobackups');
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const backupPath = await backupService.createBackup(folderPath);

      // 4. Trigger rotation if the backup was created in the autobackups folder
      const settings = SettingsService.getInstance().getConfig();
      backupService.rotateBackups(folderPath, settings.autoBackupRetainCount || 5);

      return {
        path: backupPath,
        lastAutoBackup: settings.lastAutoBackup || new Date().toISOString(),
      };
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // Get Backup Info (Combines file selection and metadata reading)
  IPCHandler.handle<void, { path: string; meta: BackupMeta } | null>(
    IPC_CHANNELS.BACKUP_INFO,
    async () => {
      const backupDir = path.join(app.getPath('userData'), 'autobackups');
      return backupService.selectBackupFile(backupDir);
    }
  );

  // Restore Backup
  IPCHandler.handle<string, { success: boolean }>(
    IPC_CHANNELS.BACKUP_RESTORE,
    async (backupPath) => {
      if (!backupPath || typeof backupPath !== 'string') {
        throw new Error('Invalid backup path');
      }

      await backupService.restoreFromBackup(backupPath);
      return { success: true };
    }
  );

  // ============================================
  // GOOGLE HANDLERS
  // ============================================

  // Get Google Auth URL
  IPCHandler.handle<void, string>(IPC_CHANNELS.GOOGLE_AUTH_URL, async () => {
    return googleAuthService.generateAuthUrl();
  });

  // Perform Google Authentication
  IPCHandler.handle<void, boolean>(
    IPC_CHANNELS.GOOGLE_AUTHENTICATE,
    async () => {
      let authWindow: BrowserWindow | null = null;
      try {
        logger.info('Starting In-App Google Authentication...');
        const authUrl = googleAuthService.generateAuthUrl();
        logger.debug('Generated Auth URL', { url: authUrl });

        authWindow = new BrowserWindow({
          width: 500,
          height: 650,
          show: true,
          title: 'Link Google Account - SmartKhata',
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        });

        authWindow.loadURL(authUrl);

        authWindow.once('ready-to-show', () => {
          logger.info('Auth window ready to show');
          authWindow?.show();
        });

        // Close window when authentication completes or fails
        logger.info('Waiting for authentication callback...');
        const authPromise = googleAuthService.authenticate();

        await Promise.race([
          authPromise,
          new Promise<void>((_, reject) => {
            if (authWindow) {
              authWindow.on('closed', () => {
                logger.info('Auth window closed by user');
                reject(new Error('Authentication window closed'));
              });
            }
          }),
        ]);

        return true;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown authentication error';
        logger.error('Google Auth Handler failed', { error: message });
        throw error;
      } finally {
        // Ensure server is closed and window is destroyed
        googleAuthService.cancelAuthenticate();
        if (authWindow && !authWindow.isDestroyed()) {
          logger.debug('Closing auth window in finally block');
          authWindow.close();
        }
      }
    },
    {
      timeout: 600000, // 10 minutes to allow for manual login
    }
  );

  // Get Google Profile
  IPCHandler.handle<void, { email: string } | null>(IPC_CHANNELS.GOOGLE_PROFILE, async () => {
    return googleDriveService.getProfile();
  });

  // Google Logout
  IPCHandler.handle<void, { success: boolean }>(IPC_CHANNELS.GOOGLE_LOGOUT, async () => {
    googleAuthService.logout();
    return { success: true };
  });

  // System Connectivity Change
  IPCHandler.handle<boolean, void>(IPC_CHANNELS.SYSTEM_CONNECTIVITY_CHANGE, async (online) => {
    connectivityService.setStatus(online);
  });

  // Manual Connectivity Check
  IPCHandler.handle<void, boolean>(IPC_CHANNELS.SYSTEM_CHECK_CONNECTIVITY, async () => {
    return connectivityService.checkNow();
  });

  // Google Drive Backup Info
  IPCHandler.handle<void, { name: string; size: string; modifiedTime: string }>(
    IPC_CHANNELS.GOOGLE_DRIVE_BACKUP_INFO,
    async () => {
      const metadata = await googleDriveService.getBackupMetadata();
      if (!metadata) {
        throw new Error('No backup found on Google Drive');
      }
      return metadata;
    }
  );

  // Google Drive Download Backup
  IPCHandler.handle<void, string>(IPC_CHANNELS.GOOGLE_DOWNLOAD_BACKUP, async () => {
    const tempPath = path.join(app.getPath('temp'), `restore_${Date.now()}.zip`);
    const result = await googleDriveService.downloadBackup(tempPath);
    if (result.success) {
      return tempPath;
    }
    throw new Error(result.error || 'Failed to download backup from Google Drive');
  });

  // Manual Cloud Sync (Backup + Sync)
  IPCHandler.handle<void, { lastCloudSync: string; lastAutoBackup: string }>(
    IPC_CHANNELS.GOOGLE_SYNC_NOW,
    async () => {
      logger.info('Starting manual cloud sync (Local Backup + Drive Upload)...');

      const settingsService = SettingsService.getInstance();
      const settings = settingsService.getConfig();

      // 1. Create Local Backup
      const backupDir = path.join(app.getPath('userData'), 'autobackups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const backupPath = await backupService.createBackup(backupDir);
      logger.debug('Local backup created for sync', { path: backupPath });

      // 1.1 Trigger rotation
      backupService.rotateBackups(backupDir, settings.autoBackupRetainCount || 5);

      // 2. Sync to Drive
      const result = await googleDriveService.syncBackup(backupPath);

      if (result.success) {
        const syncTime = new Date().toISOString();
        // Update cloud sync timestamp in settings
        settingsService.updateConfig({ lastCloudSync: syncTime });

        const config = settingsService.getConfig();
        return {
          lastCloudSync: syncTime,
          lastAutoBackup: config.lastAutoBackup || syncTime,
        };
      }

      throw new Error(result.error || 'Failed to sync backup to Google Drive');
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );
}
