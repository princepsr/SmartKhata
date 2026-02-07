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
    const isDevelopment = process.env.NODE_ENV !== 'production';
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
      // In production, use user data directory
      return path.join(userDataPath, 'data', 'smartkhata.db');
    }
  }

  /**
   * Ensure required directories exist
   */
  private ensureDirectories(userDataPath: string): void {
    const dirs = [
      userDataPath,
      path.join(userDataPath, 'data'),
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
