import { app } from 'electron';
import path from 'path';
import fs from 'fs';

/**
 * Application Configuration
 *
 * Runtime configuration that varies between development and production.
 * Loads from environment variables and provides sensible defaults.
 */

export interface AppConfig {
  isDevelopment: boolean;
  isProduction: boolean;
  appVersion: string;
  userDataPath: string;
  databasePath: string;
  logsPath: string;
  backupPath: string;
}

class ConfigManager {
  private config: AppConfig;

  constructor() {
    // Robust check: if packaged, it's definitely production.
    // If not packaged, rely on NODE_ENV or default to dev.
    const isDevelopment = !app.isPackaged;
    const userDataPath = app.getPath('userData');

    // Ensure directories exist
    this.ensureDirectories(userDataPath);

    this.config = {
      isDevelopment,
      isProduction: !isDevelopment,
      appVersion: app.getVersion(),
      userDataPath,
      databasePath: this.getDatabasePath(userDataPath, isDevelopment),
      logsPath: path.join(userDataPath, 'logs'),
      backupPath: path.join(userDataPath, 'backups'),
    };
  }

  /**
   * Get database path based on environment
   */
  private getDatabasePath(userDataPath: string, isDevelopment: boolean): string {
    if (isDevelopment) {
      // In development, use a dev database in the project root
      return path.join(process.cwd(), 'dev-data', 'smartkhata.db');
    } else {
      // In production, use user data directory directly
      return path.join(userDataPath, 'database.db');
    }
  }

  /**
   * Ensure required directories exist
   */
  private ensureDirectories(userDataPath: string): void {
    const dirs = [
      userDataPath,
      path.join(userDataPath, 'logs'),
      path.join(userDataPath, 'backups'),
    ];

    // In development, also create dev-data directory
    if (process.env.NODE_ENV !== 'production') {
      dirs.push(path.join(process.cwd(), 'dev-data'));
    }

    dirs.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Initialize required files
    this.ensureFiles(userDataPath);
  }

  /**
   * Ensure required files exist
   */
  private ensureFiles(userDataPath: string): void {
    const settingsPath = path.join(userDataPath, 'settings.json');
    const databasePath = this.getDatabasePath(userDataPath, process.env.NODE_ENV !== 'production');

    // Create empty database.db if it doesn't exist (production only)
    if (process.env.NODE_ENV === 'production' && !fs.existsSync(databasePath)) {
      try {
        fs.writeFileSync(databasePath, '');
      } catch (e) {
        console.error('Failed to create initial database file', e);
      }
    }

    // Create default settings.json if it doesn't exist
    if (!fs.existsSync(settingsPath)) {
      try {
        const defaultSettings = {
          version: app.getVersion(),
          firstRun: new Date().toISOString(),
          setupComplete: false,
        };
        fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
      } catch (e) {
        console.error('Failed to create settings.json', e);
      }
    }
  }

  /**
   * Get the current configuration
   */
  public getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * Get a specific config value
   */
  public get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  /**
   * Get environment variable with fallback
   */
  public getEnv(key: string, fallback: string = ''): string {
    return process.env[key] || fallback;
  }
}

// Singleton instance
export const configManager = new ConfigManager();

// Export config for convenience
export const appConfig = configManager.getConfig();
