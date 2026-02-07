import fs from 'fs';
import path from 'path';
import { configManager } from '../config/app-config';

/**
 * Simple file-based logger for Electron main process
 * 
 * Features:
 * - Writes to daily log files
 * - Auto-rotates logs (keeps last 7 days)
 * - Console output in development
 * - File output in production
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

class Logger {
  private logsPath: string;
  private currentLogFile: string;
  private isDevelopment: boolean;

  constructor() {
    const config = configManager.getConfig();
    this.logsPath = config.logsPath;
    this.isDevelopment = config.isDevelopment;
    this.currentLogFile = this.getCurrentLogFilePath();

    // Ensure logs directory exists
    if (!fs.existsSync(this.logsPath)) {
      fs.mkdirSync(this.logsPath, { recursive: true });
    }

    // Clean old logs on startup
    this.cleanOldLogs();
  }

  /**
   * Get log file path for today
   */
  private getCurrentLogFilePath(): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logsPath, `app-${date}.log`);
  }

  /**
   * Format log message
   */
  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] ${message}${dataStr}`;
  }

  /**
   * Write to log file
   */
  private writeToFile(message: string): void {
    try {
      fs.appendFileSync(this.currentLogFile, message + '\n', 'utf8');
    } catch (error) {
      // Fallback to console if file write fails
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Clean logs older than 7 days
   */
  private cleanOldLogs(): void {
    try {
      const files = fs.readdirSync(this.logsPath);
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

      files.forEach((file) => {
        if (!file.startsWith('app-') || !file.endsWith('.log')) {
          return;
        }

        const filePath = path.join(this.logsPath, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          fs.unlinkSync(filePath);
          this.info(`Deleted old log file: ${file}`);
        }
      });
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }

  /**
   * Log message
   */
  private log(level: LogLevel, message: string, data?: any): void {
    const formattedMessage = this.formatMessage(level, message, data);

    // Always write to file in production (except DEBUG)
    if (!this.isDevelopment && level !== LogLevel.DEBUG) {
      this.writeToFile(formattedMessage);
    }

    // Console output
    switch (level) {
      case LogLevel.DEBUG:
        if (this.isDevelopment) {
          console.debug(formattedMessage);
        }
        break;
      case LogLevel.INFO:
        console.log(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage);
        // Always write errors to file, even in dev
        if (this.isDevelopment) {
          this.writeToFile(formattedMessage);
        }
        break;
    }
  }

  /**
   * Debug level (dev only)
   */
  public debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Info level
   */
  public info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Warning level
   */
  public warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Error level
   */
  public error(message: string, error?: Error | any): void {
    const errorData = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error;
    this.log(LogLevel.ERROR, message, errorData);
  }

  /**
   * Get path to current log file
   */
  public getLogFilePath(): string {
    return this.currentLogFile;
  }

  /**
   * Get path to logs directory
   */
  public getLogsDirectory(): string {
    return this.logsPath;
  }
}

// Singleton instance
export const logger = new Logger();
