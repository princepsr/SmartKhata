import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { databaseManager } from './index';
import { logger } from '@main/utils/logger';
import type { Database } from 'better-sqlite3';

/**
 * Migration System
 *
 * Handles database schema migrations with version tracking,
 * checksums, and idempotent execution.
 *
 * RULES:
 * - Migrations run in order (001, 002, 003...)
 * - Each migration runs exactly once
 * - Migrations are transactional (all-or-nothing)
 * - Checksums prevent tampering
 */

interface Migration {
  version: number;
  name: string;
  filename: string;
  sql: string;
  checksum: string;
}

interface AppliedMigration {
  version: number;
  name: string;
  applied_at: string;
  checksum: string;
  execution_time_ms: number;
}

export class MigrationRunner {
  private migrationsDir: string;

  constructor() {
    this.migrationsDir = path.join(__dirname, 'migrations');
  }

  /**
   * Run all pending migrations
   *
   * Called on app startup after database initialization
   */
  public async runPendingMigrations(): Promise<void> {
    const db = databaseManager.getDatabase();

    try {
      logger.info('Checking for pending migrations...');

      // Step 1: Ensure migrations table exists
      this.ensureMigrationsTable(db);

      // Step 2: Load all migration files
      const allMigrations = this.loadMigrationFiles();

      // Step 3: Get already applied migrations
      const appliedMigrations = this.getAppliedMigrations(db);
      const appliedVersions = new Set(appliedMigrations.map((m) => m.version));

      // Step 4: Find pending migrations
      const pendingMigrations = allMigrations.filter((m) => !appliedVersions.has(m.version));

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations');
        return;
      }

      logger.info(`Found ${pendingMigrations.length} pending migration(s)`, {
        versions: pendingMigrations.map((m) => m.version),
      });

      // Step 5: Run each pending migration
      for (const migration of pendingMigrations) {
        this.runMigration(db, migration);
      }

      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration failed', { error });
      throw new Error(
        `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Ensure schema_migrations table exists
   */
  private ensureMigrationsTable(db: Database): void {
    const migrationTableSql = fs.readFileSync(
      path.join(this.migrationsDir, '000_schema_migrations.sql'),
      'utf-8'
    );

    db.exec(migrationTableSql);
    logger.debug('Migrations table ready');
  }

  /**
   * Load all migration files from disk
   */
  private loadMigrationFiles(): Migration[] {
    if (!fs.existsSync(this.migrationsDir)) {
      logger.warn('Migrations directory not found', { path: this.migrationsDir });
      return [];
    }

    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith('.sql') && f !== '000_schema_migrations.sql')
      .sort(); // Alphabetical = version order

    const migrations: Migration[] = [];

    for (const filename of files) {
      const match = filename.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        logger.warn('Invalid migration filename', { filename });
        continue;
      }

      const version = parseInt(match[1], 10);
      const name = match[2];
      const filepath = path.join(this.migrationsDir, filename);
      const sql = fs.readFileSync(filepath, 'utf-8');
      const checksum = this.calculateChecksum(sql);

      migrations.push({
        version,
        name,
        filename,
        sql,
        checksum,
      });
    }

    logger.debug(`Loaded ${migrations.length} migration file(s)`);
    return migrations;
  }

  /**
   * Get list of already applied migrations
   */
  private getAppliedMigrations(db: Database): AppliedMigration[] {
    try {
      const stmt = db.prepare(`
        SELECT version, name, applied_at, checksum, execution_time_ms
        FROM schema_migrations
        ORDER BY version ASC
      `);

      return stmt.all() as AppliedMigration[];
    } catch (error) {
      // Table might not exist yet
      return [];
    }
  }

  /**
   * Run a single migration within a transaction
   */
  private runMigration(db: Database, migration: Migration): void {
    const startTime = Date.now();

    logger.info(`Running migration ${migration.version}: ${migration.name}`);

    try {
      // Execute migration in a transaction
      databaseManager.transaction(() => {
        // Run the migration SQL
        db.exec(migration.sql);

        // Record migration in tracking table
        const stmt = db.prepare(`
          INSERT INTO schema_migrations (version, name, checksum, execution_time_ms)
          VALUES (?, ?, ?, ?)
        `);

        const executionTime = Date.now() - startTime;

        stmt.run(migration.version, migration.name, migration.checksum, executionTime);
      });

      const executionTime = Date.now() - startTime;
      logger.info(`Migration ${migration.version} completed`, {
        name: migration.name,
        executionTime: `${executionTime}ms`,
      });
    } catch (error) {
      logger.error(`Migration ${migration.version} failed`, {
        name: migration.name,
        error,
      });
      throw error;
    }
  }

  /**
   * Calculate SHA-256 checksum of migration SQL
   *
   * Prevents accidental modification of applied migrations
   */
  private calculateChecksum(sql: string): string {
    return crypto.createHash('sha256').update(sql).digest('hex');
  }

  /**
   * Verify checksums of applied migrations
   *
   * Ensures migration files haven't been modified after being applied
   */
  public verifyMigrationIntegrity(): boolean {
    const db = databaseManager.getDatabase();

    try {
      const appliedMigrations = this.getAppliedMigrations(db);
      const currentMigrations = this.loadMigrationFiles();

      for (const applied of appliedMigrations) {
        const current = currentMigrations.find((m) => m.version === applied.version);

        if (!current) {
          logger.error('Applied migration file missing', { version: applied.version });
          return false;
        }

        if (current.checksum !== applied.checksum) {
          logger.error('Migration checksum mismatch', {
            version: applied.version,
            expected: applied.checksum,
            actual: current.checksum,
          });
          return false;
        }
      }

      logger.debug('Migration integrity verified');
      return true;
    } catch (error) {
      logger.error('Migration integrity check failed', { error });
      return false;
    }
  }

  /**
   * Get current schema version
   */
  public getCurrentVersion(): number {
    const db = databaseManager.getDatabase();

    try {
      const stmt = db.prepare('SELECT MAX(version) as version FROM schema_migrations');
      const result = stmt.get() as { version: number | null };
      return result.version || 0;
    } catch (error) {
      return 0;
    }
  }
}

// Singleton instance
export const migrationRunner = new MigrationRunner();
