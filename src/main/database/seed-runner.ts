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
   * Helper to resolve the seed directory path
   */
  private getSeedDir(): string {
    const possiblePaths = [
      path.join(__dirname, 'seed'), // Compiled location
      path.join(process.cwd(), 'src', 'main', 'database', 'seed'), // Dev location
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    logger.error('Seed directory not found in any expected location', {
      checkedPaths: possiblePaths,
      __dirname,
      cwd: process.cwd(),
    });
    return '';
  }

  /**
   * List available seed files
   */
  public listSeeds(): string[] {
    const seedDir = this.getSeedDir();
    if (!seedDir) {
      return [];
    }

    logger.info(`Listing seeds from: ${seedDir}`);
    const files = fs
      .readdirSync(seedDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();
    
    logger.debug(`Found ${files.length} seed files:`, { files });
    return files;
  }

  /**
   * Run seed file
   */
  public runSeed(seedFile: string, clearFirst: boolean = false): void {
    try {
      logger.info(`Running seed: ${seedFile} (ClearFirst: ${clearFirst})`);

      const seedDir = this.getSeedDir();
      if (!seedDir) {
        throw new Error('Seed directory not found');
      }

      // Ensure we have a clean filename
      const cleanFileName = path.basename(seedFile);
      const seedPath = path.join(seedDir, cleanFileName);

      if (!fs.existsSync(seedPath)) {
        throw new Error(`Seed file not found: ${seedPath}`);
      }

      const sql = fs.readFileSync(seedPath, 'utf-8');

      // Execute seed SQL in transaction
      this.db.transaction(() => {
        if (clearFirst) {
          this.clearAllData();
        }

        // Disable foreign keys temporarily for bulk seeding if needed
        this.db.exec('PRAGMA foreign_keys = OFF;');
        this.db.exec(sql);
        this.db.exec('PRAGMA foreign_keys = ON;');
      })();

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
    const seedFiles = this.listSeeds();
    logger.info(`Found ${seedFiles.length} seed files`);

    for (const seedFile of seedFiles) {
      this.runSeed(seedFile, false);
    }
  }

  /**
   * Clear all core business data (for development/testing only)
   */
  public clearAllData(): void {
    logger.warn('Clearing all core business data (Enterprise Centralized)...');

    // Executed within the outer transaction from runSeed if called from there
    this.db.exec(`
      PRAGMA foreign_keys = OFF;
      
      -- Clear all 19 core business tables
      DELETE FROM inventory_logs;
      DELETE FROM bill_items;
      DELETE FROM bills;
      DELETE FROM purchase_order_items;
      DELETE FROM purchase_orders;
      DELETE FROM purchase_items;
      DELETE FROM purchases;
      DELETE FROM quotation_items;
      DELETE FROM quotations;
      DELETE FROM debit_note_items;
      DELETE FROM debit_notes;
      DELETE FROM credit_note_items;
      DELETE FROM credit_notes;
      DELETE FROM supplier_ledger;
      DELETE FROM customer_ledger;
      DELETE FROM expenses;
      DELETE FROM customers;
      DELETE FROM suppliers;
      DELETE FROM products;
      
      -- Reset auto-increment sequences
      DELETE FROM sqlite_sequence WHERE name IN (
        'inventory_logs', 'bill_items', 'bills',
        'purchase_order_items', 'purchase_orders', 
        'purchase_items', 'purchases', 
        'quotation_items', 'quotations', 
        'debit_note_items', 'debit_notes', 
        'credit_note_items', 'credit_notes', 
        'supplier_ledger', 'customer_ledger', 
        'expenses', 'customers', 'suppliers', 'products'
      );
      
      PRAGMA foreign_keys = ON;
    `);

    logger.info('Business data cleared successfully');
  }
}
