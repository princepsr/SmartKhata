import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { backupService } from './backup-service';
import { SettingsService } from './settings-service';
import { googleDriveService } from './google-drive-service';
import { googleAuthService } from './google-auth-service';
import { connectivityService } from './connectivity-service';
import { logger } from '../utils/logger';

const autoBackupLogger = logger.forModule('AUTO-BACKUP');

export class AutoBackupService {
  private static instance: AutoBackupService;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly backupDir: string;
  private settingsService: SettingsService;
  private isProcessing: boolean = false;

  private constructor() {
    this.backupDir = path.join(app.getPath('userData'), 'autobackups');
    this.settingsService = SettingsService.getInstance();
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  public static getInstance(): AutoBackupService {
    if (!AutoBackupService.instance) {
      AutoBackupService.instance = new AutoBackupService();
    }
    return AutoBackupService.instance;
  }

  /**
   * Start the auto-backup monitor
   */
  public start(): void {
    autoBackupLogger.info('Starting Auto-Backup monitor');

    // Start connectivity monitor
    connectivityService.start();

    // Listen for connectivity changes to retry pending syncs
    connectivityService.on('change', (online: boolean) => {
      if (online) {
        autoBackupLogger.info('Internet back online, processing pending syncs');
        this.processPendingSync();
      }
    });

    // Check for pending sync on startup with a small delay to allow connectivity check to finish
    setTimeout(() => {
      this.processPendingSync();
    }, 5000);

    // Initial check on startup
    this.checkAndPerformBackup();

    // Listen for settings changes to trigger immediate check if enabled/interval changed
    // We only care about specific fields to avoid recursion when we update timestamps
    let lastKnownInterval = this.settingsService.getConfig().autoBackupIntervalDays;
    let lastKnownEnabled = this.settingsService.getConfig().autoBackupEnabled;

    this.settingsService.onChange((newConfig) => {
      const intervalChanged = newConfig.autoBackupIntervalDays !== lastKnownInterval;
      const enabledChanged = newConfig.autoBackupEnabled !== lastKnownEnabled;

      if (intervalChanged || enabledChanged) {
        lastKnownInterval = newConfig.autoBackupIntervalDays;
        lastKnownEnabled = newConfig.autoBackupEnabled;

        autoBackupLogger.info('Relevant backup settings changed, checking status');
        this.checkAndPerformBackup();
      }
    });

    // Check every 15 minutes if a backup is due (was 1 hour)
    this.checkInterval = setInterval(
      () => {
        this.checkAndPerformBackup();
      },
      15 * 60 * 1000
    );
  }

  /**
   * Stop the monitor
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    connectivityService.stop();
  }

  /**
   * Logic to check if 24h passed and perform backup
   */
  private async checkAndPerformBackup(): Promise<void> {
    if (this.isProcessing) {
      autoBackupLogger.debug('Backup check already in progress, skipping');
      return;
    }

    try {
      this.isProcessing = true;
      const settings = this.settingsService.getConfig();

      if (!settings.autoBackupEnabled) {
        return;
      }

      const now = new Date();
      const lastBackupStr = settings.lastAutoBackup;
      const intervalVal = settings.autoBackupIntervalDays || 1;
      const unit = settings.autoBackupIntervalUnit || 'days';

      const intervalMs =
        unit === 'days' ? intervalVal * 24 * 60 * 60 * 1000 : intervalVal * 60 * 60 * 1000;

      let shouldBackup = false;
      if (!lastBackupStr) {
        shouldBackup = true;
      } else {
        const lastBackup = new Date(lastBackupStr);
        if (now.getTime() - lastBackup.getTime() >= intervalMs) {
          shouldBackup = true;
        }
      }

      if (shouldBackup) {
        autoBackupLogger.info('Interval reached, performing automated backup...');
        const backupPath = await backupService.createBackup(this.backupDir);

        // Update last auto backup timestamp
        this.settingsService.updateConfig({ lastAutoBackup: new Date().toISOString() });

        // Optional: Sync to Google Drive if authenticated
        await this.syncToCloud(backupPath);

        // Rotate backups
        backupService.rotateBackups(this.backupDir, settings.autoBackupRetainCount || 5);

        autoBackupLogger.info('Automated backup cycle completed successfully', {
          path: backupPath,
        });
      } else {
        // Interval not reached, but we should still check for pending cloud syncs
        // as a redundant failsafe to the connectivity event listener
        if (settings.cloudSyncPending) {
          autoBackupLogger.debug('Checking for pending cloud sync during interval');
          await this.processPendingSync();
        }
      }
    } catch (error) {
      autoBackupLogger.error('Scheduled auto-backup cycle failed', { error });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Sync the backup to Google Drive if conditions are met
   */
  private async syncToCloud(localPath: string) {
    try {
      const settings = this.settingsService.getConfig();

      if (settings.googleDriveSyncEnabled && googleAuthService.isAuthenticated()) {
        autoBackupLogger.info('Starting cloud sync to Google Drive');
        const result = await googleDriveService.syncBackup(localPath);

        if (result.success) {
          autoBackupLogger.info('Cloud sync completed successfully');
          this.settingsService.updateConfig({
            lastCloudSync: new Date().toISOString(),
            cloudSyncPending: false,
            pendingSyncPath: null,
          });
        } else {
          autoBackupLogger.warn('Cloud sync failed, marking as pending', { error: result.error });
          this.settingsService.updateConfig({
            cloudSyncPending: true,
            pendingSyncPath: localPath,
          });
        }
      } else {
        autoBackupLogger.debug('Skipping cloud sync trigger', {
          enabled: settings.googleDriveSyncEnabled,
          authenticated: googleAuthService.isAuthenticated(),
        });
      }
    } catch (error) {
      autoBackupLogger.error('Error during cloud sync trigger', { error });
    }
  }

  /**
   * Process any pending sync that couldn't complete due to offline/errors
   */
  private async processPendingSync(): Promise<void> {
    try {
      const settings = this.settingsService.getConfig();

      if (
        settings.cloudSyncPending &&
        settings.pendingSyncPath &&
        fs.existsSync(settings.pendingSyncPath) &&
        connectivityService.getIsOnline() &&
        googleAuthService.isAuthenticated()
      ) {
        autoBackupLogger.info('Retrying pending cloud sync...', { path: settings.pendingSyncPath });
        await this.syncToCloud(settings.pendingSyncPath);
      }
    } catch (error) {
      autoBackupLogger.error('Failed to process pending sync', { error });
    }
  }
}

export const autoBackupService = AutoBackupService.getInstance();
