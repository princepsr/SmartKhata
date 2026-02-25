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

/**
 * Structured Data for Logging
 */
export interface LogData {
  [key: string]: unknown;
}

class Logger {
  private logsPath: string;
  private currentLogFile: string;
  private isDevelopment: boolean;
  private moduleName: string;

  constructor(moduleName: string = 'MAIN') {
    const config = configManager.getConfig();
    this.logsPath = config.logsPath;
    this.isDevelopment = config.isDevelopment;
    this.moduleName = moduleName;
    this.currentLogFile = this.getCurrentLogFilePath();

    // Ensure logs directory exists (only once)
    if (this.moduleName === 'MAIN' && !fs.existsSync(this.logsPath)) {
      fs.mkdirSync(this.logsPath, { recursive: true });
    }

    // Clean old logs on startup (only once)
    if (this.moduleName === 'MAIN') {
      this.cleanOldLogs();
    }
  }

  /**
   * Create a child logger for a specific module
   */
  public forModule(module: string): Logger {
    return new Logger(module);
  }

  /**
   * Get log file path for today
   */
  /**
   * Get current date in IST (YYYY-MM-DD)
   */
  private getCurrentLogFilePath(): string {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const date = new Date(Date.now() + istOffset).toISOString().split('T')[0];
    return path.join(this.logsPath, `app-${date}.log`);
  }

  /**
   * Get current timestamp in IST (Readable format: YYYY-MM-DD HH:mm:ss.SSS)
   */
  private getISTTimestamp(): string {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const date = new Date(Date.now() + istOffset);

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const mins = String(date.getUTCMinutes()).padStart(2, '0');
    const secs = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = String(date.getUTCMilliseconds()).padStart(3, '0');

    return `${year}-${month}-${day} ${hours}:${mins}:${secs}.${ms}`;
  }

  /**
   * Format log message
   * Output: [TIMESTAMP][LEVEL][MODULE] Message | {JSON}
   */
  private formatMessage(level: LogLevel, message: string, data?: LogData): string {
    const timestamp = this.getISTTimestamp();
    const sanitizedData = data ? this.sanitizeData(data) : null;
    const dataStr =
      sanitizedData && Object.keys(sanitizedData).length > 0
        ? ` | ${JSON.stringify(sanitizedData)}`
        : '';

    return `[${timestamp}][${level}][${this.moduleName}] ${message}${dataStr}`;
  }

  /**
   * Sanitize log data to prevent PII leakage
   * Redacts sensitive fields like names, emails, and bill items
   */
  private sanitizeData(data: LogData): LogData {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'customerName',
      'customerPhone',
      'customerEmail',
      'clientName',
      'items',
      'lineItems',
      'password',
      'token',
      'secret',
    ];

    const sanitized = { ...data };

    for (const key in sanitized) {
      if (sensitiveFields.includes(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeData(sanitized[key] as LogData);
      }
    }

    return sanitized;
  }

  /**
   * Write to log file
   */
  private writeToFile(message: string): void {
    try {
      fs.appendFileSync(this.currentLogFile, message + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Clean logs older than 7 days
   */
  private cleanOldLogs(): void {
    try {
      if (!fs.existsSync(this.logsPath)) {
        return;
      }
      const files = fs.readdirSync(this.logsPath);
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000;

      files.forEach((file) => {
        if (!file.startsWith('app-') || !file.endsWith('.log')) {
          return;
        }
        const filePath = path.join(this.logsPath, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
        }
      });
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }

  /**
   * Log message
   */
  private log(level: LogLevel, message: string, data?: LogData): void {
    const formattedMessage = this.formatMessage(level, message, data);

    // File output (always in production, or if level >= INFO in dev)
    if (!this.isDevelopment || level !== LogLevel.DEBUG) {
      this.writeToFile(formattedMessage);
    }

    // Console output
    if (this.isDevelopment) {
      switch (level) {
        case LogLevel.DEBUG:
          // eslint-disable-next-line no-console
          console.debug(formattedMessage);
          break;
        case LogLevel.INFO:
          // eslint-disable-next-line no-console
          console.log(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
      }
    }
  }

  public debug(message: string, data?: LogData): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  public info(message: string, data?: LogData): void {
    this.log(LogLevel.INFO, message, data);
  }

  public warn(message: string, data?: LogData): void {
    this.log(LogLevel.WARN, message, data);
  }

  public error(message: string, error?: Error | unknown): void {
    const errorData =
      error instanceof Error ? { message: error.message, stack: error.stack } : (error as LogData);
    this.log(LogLevel.ERROR, message, errorData);
  }

  public getLogsDirectory(): string {
    return this.logsPath;
  }
}

// Singleton instance (default MAIN module)
export const logger = new Logger('MAIN');
