import { autoUpdater } from 'electron-updater';
import { BaseService } from './base-service';
import { logger } from '../utils/logger';
import { app } from 'electron';

/**
 * Update Service
 *
 * Manages the application's auto-update lifecycle using electron-updater.
 * In this phase, it provides the bridge for version comparison and logging.
 */
export class UpdateService extends BaseService {
  private static instance: UpdateService;
  private readonly updateLogger = logger.forModule('UPDATE');

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
   * Only active in production to prevent dev-mode update checks.
   */
  public initialize(): void {
    const isProduction = app.isPackaged || process.env.NODE_ENV === 'production';

    if (!isProduction) {
      this.updateLogger.info('Update service skipped in development mode');
      return;
    }

    this.updateLogger.info('Initializing update service...', {
      currentVersion: app.getVersion(),
    });

    try {
      // Configuration can be expanded here for custom update feeds
      autoUpdater.logger = this.updateLogger as any;
      autoUpdater.autoDownload = false; // Require user consent in future

      this.checkForUpdates();
    } catch (error) {
      this.updateLogger.error('Failed to initialize auto-updater', error);
    }
  }

  /**
   * Check for updates manually
   */
  public async checkForUpdates(): Promise<void> {
    try {
      this.updateLogger.debug('Checking for updates...');
      await autoUpdater.checkForUpdates();
    } catch (error) {
      this.updateLogger.error('Manual update check failed', error);
    }
  }

  /**
   * Setup autoUpdater lifecycle listeners
   */
  private setupListeners(): void {
    autoUpdater.on('checking-for-update', () => {
      this.updateLogger.info('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      this.updateLogger.info('Update available', {
        version: info.version,
        releaseDate: info.releaseDate,
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      this.updateLogger.debug('Update not available', {
        currentVersion: app.getVersion(),
      });
    });

    autoUpdater.on('error', (err) => {
      this.updateLogger.error('autoUpdater error', err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      this.updateLogger.debug('Download progress', {
        percent: progressObj.percent,
        speed: progressObj.bytesPerSecond,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.updateLogger.info('Update downloaded; will install on quit', {
        version: info.version,
      });
    });
  }
}
