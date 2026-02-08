/**
 * Test Database Utilities
 * 
 * Provides in-memory SQLite database setup for testing.
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Create in-memory test database with schema
 */
export function createTestDatabase(): Database.Database {
  const db = new Database(':memory:');
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  
  // Run schema
  const schemaPath = path.join(__dirname, '../../database/schema/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  
  return db;
}

/**
 * Reset test database (clear all tables)
 */
export function resetTestDatabase(db: Database.Database): void {
  // Disable foreign keys temporarily
  db.pragma('foreign_keys = OFF');
  
  // Clear all tables in correct order
  db.exec('DELETE FROM inventory_logs');
  db.exec('DELETE FROM bill_items');
  db.exec('DELETE FROM bills');
  db.exec('DELETE FROM customers');
  db.exec('DELETE FROM products');
  db.exec('DELETE FROM settings');
  db.exec('DELETE FROM license');
  
  // Reset sequences
  db.exec("DELETE FROM sqlite_sequence");
  
  // Re-enable foreign keys
  db.pragma('foreign_keys = ON');
}

/**
 * Seed test data
 */
export function seedTestData(db: Database.Database): void {
  // Products
  db.exec(`
    INSERT INTO products (name, sku, barcode, sale_price, purchase_price, gst_percent, stock_qty, low_stock_alert, is_active)
    VALUES 
      ('Coca Cola 500ml', 'COKE-500', '8901234567890', 4000, 3000, 1800, 100, 10, 1),
      ('Lays Chips', 'LAYS-001', '8901234567891', 2000, 1500, 1200, 50, 5, 1),
      ('Amul Milk 1L', 'MILK-1L', '8901234567892', 6000, 5500, 0, 30, 10, 1),
      ('Inactive Product', 'INACTIVE', '8901234567893', 1000, 800, 1800, 0, 0, 0);
  `);

  // Customers
  db.exec(`
    INSERT INTO customers (name, phone, balance_due, is_active)
    VALUES 
      ('Ramesh Kumar', '9876543210', 0, 1),
      ('Suresh Patel', '9876543211', 50000, 1),
      ('Inactive Customer', '9876543212', 0, 0);
  `);

  // Settings
  db.exec(`
    INSERT INTO settings (key, value)
    VALUES 
      ('shop_name', 'Test Shop'),
      ('gst_enabled', 'true'),
      ('default_gst_rate', '18');
  `);
}

/**
 * Get database instance for testing
 * (Singleton pattern for test suite)
 */
let testDbInstance: Database.Database | null = null;

export function getTestDatabase(): Database.Database {
  if (!testDbInstance) {
    testDbInstance = createTestDatabase();
  }
  return testDbInstance;
}

export function closeTestDatabase(): void {
  if (testDbInstance) {
    testDbInstance.close();
    testDbInstance = null;
  }
}
