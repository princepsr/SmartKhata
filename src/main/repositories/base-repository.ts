import { databaseManager } from '../database';
import { logger } from '../utils/logger';
import Database from 'better-sqlite3';

/**
 * Base Repository Class
 *
 * Provides common database operations with:
 * - Type-safe query execution
 * - Centralized error handling
 * - Automatic logging
 * - Transaction support
 *
 * All repositories should extend this class.
 */

export abstract class BaseRepository {
  protected db: Database.Database;

  constructor() {
    this.db = databaseManager.getDatabase();
  }

  /**
   * Execute a query that doesn't return data (INSERT, UPDATE, DELETE)
   *
   * @param sql - SQL query string
   * @param params - Query parameters
   * @returns RunResult with lastInsertRowid and changes
   */
  protected execute(sql: string, params: unknown[] = []): Database.RunResult {
    try {
      logger.debug('Executing SQL', { sql, params });
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      logger.debug('SQL executed', { changes: result.changes, lastId: result.lastInsertRowid });
      return result;
    } catch (error) {
      logger.error('SQL execution failed', { sql, params, error });
      throw this.handleError(error, 'execute');
    }
  }

  /**
   * Query for a single row
   *
   * @param sql - SQL query string
   * @param params - Query parameters
   * @returns Single row or undefined
   */
  protected queryOne<T>(sql: string, params: unknown[] = []): T | undefined {
    try {
      logger.debug('Querying one', { sql, params });
      const stmt = this.db.prepare(sql);
      const result = stmt.get(...params) as T | undefined;
      logger.debug('Query one result', { found: !!result });
      return result;
    } catch (error) {
      logger.error('Query one failed', { sql, params, error });
      throw this.handleError(error, 'queryOne');
    }
  }

  /**
   * Query for multiple rows
   *
   * @param sql - SQL query string
   * @param params - Query parameters
   * @returns Array of rows (empty if no results)
   */
  protected queryAll<T>(sql: string, params: unknown[] = []): T[] {
    try {
      logger.debug('Querying all', { sql, params });
      const stmt = this.db.prepare(sql);
      const results = stmt.all(...params) as T[];
      logger.debug('Query all result', { count: results.length });
      return results;
    } catch (error) {
      logger.error('Query all failed', { sql, params, error });
      throw this.handleError(error, 'queryAll');
    }
  }

  /**
   * Execute a function within a transaction
   *
   * @param fn - Function to execute
   * @returns Result of the function
   */
  protected transaction<T>(fn: () => T): T {
    try {
      logger.debug('Starting transaction');
      const result = databaseManager.transaction(fn);
      logger.debug('Transaction committed');
      return result;
    } catch (error) {
      logger.error('Transaction failed (rolled back)', { error });
      throw this.handleError(error, 'transaction');
    }
  }

  /**
   * Check if a record exists
   *
   * @param sql - SQL query string (should return count or id)
   * @param params - Query parameters
   * @returns true if record exists
   */
  protected exists(sql: string, params: unknown[] = []): boolean {
    try {
      const result = this.queryOne<{ count: number }>(sql, params);
      return result ? result.count > 0 : false;
    } catch (error) {
      logger.error('Exists check failed', { sql, params, error });
      throw this.handleError(error, 'exists');
    }
  }

  /**
   * Get count of records
   *
   * @param sql - SQL query string (should return count)
   * @param params - Query parameters
   * @returns Count of records
   */
  protected count(sql: string, params: unknown[] = []): number {
    try {
      const result = this.queryOne<{ count: number }>(sql, params);
      return result?.count || 0;
    } catch (error) {
      logger.error('Count query failed', { sql, params, error });
      throw this.handleError(error, 'count');
    }
  }

  /**
   * Centralized error handling
   *
   * Converts database errors into application-friendly errors
   */
  private handleError(error: unknown, operation: string): Error {
    if (error instanceof Error) {
      // SQLite error codes
      if (error.message.includes('UNIQUE constraint failed')) {
        return new DatabaseError('Record already exists', 'UNIQUE_VIOLATION', error);
      }

      if (error.message.includes('FOREIGN KEY constraint failed')) {
        return new DatabaseError(
          'Referenced record does not exist',
          'FOREIGN_KEY_VIOLATION',
          error
        );
      }

      if (error.message.includes('NOT NULL constraint failed')) {
        return new DatabaseError('Required field is missing', 'NOT_NULL_VIOLATION', error);
      }

      if (error.message.includes('CHECK constraint failed')) {
        return new DatabaseError('Invalid data value', 'CHECK_VIOLATION', error);
      }

      if (error.message.includes('database is locked')) {
        return new DatabaseError('Database is busy, please try again', 'DATABASE_LOCKED', error);
      }

      // Generic database error
      return new DatabaseError(`Database operation failed: ${operation}`, 'DATABASE_ERROR', error);
    }

    // Unknown error
    return new DatabaseError(
      'An unexpected error occurred',
      'UNKNOWN_ERROR',
      new Error(String(error))
    );
  }
  /**
   * Parse SQLite date string (UTC) to JavaScript Date object
   *
   * SQLite datetime('now') returns 'YYYY-MM-DD HH:MM:SS' in UTC.
   * Native JS 'new Date()' without 'Z' or offset assumes Local Time.
   * This helper ensures the string is forced to UTC interpretation.
   */
  protected parseDate(dateStr: string): Date {
    if (!dateStr) {
      return new Date();
    }

    // If it's already an ISO string with Z or offset, use as is
    if (dateStr.includes('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
      return new Date(dateStr);
    }

    // SQLite format 'YYYY-MM-DD HH:MM:SS' -> 'YYYY-MM-DDTHH:MM:SSZ'
    const utcStr = dateStr.replace(' ', 'T') + 'Z';
    return new Date(utcStr);
  }
}

/**
 * Custom Database Error
 *
 * Provides structured error information for better error handling
 */
export class DatabaseError extends Error {
  public readonly code: string;
  public readonly originalError?: Error;

  constructor(message: string, code: string, originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.originalError = originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DatabaseError);
    }
  }

  /**
   * Check if error is a specific type
   */
  public isCode(code: string): boolean {
    return this.code === code;
  }

  /**
   * Get user-friendly error message
   */
  public getUserMessage(): string {
    switch (this.code) {
      case 'UNIQUE_VIOLATION':
        return 'This record already exists. Please use a different value.';
      case 'FOREIGN_KEY_VIOLATION':
        return 'Cannot complete operation. Referenced data does not exist.';
      case 'NOT_NULL_VIOLATION':
        return 'Required information is missing. Please fill all required fields.';
      case 'CHECK_VIOLATION':
        return 'Invalid data provided. Please check your input.';
      case 'DATABASE_LOCKED':
        return 'Database is busy. Please try again in a moment.';
      default:
        return 'A database error occurred. Please try again or contact support.';
    }
  }
}
