/**
 * Test Database Utilities
 *
 * Provides in-memory SQLite database for testing using sql.js.
 * This is a pure JavaScript implementation that doesn't require native bindings.
 */

import { vi } from 'vitest';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

// Wrapper to make sql.js compatible with better-sqlite3 API
export class BetterSqliteCompatibleDatabase {
  private db: SqlJsDatabase;

  constructor(db: SqlJsDatabase) {
    this.db = db;
  }

  pragma(_statement: string): void {
    // sql.js doesn't support pragma the same way, but we can ignore for tests
  }

  exec(sql: string): any {
    try {
      this.db.exec(sql);
      return this;
    } catch (error) {
      console.error('SQL exec error:', error, 'SQL:', sql);
      throw error;
    }
  }

  prepare(sql: string) {
    return {
      run: (...params: any[]) => {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        stmt.step();
        const changes = this.db.getRowsModified();
        // Get last insert rowid
        const lastIdResult = this.db.exec('SELECT last_insert_rowid() as id');
        const lastInsertRowid = lastIdResult[0]?.values[0]?.[0] || 1;
        stmt.free();
        return {
          changes,
          lastInsertRowid,
        };
      },
      get: (...params: any[]) => {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all: (...params: any[]) => {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const results: any[] = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      },
    };
  }

  backup = vi.fn(async (destinationPath: string): Promise<void> => {
    // Create a dummy file so zip operations don't fail
    const fs = await import('fs');
    fs.writeFileSync(destinationPath, 'SQLite format 3\0\0\0\0\0\0\0\0\0\0');
    return Promise.resolve();
  });

  close(): void {
    this.db.close();
  }
}

let SQL: any = null;
let testDbInstance: BetterSqliteCompatibleDatabase | null = null;

/**
 * Create a test database with the required schema
 */
export async function createTestDatabase(): Promise<BetterSqliteCompatibleDatabase> {
  // Initialize sql.js if not already done
  if (!SQL) {
    SQL = await initSqlJs();
  }

  // Create a new in-memory database
  const db = new SQL.Database();

  // Create schema matching repository expectations
  const schema = `
    -- Customers table
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE,
      email TEXT,
      address TEXT,
      balance_due INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Products table
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      sku TEXT UNIQUE,
      name TEXT NOT NULL,
      brand TEXT,
      category TEXT,
      mrp REAL DEFAULT 0 CHECK(mrp >= 0),
      sale_price REAL NOT NULL CHECK(sale_price >= 0),
      purchase_price REAL DEFAULT 0 CHECK(purchase_price >= 0),
      gst_percent REAL NOT NULL DEFAULT 0 CHECK(gst_percent >= 0),
      stock_qty INTEGER NOT NULL DEFAULT 0,
      low_stock_alert INTEGER DEFAULT 0 CHECK(low_stock_alert >= 0),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
      is_gst_inclusive INTEGER NOT NULL DEFAULT 0 CHECK(is_gst_inclusive IN (0, 1)),
      track_inventory INTEGER NOT NULL DEFAULT 1 CHECK(track_inventory IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Bills table
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER,
      subtotal REAL NOT NULL CHECK(subtotal >= 0),
      gst_total REAL NOT NULL DEFAULT 0 CHECK(gst_total >= 0),
      discount_amount REAL NOT NULL DEFAULT 0 CHECK(discount_amount >= 0),
      grand_total REAL NOT NULL CHECK(grand_total >= 0),
      payment_mode TEXT NOT NULL DEFAULT 'cash' CHECK(payment_mode IN ('cash', 'upi', 'mixed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    -- Bill Items table
    CREATE TABLE IF NOT EXISTS bill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name_snapshot TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price REAL NOT NULL CHECK(unit_price >= 0),
      purchase_price REAL DEFAULT 0,
      gst_percent REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL CHECK(line_total >= 0),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- Customer Ledger table
    CREATE TABLE IF NOT EXISTS customer_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('SALE', 'PAYMENT_IN', 'PAYMENT_OUT', 'OPENING_BALANCE')),
      reference_id INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    -- Inventory Logs table
    CREATE TABLE IF NOT EXISTS inventory_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      change_qty INTEGER NOT NULL,
      reason TEXT NOT NULL,
      reference_id INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- Settings table (key-value)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- App Config table (structured)
    CREATE TABLE IF NOT EXISTS app_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      shop_name TEXT NOT NULL,
      owner_name TEXT,
      address TEXT,
      phone TEXT,
      gst_number TEXT,
      printer_name TEXT,
      paper_size TEXT DEFAULT '58mm',
      gst_enabled INTEGER DEFAULT 1,
      round_off_enabled INTEGER DEFAULT 1,
      gst_percentage INTEGER DEFAULT 5,
      show_logo INTEGER DEFAULT 0,
      show_customer_details INTEGER DEFAULT 1,
      footer_message TEXT,
      print_copies INTEGER DEFAULT 1,
      auto_print INTEGER DEFAULT 1,
      billing_only INTEGER DEFAULT 0,
      customers_enabled INTEGER DEFAULT 1,
      gst_exclusive_mode INTEGER DEFAULT 0,
      auto_update_enabled INTEGER DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- License table
    CREATE TABLE IF NOT EXISTS license (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      license_key TEXT UNIQUE NOT NULL,
      device_id TEXT NOT NULL,
      expires_on TEXT,
      activated_on TEXT,
      trial_started_on TEXT,
      is_trial INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `;

  // Execute schema
  db.exec(schema);

  const wrapped = new BetterSqliteCompatibleDatabase(db);
  testDbInstance = wrapped;
  return wrapped;
}

/**
 * Reset test database (clear all tables)
 */
export function resetTestDatabase(db: any): void {
  // Clear all tables in correct order (respecting foreign keys)
  try {
    db.exec(`
      DELETE FROM customer_ledger;
      DELETE FROM app_config;
      DELETE FROM bill_items;
      DELETE FROM bills;
      DELETE FROM inventory_logs;
      DELETE FROM products;
      DELETE FROM customers;
      DELETE FROM settings;
      DELETE FROM license;
    `);
  } catch {
    // Ignore errors if tables don't exist yet
  }
}

/**
 * Get the current test database instance
 */
export function getTestDatabase(): BetterSqliteCompatibleDatabase {
  if (!testDbInstance) {
    throw new Error('Test database not initialized. Call createTestDatabase() first.');
  }
  return testDbInstance;
}

/**
 * Seed test data with sample products and customers
 */
export function seedTestData(db: any): void {
  try {
    db.exec(`
      INSERT INTO products (barcode, sku, name, brand, category, mrp, sale_price, purchase_price, gst_percent, stock_qty, low_stock_alert, is_active, is_gst_inclusive, track_inventory)
      VALUES 
        ('8901234567890', 'COKE-500', 'Coca Cola 500ml', 'Coca Cola', 'Beverages', 40, 40, 30, 5, 100, 10, 1, 0, 1),
        ('8901234567891', 'LAYS-001', 'Lays Chips', 'Lays', 'Snacks', 20, 20, 15, 12, 50, 5, 1, 0, 1),
        ('8901234567892', 'MILK-1L', 'Amul Milk 1L', 'Amul', 'Dairy', 60, 60, 55, 0, 30, 10, 1, 0, 1),
        ('8901234567893', 'INACTIVE', 'Inactive Product', NULL, NULL, 10, 10, 8, 18, 0, 0, 0, 0, 1),
        ('8901234567894', 'MRP-PROD', 'MRP Product', NULL, NULL, 105, 105, 80, 5, 10, 0, 1, 1, 1);
    `);

    db.exec(`
      INSERT INTO customers (name, phone, balance_due, is_active)
      VALUES 
        ('Ramesh Kumar', '9876543210', 0, 1),
        ('Suresh Patel', '9876543211', 500, 1),
        ('Inactive Customer', '0000000000', 0, 0);
    `);

    db.exec(`
      INSERT INTO app_config (id, shop_name, paper_size, gst_enabled, gst_percentage, billing_only, customers_enabled, gst_exclusive_mode, auto_update_enabled)
      VALUES (1, 'Test Shop', '58mm', 1, 5, 0, 1, 0, 1);
    `);

    db.exec(`
      INSERT INTO settings (key, value)
      VALUES 
        ('shop_name', 'Test Shop'),
        ('gst_enabled', 'true'),
        ('default_gst_rate', '5');
    `);
  } catch {
    // Ignore if already seeded
  }
}

/**
 * Close test database
 */
export function closeTestDatabase(): void {
  if (testDbInstance) {
    testDbInstance.close();
    testDbInstance = null;
  }
}
