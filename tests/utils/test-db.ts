/**
 * Test Database Utilities
 *
 * Provides in-memory SQLite database for testing using sql.js.
 * This is a pure JavaScript implementation that doesn't require native bindings.
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

// Wrapper to make sql.js compatible with better-sqlite3 API
export class BetterSqliteCompatibleDatabase {
  private db: SqlJsDatabase;

  constructor(db: SqlJsDatabase) {
    this.db = db;
  }

  pragma(statement: string): void {
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
      mrp INTEGER DEFAULT 0 CHECK(mrp >= 0),
      sale_price INTEGER NOT NULL CHECK(sale_price >= 0),
      purchase_price INTEGER DEFAULT 0 CHECK(purchase_price >= 0),
      gst_percent INTEGER NOT NULL DEFAULT 0 CHECK(gst_percent >= 0),
      stock_qty INTEGER NOT NULL DEFAULT 0,
      low_stock_alert INTEGER DEFAULT 0 CHECK(low_stock_alert >= 0),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Bills table
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER,
      subtotal INTEGER NOT NULL CHECK(subtotal >= 0),
      gst_total INTEGER NOT NULL DEFAULT 0 CHECK(gst_total >= 0),
      discount_amount INTEGER NOT NULL DEFAULT 0 CHECK(discount_amount >= 0),
      grand_total INTEGER NOT NULL CHECK(grand_total >= 0),
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
      unit_price INTEGER NOT NULL CHECK(unit_price >= 0),
      gst_percent INTEGER NOT NULL DEFAULT 0,
      line_total INTEGER NOT NULL CHECK(line_total >= 0),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
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

    -- Settings table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- License table
    CREATE TABLE IF NOT EXISTS license (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      license_key TEXT UNIQUE NOT NULL,
      machine_fingerprint TEXT NOT NULL,
      expires_at TEXT,
      activated_at TEXT,
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
      DELETE FROM bill_items;
      DELETE FROM bills;
      DELETE FROM inventory_logs;
      DELETE FROM products;
      DELETE FROM customers;
      DELETE FROM settings;
      DELETE FROM license;
    `);
  } catch (e) {
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
      INSERT INTO products (barcode, sku, name, brand, category, mrp, sale_price, purchase_price, gst_percent, stock_qty, low_stock_alert, is_active)
      VALUES 
        ('8901234567890', 'COKE-500', 'Coca Cola 500ml', 'Coca Cola', 'Beverages', 4000, 4000, 3000, 1800, 100, 10, 1),
        ('8901234567891', 'LAYS-001', 'Lays Chips', 'Lays', 'Snacks', 2000, 2000, 1500, 1200, 50, 5, 1),
        ('8901234567892', 'MILK-1L', 'Amul Milk 1L', 'Amul', 'Dairy', 6000, 6000, 5500, 0, 30, 10, 1),
        ('8901234567893', 'INACTIVE', 'Inactive Product', NULL, NULL, 1000, 1000, 800, 1800, 0, 0, 0);
    `);

    db.exec(`
      INSERT INTO customers (name, phone, balance_due, is_active)
      VALUES 
        ('Ramesh Kumar', '9876543210', 0, 1),
        ('Suresh Patel', '9876543211', 50000, 1),
        ('Inactive Customer', '0000000000', 0, 0);
    `);

    db.exec(`
      INSERT INTO settings (key, value)
      VALUES 
        ('shop_name', 'Test Shop'),
        ('gst_enabled', 'true'),
        ('default_gst_rate', '18');
    `);
  } catch (e) {
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
