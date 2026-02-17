/**
 * System IPC Handlers
 *
 * Handles general system operations.
 */

import { app } from 'electron';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { IPCHandler } from '../ipc-handler';
import { databaseManager } from '@main/database';
import { migrationRunner } from '@main/database/migrations';
import { backupService } from '@main/services/backup-service';
import { BackupMeta } from '@shared/types/ipc';

export function registerSystemHandlers(): void {
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

  // Create Backup
  IPCHandler.handle<void, { path: string }>(IPC_CHANNELS.BACKUP_CREATE, async () => {
    const folderPath = await backupService.selectFolderForBackup();
    if (!folderPath) {
      throw new Error('Backup canceled by user');
    }

    const backupPath = await backupService.createBackup(folderPath);
    return { path: backupPath };
  });

  // Get Backup Info (Combines file selection and metadata reading)
  IPCHandler.handle<void, { path: string; meta: BackupMeta } | null>(
    IPC_CHANNELS.BACKUP_INFO,
    async () => {
      return backupService.selectBackupFile();
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
}
