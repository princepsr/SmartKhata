import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { configManager } from '@main/config/app-config';
import { logger } from '@main/utils/logger';

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

  constructor() {
    this.dbPath = configManager.get('databasePath');
  }

  /**
   * Initialize database connection
   * 
   * Creates database file if it doesn't exist,
   * sets up WAL mode, and verifies integrity.
   */
  public initialize(): void {
    if (this.isInitialized) {
      logger.warn('Database already initialized');
      return;
    }

    try {
      logger.info('Initializing database...', { path: this.dbPath });

      // Step 1: Ensure database directory exists
      this.ensureDatabaseDirectory();

      // Step 2: Check if this is first run
      const isFirstRun = !fs.existsSync(this.dbPath);

      // Step 3: Open database connection
      this.db = this.openDatabase();

      // Step 4: Configure database
      this.configureDatabase();

      // Step 5: Verify integrity
      this.verifyIntegrity();

      // Step 6: Run migrations (if needed)
      if (isFirstRun) {
        logger.info('First run detected - database will be initialized by migrations');
      }

      this.isInitialized = true;
      logger.info('Database initialized successfully', {
        path: this.dbPath,
        firstRun: isFirstRun,
      });
    } catch (error) {
      logger.error('Failed to initialize database', { error });
      throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensure database directory exists with proper permissions
   */
  private ensureDatabaseDirectory(): void {
    const dbDir = path.dirname(this.dbPath);

    try {
      if (!fs.existsSync(dbDir)) {
        logger.info('Creating database directory', { path: dbDir });
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Verify write permissions by creating a test file
      const testFile = path.join(dbDir, '.write-test');
      try {
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        logger.debug('Database directory is writable');
      } catch (permError) {
        throw new Error(`Database directory is not writable: ${dbDir}`);
      }
    } catch (error) {
      logger.error('Failed to create database directory', { error, path: dbDir });
      throw error;
    }
  }

  /**
   * Open database connection with error recovery
   */
  private openDatabase(): Database.Database {
    try {
      const db = new Database(this.dbPath, {
        verbose: configManager.get('isDevelopment') ? logger.debug.bind(logger) : undefined,
      });

      logger.info('Database connection opened', { path: this.dbPath });
      return db;
    } catch (error) {
      // Handle corruption
      if (error instanceof Error && error.message.includes('corrupt')) {
        logger.error('Database corruption detected', { error });
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
      // Benefits: Better concurrency, faster writes, crash recovery
      this.db.pragma('journal_mode = WAL');
      logger.debug('WAL mode enabled');

      // Enable foreign key constraints
      this.db.pragma('foreign_keys = ON');
      logger.debug('Foreign keys enabled');

      // Set busy timeout (wait up to 5 seconds for locks)
      this.db.pragma('busy_timeout = 5000');
      logger.debug('Busy timeout set to 5000ms');

      // Synchronous mode: NORMAL (good balance of safety and speed)
      this.db.pragma('synchronous = NORMAL');
      logger.debug('Synchronous mode set to NORMAL');
    } catch (error) {
      logger.error('Failed to configure database', { error });
      throw error;
    }
  }

  /**
   * Verify database integrity
   * 
   * Runs SQLite's integrity_check to detect corruption
   */
  private verifyIntegrity(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = this.db.pragma('integrity_check') as Array<{ integrity_check: string }>;
      
      if (result.length === 1 && result[0].integrity_check === 'ok') {
        logger.debug('Database integrity check passed');
      } else {
        logger.error('Database integrity check failed', { result });
        throw new Error('Database integrity check failed');
      }
    } catch (error) {
      logger.error('Integrity check error', { error });
      
      // If integrity check fails, attempt recovery
      if (error instanceof Error && error.message.includes('integrity')) {
        this.handleCorruption();
      } else {
        throw error;
      }
    }
  }

  /**
   * Handle database corruption
   * 
   * Strategy:
   * 1. Close current connection
   * 2. Backup corrupted file
   * 3. Create new database
   * 4. Log incident for user notification
   */
  private handleCorruption(): Database.Database {
    logger.error('Attempting to recover from database corruption');

    try {
      // Close existing connection if any
      if (this.db) {
        this.db.close();
      }

      // Backup corrupted database
      const backupPath = `${this.dbPath}.corrupted.${Date.now()}.bak`;
      if (fs.existsSync(this.dbPath)) {
        fs.copyFileSync(this.dbPath, backupPath);
        logger.info('Corrupted database backed up', { backupPath });
      }

      // Delete corrupted database and WAL files
      [this.dbPath, `${this.dbPath}-wal`, `${this.dbPath}-shm`].forEach((file) => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });

      // Create new database
      const newDb = new Database(this.dbPath);
      logger.info('New database created after corruption recovery');

      return newDb;
    } catch (error) {
      logger.error('Failed to recover from corruption', { error });
      throw new Error('Database corruption recovery failed');
    }
  }

  /**
   * Get database instance
   * 
   * @throws Error if database not initialized
   */
  public getDatabase(): Database.Database {
    if (!this.db || !this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    return this.db;
  }

  /**
   * Close database connection
   * 
   * Should be called on app shutdown
   */
  public close(): void {
    if (this.db) {
      try {
        // Checkpoint WAL file before closing
        this.db.pragma('wal_checkpoint(TRUNCATE)');
        this.db.close();
        logger.info('Database connection closed');
      } catch (error) {
        logger.error('Error closing database', { error });
      } finally {
        this.db = null;
        this.isInitialized = false;
      }
    }
  }

  /**
   * Execute a function within a transaction
   * 
   * Automatically rolls back on error
   */
  public transaction<T>(fn: () => T): T {
    const db = this.getDatabase();
    const transaction = db.transaction(fn);
    return transaction();
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
