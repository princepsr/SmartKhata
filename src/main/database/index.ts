import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { configManager } from '@main/config/app-config';
import { logger } from '@main/utils/logger';

const dbLogger = logger.forModule('DB');

/**
 * Database Manager
 *
 * Handles SQLite database initialization, connection management,
 * and graceful error recovery.
 *
 * RULES:
 * - Singleton pattern (one connection per app lifecycle)
 * - Synchronous API only (better-sqlite3)
 * - WAL mode for better concurrency
 * - Automatic corruption recovery
 */

class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string;
  private isInitialized = false;
  private wasCrashDetected = false;
  private lastIntegrityCheck: { ok: boolean; message?: string } | null = null;

  constructor() {
    this.dbPath = configManager.get('databasePath');
  }

  /**
   * Initialize database connection
   *
   * @param wasCrashDetected - Whether a crash was detected on startup
   */
  public initialize(wasCrashDetected = false): void {
    if (this.isInitialized) {
      dbLogger.warn('Database already initialized');
      return;
    }

    this.wasCrashDetected = wasCrashDetected;

    try {
      dbLogger.info('Initializing database...', {
        path: this.dbPath,
        crashDetected: this.wasCrashDetected,
      });

      // Step 1: Ensure database directory exists
      this.ensureDatabaseDirectory();

      // Step 2: Check if this is first run
      const isFirstRun = !fs.existsSync(this.dbPath);

      // Step 3: Open database connection
      this.db = this.openDatabase();

      // Step 4: Configure database
      this.configureDatabase();

      // Step 5: Verify integrity (Always on startup for now, but explicit on crash)
      if (this.wasCrashDetected) {
        dbLogger.warn('Crash detected on previous exit - performing mandatory integrity check');
      }
      this.verifyIntegrity();

      // Step 6: Run migrations (if needed)
      if (isFirstRun) {
        dbLogger.info('First run detected - database will be initialized by migrations');
      }

      this.isInitialized = true;
      dbLogger.info('Database initialized successfully', {
        path: this.dbPath,
        firstRun: isFirstRun,
      });
    } catch (error) {
      dbLogger.error('Failed to initialize database', error);
      throw new Error(
        `Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Ensure database directory exists with proper permissions
   */
  private ensureDatabaseDirectory(): void {
    const dbDir = path.dirname(this.dbPath);

    try {
      if (!fs.existsSync(dbDir)) {
        dbLogger.info('Creating database directory', { path: dbDir });
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Verify write permissions by creating a test file
      const testFile = path.join(dbDir, '.write-test');
      try {
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        dbLogger.debug('Database directory is writable');
      } catch (error) {
        dbLogger.error('Permission test failed', error);
        throw new Error(`Database directory is not writable: ${dbDir}`);
      }
    } catch (error) {
      dbLogger.error('Failed to create database directory', { error, path: dbDir });
      throw error;
    }
  }

  /**
   * Open database connection with error recovery
   */
  private openDatabase(): Database.Database {
    try {
      const db = new Database(this.dbPath, {
        verbose: configManager.get('isDevelopment') ? dbLogger.debug.bind(dbLogger) : undefined,
      });

      dbLogger.info('Database connection opened', { path: this.dbPath });
      return db;
    } catch (error) {
      // Handle corruption
      if (error instanceof Error && error.message.includes('corrupt')) {
        dbLogger.error('Database corruption detected', error);
        return this.handleCorruption();
      }

      throw error;
    }
  }

  /**
   * Configure database settings
   *
   * - WAL mode for better concurrency
   * - Foreign keys enabled
   * - Busy timeout for lock handling
   */
  private configureDatabase(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Enable WAL mode (Write-Ahead Logging)
      this.db.pragma('journal_mode = WAL');
      dbLogger.debug('WAL mode enabled');

      // Enable foreign key constraints
      this.db.pragma('foreign_keys = ON');
      dbLogger.debug('Foreign keys enabled');

      // Set busy timeout (wait up to 5 seconds for locks)
      // This is the built-in SQLite retry mechanism
      this.db.pragma('busy_timeout = 5000');
      dbLogger.debug('Busy timeout set to 5000ms');

      // Synchronous mode: FULL (maximum safety)
      this.db.pragma('synchronous = FULL');
      dbLogger.debug('Synchronous mode set to FULL');
    } catch (error) {
      dbLogger.error('Failed to configure database', error);
      throw error;
    }
  }

  /**
   * Verify database integrity
   *
   * Runs SQLite's check to detect corruption.
   * Optimized: Runs deep 'integrity_check' ONLY on crash.
   * Runs faster 'quick_check' on normal startup.
   */
  private verifyIntegrity(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Use quick_check for normal startup, integrity_check for crash recovery
      const pragma = this.wasCrashDetected ? 'integrity_check' : 'quick_check';
      const result = this.db.pragma(pragma) as Array<{ [key: string]: string }>;

      const status =
        result[0][pragma] || (result[0] as any).integrity_check || (result[0] as any).quick_check;

      if (status === 'ok') {
        dbLogger.info(`Database ${pragma} passed`);
        this.lastIntegrityCheck = { ok: true };
      } else {
        const message = `Database ${pragma} failed: ${JSON.stringify(result)}`;
        dbLogger.error(message);
        this.lastIntegrityCheck = { ok: false, message };

        // If check fails, attempt recovery
        this.handleCorruption();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown integrity error';
      dbLogger.error('Integrity check error', error);
      this.lastIntegrityCheck = { ok: false, message };
      throw error;
    }
  }

  /**
   * Handle database corruption
   */
  private handleCorruption(): Database.Database {
    dbLogger.error('Attempting to recover from database corruption');

    try {
      // Close existing connection if any
      if (this.db) {
        this.db.close();
      }

      // Backup corrupted database
      const backupPath = `${this.dbPath}.corrupted.${Date.now()}.bak`;
      if (fs.existsSync(this.dbPath)) {
        fs.copyFileSync(this.dbPath, backupPath);
        dbLogger.info('Corrupted database backed up', { backupPath });
      }

      // Delete corrupted database and WAL files
      [this.dbPath, `${this.dbPath}-wal`, `${this.dbPath}-shm`].forEach((file) => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });

      // Create new database
      const newDb = new Database(this.dbPath);
      this.db = newDb;
      this.configureDatabase();
      dbLogger.info('New database created after corruption recovery');

      return newDb;
    } catch (error) {
      dbLogger.error('Failed to recover from corruption', error);
      throw new Error('Database corruption recovery failed');
    }
  }

  /**
   * Get database instance
   */
  public getDatabase(): Database.Database {
    if (!this.db || !this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    return this.db;
  }

  /**
   * Close database connection
   */
  public close(): void {
    if (this.db) {
      const db = this.db;
      try {
        // Checkpoint WAL file before closing (attempt)
        try {
          db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (pragmaError) {
          dbLogger.warn('WAL checkpoint failed during close, proceeding to close', pragmaError);
        }

        db.close();
        dbLogger.info('Database connection closed');
      } catch (error) {
        dbLogger.error('Error closing database', error);
      } finally {
        this.db = null;
        this.isInitialized = false;
      }
    }
  }

  /**
   * Execute a function within a transaction with retries for "database is locked"
   */
  public transaction<T>(fn: () => T): T {
    return this.runWithRetry(() => {
      const db = this.getDatabase();
      const transaction = db.transaction(fn);
      return transaction();
    });
  }

  /**
   * Wrapper to run database operations with a simple retry mechanism for SQLITE_BUSY
   */
  public runWithRetry<T>(operation: () => T, maxRetries = 3, delayMs = 100): T {
    let lastError: Error | unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return operation();
      } catch (error) {
        lastError = error;

        // Check if error is "database is locked" (SQLITE_BUSY)
        const isLocked =
          error instanceof Error &&
          ((error as { code?: string }).code === 'SQLITE_BUSY' || error.message.includes('locked'));

        if (isLocked) {
          dbLogger.warn(
            `Database busy (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`
          );

          if (attempt < maxRetries) {
            // Synchronous wait (since better-sqlite3 is synchronous)
            const start = Date.now();
            while (Date.now() - start < delayMs) {
              /* wait */
            }
            continue;
          }
        }

        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Get database status for health monitoring
   */
  public getStatus(): {
    initialized: boolean;
    integrityOk: boolean;
    wasCrashDetected: boolean;
    error?: string;
  } {
    return {
      initialized: this.isInitialized,
      integrityOk: this.lastIntegrityCheck?.ok ?? false,
      wasCrashDetected: this.wasCrashDetected,
      error: this.lastIntegrityCheck?.message,
    };
  }

  /**
   * Get database file path
   */
  public getDatabasePath(): string {
    return this.dbPath;
  }

  /**
   * Check if database is initialized
   */
  public isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }
}

// Singleton instance
export const databaseManager = new DatabaseManager();

// Export Database type for repositories
export type { Database };
