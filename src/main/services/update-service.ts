import { autoUpdater, UpdateInfo as ElectronUpdateInfo } from 'electron-updater';
import { BaseService } from './base-service';
import { logger } from '../utils/logger';
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { UpdateStatus, UpdateInfo } from '@shared/types/update';
import { SettingsService } from './settings-service';
import { backupService } from './backup-service';

/**
 * Update Service
 *
 * Manages the application's auto-update lifecycle using electron-updater.
 * Communicates status to the renderer via IPC.
 */
export class UpdateService extends BaseService {
  private static instance: UpdateService;
  private readonly updateLogger = logger.forModule('UPDATE');
  private currentStatus: UpdateStatus = UpdateStatus.IDLE;
  private updateInfo: UpdateInfo | null = null;

  private constructor() {
    super();
    this.setupListeners();
  }

  public static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  /**
   * Initialize Update Service
   */
  public initialize(): void {
    const isProduction = app.isPackaged || process.env.NODE_ENV === 'production';
    const settings = SettingsService.getInstance().getConfig();

    // Even in dev, we might want to test the IPC flow
    (autoUpdater as any).logger = this.updateLogger;
    autoUpdater.autoDownload = false;

    if (!isProduction) {
      this.updateLogger.info('Update service started in development mode');
      return;
    }

    this.updateLogger.info('Initializing production update service...', {
      currentVersion: app.getVersion(),
    });

    // Initial check on startup (packaged only) - respecting user setting
    if (settings.autoUpdateEnabled) {
      this.checkForUpdates().catch((err) => {
        this.updateLogger.error('Startup update check failed', err);
      });
    } else {
      this.updateLogger.info('Automatic updates are disabled by user');
    }
  }

  /**
   * Check for updates
   */
  public async checkForUpdates(): Promise<void> {
    try {
      this.updateLogger.info('Checking for updates...');
      this.setStatus(UpdateStatus.CHECKING);

      const isProduction = app.isPackaged || process.env.NODE_ENV === 'production';
      if (!isProduction) {
        // In development, electron-updater skips the check without emitting events
        // We simulate a small delay then set status to NOT_AVAILABLE to unblock the UI
        await new Promise((resolve) => setTimeout(resolve, 1500));
        this.setStatus(UpdateStatus.NOT_AVAILABLE);
        this.updateLogger.info('Development mode: Simulated "Update Not Available"');
        return;
      }

      await autoUpdater.checkForUpdates();
    } catch (error) {
      this.updateLogger.error('Update check failed', error);
      this.setStatus(UpdateStatus.ERROR);
    }
  }

  /**
   * Start downloading update
   */
  public async downloadUpdate(): Promise<void> {
    try {
      this.updateLogger.info('Starting update download...');
      this.setStatus(UpdateStatus.DOWNLOADING);
      await autoUpdater.downloadUpdate();
    } catch (error) {
      this.updateLogger.error('Download failed', error);
      this.setStatus(UpdateStatus.ERROR);
    }
  }

  /**
   * Install and restart
   */
  public async installUpdate(): Promise<void> {
    try {
      this.updateLogger.info('Proceeding to install update. Creating safety backup first...');

      // Safety Backup before quitAndInstall
      try {
        const userDataPath = app.getPath('userData');
        const backupDir = path.join(userDataPath, 'safety-backups');
        const backupPath = await backupService.createBackup(backupDir);
        this.updateLogger.info('Pre-update safety backup created successfully', {
          path: backupPath,
        });

        // Keep last 3 safety backups
        backupService.rotateBackups(backupDir, 3);
      } catch (backupError) {
        // We log the error but proceed with update since the primary data in userData is already safe
        this.updateLogger.warn(
          'Pre-update safety backup failed, but data in userData is preserved by electron-updater',
          backupError
        );
      }

      this.updateLogger.info('Installing update and restarting...');
      autoUpdater.quitAndInstall();
    } catch (error) {
      this.updateLogger.error('Installation failed', error);
      this.setStatus(UpdateStatus.ERROR);
    }
  }

  /**
   * Get current update status
   */
  public getStatusInfo() {
    return {
      status: this.currentStatus,
      updateInfo: this.updateInfo,
    };
  }

  private setStatus(status: UpdateStatus, info: UpdateInfo | null = this.updateInfo): void {
    this.currentStatus = status;
    this.updateInfo = info;
    this.notifyRenderer();
  }

  private notifyRenderer(): void {
    const windows = BrowserWindow.getAllWindows();
    const statusData = this.getStatusInfo();

    windows.forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.UPDATE_STATUS, statusData);
      }
    });
  }

  private setupListeners(): void {
    autoUpdater.on('checking-for-update', () => {
      this.updateLogger.debug('autoUpdater: checking-for-update');
    });

    autoUpdater.on('update-available', (info: ElectronUpdateInfo) => {
      // Check if update is mandatory (e.g., includes [MANDATORY] in release notes)
      const releaseNotes = typeof info.releaseNotes === 'string' ? info.releaseNotes : '';
      const isMandatory = releaseNotes.includes('[MANDATORY]');

      this.updateLogger.info('Update available', { version: info.version, isMandatory });

      this.setStatus(UpdateStatus.AVAILABLE, {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: releaseNotes,
        isMandatory: isMandatory,
      });
    });

    autoUpdater.on('update-not-available', () => {
      this.updateLogger.info('Update not available');
      this.setStatus(UpdateStatus.NOT_AVAILABLE, null);
    });

    autoUpdater.on('error', (err) => {
      this.updateLogger.error('autoUpdater error', err);
      this.setStatus(UpdateStatus.ERROR);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('update:progress', {
            percent: progressObj.percent,
            speed: progressObj.bytesPerSecond,
            transferred: progressObj.transferred,
            total: progressObj.total,
          });
        }
      });
    });

    autoUpdater.on('update-downloaded', (info: ElectronUpdateInfo) => {
      this.updateLogger.info('Update downloaded', { version: info.version });
      this.setStatus(UpdateStatus.DOWNLOADED);
    });
  }
}
