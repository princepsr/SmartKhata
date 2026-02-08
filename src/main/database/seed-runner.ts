/**
 * ============================================
 * SEED RUNNER
 * ============================================
 * Purpose: TypeScript module to run seed data
 * Version: 002
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

export class SeedRunner {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Run seed file
   */
  public runSeed(seedFile: string): void {
    try {
      logger.info(`Running seed: ${seedFile}`);

      const seedPath = path.join(__dirname, 'seed', seedFile);
      
      if (!fs.existsSync(seedPath)) {
        throw new Error(`Seed file not found: ${seedPath}`);
      }

      const sql = fs.readFileSync(seedPath, 'utf-8');

      // Execute seed SQL in transaction
      this.db.exec(sql);

      logger.info(`Seed completed: ${seedFile}`);
    } catch (error) {
      logger.error(`Seed failed: ${seedFile}`, error);
      throw error;
    }
  }

  /**
   * Run all seed files (for development only)
   */
  public runAllSeeds(): void {
    const seedDir = path.join(__dirname, 'seed');
    
    if (!fs.existsSync(seedDir)) {
      logger.warn('Seed directory not found, skipping seeds');
      return;
    }

    const seedFiles = fs
      .readdirSync(seedDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    logger.info(`Found ${seedFiles.length} seed files`);

    for (const seedFile of seedFiles) {
      this.runSeed(seedFile);
    }
  }

  /**
   * Clear all data (for testing only)
   */
  public clearAllData(): void {
    logger.warn('Clearing all data...');

    this.db.exec(`
      DELETE FROM inventory_logs;
      DELETE FROM bill_items;
      DELETE FROM bills;
      DELETE FROM customers;
      DELETE FROM products;
      DELETE FROM settings;
      DELETE FROM license;
    `);

    logger.info('All data cleared');
  }
}
