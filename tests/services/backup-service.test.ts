import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Database } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

// Standard project imports (relative paths for compatibility)
import { backupService } from '../../src/main/services/backup-service';
import { databaseManager } from '../../src/main/database';
import { migrationRunner } from '../../src/main/database/migrations';
import { createTestDatabase, BetterSqliteCompatibleDatabase, seedTestData } from '../utils/test-db';

describe('BackupService', () => {
  let db: BetterSqliteCompatibleDatabase;
  const testBackupPath = path.resolve(process.cwd(), 'test-data', 'test_backup.zip');
  const activeDbPath = path.resolve(process.cwd(), 'test-data', 'active.sqlite');
  const tempDir = path.resolve(process.cwd(), 'test-data', 'temp');

  beforeEach(async () => {
    // Ensure test data dirs exist
    const testDataDir = path.resolve(process.cwd(), 'test-data');
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    db = await createTestDatabase();
    seedTestData(db);

    // We rely on tests/setup.ts to mock databaseManager globally.
    // However, we can further customize the mock behavior for specific tests.
    vi.mocked(databaseManager.getDatabase).mockReturnValue(db as unknown as Database);
    vi.mocked(databaseManager.getDatabasePath).mockReturnValue(activeDbPath);

    // Clean up files
    if (fs.existsSync(activeDbPath)) {
      fs.unlinkSync(activeDbPath);
    }
    if (fs.existsSync(testBackupPath)) {
      fs.unlinkSync(testBackupPath);
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create a structured ZIP backup', async () => {
    const backupPath = await backupService.createBackup(testBackupPath);

    expect(backupPath).toBe(testBackupPath);
    expect(fs.existsSync(testBackupPath)).toBe(true);

    const zip = new AdmZip(testBackupPath);
    const zipEntries = zip.getEntries();
    const entryNames = zipEntries.map((e) => e.entryName);

    expect(entryNames).toContain('data.db');
    expect(entryNames).toContain('settings.json');
    expect(entryNames).toContain('meta.json');

    const metaEntry = zip.getEntry('meta.json');
    if (!metaEntry) {
      throw new Error('meta.json missing');
    }
    const meta = JSON.parse(metaEntry.getData().toString('utf8'));
    expect(meta.appName).toBe('SmartKhata');
    expect(meta.version).toBe('0.1.0-test'); // From setup.ts mock
    expect(meta.schemaVersion).toBe(1);
    expect(meta.shopName).toBe('Test Shop'); // From seed data in test-db.ts
  });

  it('should restore from a valid structured ZIP backup', async () => {
    await backupService.createBackup(testBackupPath);
    fs.writeFileSync(activeDbPath, 'original data');

    // Mock integrity check success
    const mockPragma = vi.fn().mockReturnValue([{ integrity_check: 'ok' }]);
    db.pragma = mockPragma;

    await backupService.restoreFromBackup(testBackupPath);

    expect(databaseManager.close).toHaveBeenCalled();
    expect(databaseManager.initialize).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(activeDbPath)).toBe(true);
    expect(mockPragma).toHaveBeenCalledWith('integrity_check');
  });

  it('should roll back if integrity check fails', async () => {
    await backupService.createBackup(testBackupPath);
    const originalContent = 'original unique data';
    fs.writeFileSync(activeDbPath, originalContent);

    // Mock integrity check FAILURE
    const mockPragma = vi.fn().mockReturnValue([{ integrity_check: 'corrupt' }]);
    db.pragma = mockPragma;

    await expect(backupService.restoreFromBackup(testBackupPath)).rejects.toThrow(
      'The restored database appears to be corrupted'
    );

    // Verify rollback
    const restoredContent = fs.readFileSync(activeDbPath, 'utf-8');
    expect(restoredContent).toBe(originalContent);
  });

  it('should roll back if copy fails', async () => {
    await backupService.createBackup(testBackupPath);
    const originalContent = 'original unique data';
    fs.writeFileSync(activeDbPath, originalContent);

    // Mock failure during copy
    vi.spyOn(fs, 'copyFileSync').mockImplementation(
      (src: string | Buffer | URL, dest: string | Buffer | URL) => {
        if (
          typeof dest === 'string' &&
          dest.includes('active.sqlite') &&
          typeof src === 'string' &&
          src.includes('data.db') // copying from extracted to active
        ) {
          throw new Error('Simulated copy failure');
        }
        // @ts-expect-error - Accessing internal method for testing
        return fs.copyFileSync.getOriginal()(src, dest);
      }
    );

    await expect(backupService.restoreFromBackup(testBackupPath)).rejects.toThrow(
      'Not enough space or permission to restore'
    );

    const restoredContent = fs.readFileSync(activeDbPath, 'utf-8');
    expect(restoredContent).toBe(originalContent);
  });

  it('should roll back if renameSync fails', async () => {
    await backupService.createBackup(testBackupPath);
    const originalContent = 'original unique data';
    fs.writeFileSync(activeDbPath, originalContent);

    // Mock failure during Step B: Rename current to safety
    vi.spyOn(fs, 'renameSync').mockImplementation((oldPath: fs.PathLike, newPath: fs.PathLike) => {
      if (
        typeof oldPath === 'string' &&
        oldPath.includes('active.sqlite') &&
        typeof newPath === 'string' &&
        newPath.includes('bak')
      ) {
        throw new Error('Simulated rename failure');
      }
      // @ts-expect-error - Accessing internal method for testing
      return fs.renameSync.getOriginal()(oldPath, newPath);
    });

    await expect(backupService.restoreFromBackup(testBackupPath)).rejects.toThrow(
      'Failed to prepare for restore'
    );

    const restoredContent = fs.readFileSync(activeDbPath, 'utf-8');
    expect(restoredContent).toBe(originalContent);
  });

  describe('Backup Validation', () => {
    it('should validate a healthy backup', async () => {
      await backupService.createBackup(testBackupPath);
      await expect(backupService.validateBackup(testBackupPath)).resolves.not.toThrow();
    });

    it('should fail if backup file is missing', async () => {
      await expect(backupService.validateBackup('non_existent.zip')).rejects.toThrow(
        'The backup file could not be found'
      );
    });

    it('should fail if backup is not a valid ZIP', async () => {
      fs.writeFileSync(testBackupPath, 'invalid zip content');
      await expect(backupService.validateBackup(testBackupPath)).rejects.toThrow(
        'The selected file is not a valid SmartKhata backup'
      );
    });

    it('should fail if data.db is missing', async () => {
      // Create ZIP without data.db
      const zip = new AdmZip();
      zip.addFile('meta.json', Buffer.from('{}'));
      zip.writeZip(testBackupPath);

      await expect(backupService.validateBackup(testBackupPath)).rejects.toThrow(
        'missing database'
      );
    });

    it('should fail if meta.json is missing', async () => {
      // Create ZIP without meta.json
      const zip = new AdmZip();
      zip.addFile('data.db', Buffer.from('dummy db'));
      zip.writeZip(testBackupPath);

      await expect(backupService.validateBackup(testBackupPath)).rejects.toThrow(
        'missing metadata'
      );
    });

    it('should fail if schema version is incompatible', async () => {
      // Create ZIP with newer schema
      const zip = new AdmZip();
      zip.addFile('data.db', Buffer.from('dummy db'));
      const meta = {
        schemaVersion: 999, // Future version
        timestamp: new Date().toISOString(),
      };
      zip.addFile('meta.json', Buffer.from(JSON.stringify(meta)));
      zip.writeZip(testBackupPath);

      // Mock current schema version to 1
      vi.mocked(migrationRunner.getCurrentVersion).mockReturnValue(1);

      await expect(backupService.validateBackup(testBackupPath)).rejects.toThrow(
        'newer version of SmartKhata'
      );
    });
  });

  describe('Dialog & Path Automation', () => {
    it('should handle folder selection for backup', async () => {
      const { dialog } = await import('electron');
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: ['/fake/path'],
      });

      const path = await backupService.selectFolderForBackup();
      expect(path).toBe('/fake/path');
    });

    it('should handle file selection for restore with metadata', async () => {
      const { dialog } = await import('electron');
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: [testBackupPath],
      });

      await backupService.createBackup(testBackupPath);
      const result = await backupService.selectBackupFile();

      expect(result?.path).toBe(testBackupPath);
      expect(result?.meta.appName).toBe('SmartKhata');
    });

    it('should generate timestamped filename when createBackup target is a directory', async () => {
      const backupDir = path.join(tempDir, 'auto_backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const generatedPath = await backupService.createBackup(backupDir);

      expect(generatedPath).toContain('backup_');
      expect(generatedPath).toContain('.zip');
      expect(fs.existsSync(generatedPath)).toBe(true);
    });

    it('should increment counter if backup file exists in directory', async () => {
      const backupDir = path.join(tempDir, 'counter_test_unique');
      if (fs.existsSync(backupDir)) {
        fs.rmSync(backupDir, { recursive: true, force: true });
      }
      fs.mkdirSync(backupDir, { recursive: true });

      // Mock Date to have consistent timestamps for testing the counter
      const mockDate = new Date('2023-01-01T12:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      // Mock Date: Jan 1, 2023, 12:00:00 UTC -> 17:30 IST
      const timestamp = '20230101_1730';
      const firstPath = path.join(backupDir, `backup_${timestamp}.zip`);
      fs.writeFileSync(firstPath, 'dummy content');

      const secondPath = await backupService.createBackup(backupDir);

      expect(secondPath).toContain(`backup_${timestamp}_1.zip`);
      expect(fs.existsSync(secondPath)).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('Settings Restoration', () => {
    it('should restore application settings during restoreFromBackup', async () => {
      // 1. Create a valid backup
      await backupService.createBackup(testBackupPath);

      // 2. Mock restore environment
      const mockPragma = vi.fn().mockReturnValue([{ integrity_check: 'ok' }]);
      db.pragma = mockPragma;

      // Mock renameSync and copyFileSync to avoid OS-level file locking issues in this test
      const _subRenameSpy = vi.spyOn(fs, 'renameSync').mockImplementation(() => {});
      const _subCopySpy = vi.spyOn(fs, 'copyFileSync').mockImplementation(() => {});

      // Ensure activeDbPath exists for path logic tests
      fs.writeFileSync(activeDbPath, 'dummy original db');

      // Spy on updateConfig via private access
      const settingsService = (backupService as unknown as { settingsService: SettingsService })
        .settingsService;
      const spy = vi.spyOn(settingsService, 'updateConfig').mockImplementation(() => {});

      await backupService.restoreFromBackup(testBackupPath);

      expect(spy).toHaveBeenCalled();
      // Verify it was called with settings
      expect(spy.mock.calls[0][0]).toHaveProperty('shopName');

      spy.mockRestore();
      mockPragma.mockRestore(); // Restore db.pragma mock
    });
  });
});
