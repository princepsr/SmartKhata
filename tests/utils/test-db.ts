/**
 * Test Database Utilities
 *
 * Provides in-memory SQLite database for testing using better-sqlite3.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

let testDbInstance: any = null;

/**
 * Create a test database with the required schema
 */
export async function createTestDatabase(): Promise<any> {
  try {
    // Create a new in-memory database
    const db = new Database(':memory:');

    // Create schema matching repository expectations
    const schema = `
    -- Customers table
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE,
      email TEXT,
      address TEXT,
      gstin TEXT,
      billing_address TEXT,
      shipping_address TEXT,
      balance_due INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Suppliers table
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE,
      email TEXT,
      address TEXT,
      gstin TEXT UNIQUE,
      balance_due REAL NOT NULL DEFAULT 0,
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
      hsn_code TEXT,
      stock_qty INTEGER NOT NULL DEFAULT 0,
      low_stock_alert INTEGER DEFAULT 0 CHECK(low_stock_alert >= 0),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
      is_gst_inclusive INTEGER NOT NULL DEFAULT 0 CHECK(is_gst_inclusive IN (0, 1)),
      track_inventory INTEGER NOT NULL DEFAULT 1 CHECK(track_inventory IN (0, 1)),
      batch_number TEXT,
      expiry_date TEXT,
      salt_name TEXT,
      uom TEXT DEFAULT 'Pcs',
      is_weight_based INTEGER NOT NULL DEFAULT 0 CHECK(is_weight_based IN (0, 1)),
      strip_size INTEGER DEFAULT 1,
      drug_category TEXT,
      last_sale_date TEXT,
      variant_group_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Bills table
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER,
      subtotal REAL NOT NULL DEFAULT 0,
      gst_total REAL NOT NULL DEFAULT 0,
      cgst_amount REAL NOT NULL DEFAULT 0,
      sgst_amount REAL NOT NULL DEFAULT 0,
      igst_amount REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      payment_mode TEXT NOT NULL DEFAULT 'cash',
      customer_gstin_snapshot TEXT,
      billing_address_snapshot TEXT,
      shipping_address_snapshot TEXT,
      is_printed INTEGER NOT NULL DEFAULT 0 CHECK(is_printed IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );

    -- Bill Items table
    CREATE TABLE IF NOT EXISTS bill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name_snapshot TEXT NOT NULL,
      hsn_snapshot TEXT,
      quantity REAL NOT NULL CHECK(quantity > 0),
      unit_price REAL NOT NULL CHECK(unit_price >= 0),
      purchase_price REAL,
      gst_percent REAL NOT NULL DEFAULT 0,
      line_subtotal REAL DEFAULT 0,
      line_gst REAL DEFAULT 0,
      line_cgst REAL DEFAULT 0,
      line_sgst REAL DEFAULT 0,
      line_igst REAL DEFAULT 0,
      line_total REAL NOT NULL CHECK(line_total >= 0),
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    -- Inventory Logs table
    CREATE TABLE IF NOT EXISTS inventory_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      change_qty INTEGER NOT NULL,
      reason TEXT NOT NULL CHECK(reason IN ('SALE', 'MANUAL', 'ADJUSTMENT')),
      reference_id INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
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

    -- Expenses table
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      amount REAL NOT NULL CHECK(amount >= 0),
      date TEXT NOT NULL, -- YYYY-MM-DD
      payment_mode TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Purchase Orders table
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT UNIQUE NOT NULL,
      supplier_id INTEGER NOT NULL,
      supplier_name_snapshot TEXT NOT NULL,
      po_date TEXT NOT NULL,
      total_taxable REAL NOT NULL DEFAULT 0,
      gst_total REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'RECEIVED', 'CANCELLED')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
    );

    -- Purchase Order Items table
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_order_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      hsn_code TEXT,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      gst_percent REAL NOT NULL,
      line_total REAL NOT NULL,
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    -- Debit Notes table
    CREATE TABLE IF NOT EXISTS debit_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debit_note_number TEXT UNIQUE NOT NULL,
      purchase_id INTEGER,
      supplier_id INTEGER NOT NULL,
      total_taxable REAL NOT NULL DEFAULT 0,
      gst_total REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    -- Debit Note Items table
    CREATE TABLE IF NOT EXISTS debit_note_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debit_note_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      gst_percent REAL NOT NULL,
      line_total REAL NOT NULL,
      FOREIGN KEY (debit_note_id) REFERENCES debit_notes(id) ON DELETE CASCADE
    );

    -- Purchases table
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_number TEXT UNIQUE NOT NULL,
      supplier_name TEXT NOT NULL,
      supplier_gstin TEXT,
      invoice_number TEXT,
      invoice_date TEXT NOT NULL,
      total_taxable REAL NOT NULL CHECK(total_taxable >= 0),
      cgst_amount REAL NOT NULL DEFAULT 0,
      sgst_amount REAL NOT NULL DEFAULT 0,
      igst_amount REAL NOT NULL DEFAULT 0,
      gst_total REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL CHECK(grand_total >= 0),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Purchase Items table
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      hsn_code TEXT,
      quantity REAL NOT NULL CHECK(quantity > 0),
      unit_price REAL NOT NULL CHECK(unit_price >= 0),
      gst_percent REAL NOT NULL DEFAULT 0 CHECK(gst_percent >= 0),
      line_taxable REAL NOT NULL DEFAULT 0,
      line_cgst REAL NOT NULL DEFAULT 0,
      line_sgst REAL NOT NULL DEFAULT 0,
      line_igst REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL CHECK(line_total >= 0),
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    -- Credit Notes table (Sales Returns)
    CREATE TABLE IF NOT EXISTS credit_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      credit_note_number TEXT UNIQUE NOT NULL,
      original_bill_id INTEGER,
      original_bill_number TEXT,
      customer_id INTEGER,
      reason TEXT NOT NULL,
      refund_amount REAL NOT NULL DEFAULT 0,
      taxable_amount REAL NOT NULL DEFAULT 0,
      cgst_amount REAL NOT NULL DEFAULT 0,
      sgst_amount REAL NOT NULL DEFAULT 0,
      igst_amount REAL NOT NULL DEFAULT 0,
      gst_total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (original_bill_id) REFERENCES bills(id) ON DELETE SET NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );

    -- Credit Note Items table
    CREATE TABLE IF NOT EXISTS credit_note_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      credit_note_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name_snapshot TEXT NOT NULL,
      hsn_code TEXT,
      quantity REAL NOT NULL CHECK(quantity > 0),
      unit_price REAL NOT NULL CHECK(unit_price >= 0),
      gst_percent REAL NOT NULL CHECK(gst_percent >= 0),
      line_taxable REAL NOT NULL DEFAULT 0,
      line_cgst REAL NOT NULL DEFAULT 0,
      line_sgst REAL NOT NULL DEFAULT 0,
      line_igst REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL CHECK(line_total >= 0),
      FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    );

    -- Settings table (Legacy support)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- App Config table (Singleton)
    CREATE TABLE IF NOT EXISTS app_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      shop_name TEXT NOT NULL DEFAULT 'SmartKhata Shop',
      owner_name TEXT,
      address TEXT,
      phone TEXT,
      gst_number TEXT,
      state_code TEXT DEFAULT '29',
      supply_type TEXT DEFAULT 'intrastate',
      place_of_supply TEXT,
      printer_name TEXT,
      paper_size TEXT DEFAULT '58mm',
      gst_enabled INTEGER DEFAULT 1,
      round_off_enabled INTEGER DEFAULT 1,
      gst_percentage REAL DEFAULT 18.0,
      show_logo INTEGER DEFAULT 0,
      show_customer_details INTEGER DEFAULT 1,
      footer_message TEXT DEFAULT 'Thank you! Visit Again',
      print_copies INTEGER DEFAULT 1,
      auto_print INTEGER DEFAULT 1,
      billing_only INTEGER DEFAULT 0,
      gst_exclusive_mode INTEGER DEFAULT 0,
      customers_enabled INTEGER DEFAULT 1,
      expenses_enabled INTEGER DEFAULT 1,
      quotations_enabled INTEGER DEFAULT 1,
      barcode_gen_enabled INTEGER DEFAULT 1,
      enable_batch_tracking INTEGER DEFAULT 0,
      upi_id TEXT,
      upi_name TEXT,
      auto_backup_enabled INTEGER DEFAULT 1,
      auto_backup_interval_days INTEGER DEFAULT 1,
      auto_backup_interval_unit TEXT DEFAULT 'days',
      auto_backup_retain_count INTEGER DEFAULT 5,
      last_auto_backup TEXT,
      google_drive_sync_enabled INTEGER DEFAULT 0,
      last_cloud_sync TEXT,
      cloud_sync_pending INTEGER DEFAULT 0,
      pending_sync_path TEXT,
      privacy_policy_accepted INTEGER DEFAULT 0,
      auto_update_enabled INTEGER DEFAULT 1,
      last_referral_banner_seen TEXT,
      app_mode TEXT DEFAULT 'GENERAL',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- License table (Singleton)
    CREATE TABLE IF NOT EXISTS license (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      license_key TEXT,
      activated_on TEXT,
      expires_on TEXT,
      device_id TEXT,
      trial_started_on TEXT,
      is_trial INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `;

    // Execute schema
    db.exec(schema);

    testDbInstance = db;
    return db;
  } catch (err: any) {
    console.error('CRITICAL: Failed to create test database:', err);
    if (err.stack) {
      console.error(err.stack);
    }
    throw err;
  }
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
      DELETE FROM credit_note_items;
      DELETE FROM credit_notes;
      DELETE FROM debit_note_items;
      DELETE FROM debit_notes;
      DELETE FROM purchase_order_items;
      DELETE FROM purchase_orders;
      DELETE FROM purchase_items;
      DELETE FROM purchases;
      DELETE FROM bill_items;
      DELETE FROM bills;
      DELETE FROM inventory_logs;
      DELETE FROM expenses;
      DELETE FROM products;
      DELETE FROM customers;
      DELETE FROM suppliers;
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
export function getTestDatabase(): any {
  if (!testDbInstance) {
    throw new Error('Test database not initialized. Call createTestDatabase() first.');
  }
  return testDbInstance;
}

/**
 * Seed test data with sample products and customers
 */
export function seedTestData(db: any): void {
  db.exec(`
    INSERT INTO products (barcode, sku, name, brand, category, mrp, sale_price, purchase_price, gst_percent, stock_qty, low_stock_alert, is_active, is_gst_inclusive, track_inventory, batch_number, expiry_date, salt_name, uom, is_weight_based, strip_size, drug_category, last_sale_date, variant_group_id)
    VALUES 
      ('8901234567890', 'COKE-500', 'Coca Cola 500ml', 'Coca Cola', 'Beverages', 40, 40, 30, 5, 100, 10, 1, 0, 1, NULL, NULL, NULL, 'Pcs', 0, 1, NULL, NULL, NULL),
      ('8901234567891', 'LAYS-001', 'Lays Chips', 'Lays', 'Snacks', 20, 20, 15, 12, 50, 5, 1, 0, 1, NULL, NULL, NULL, 'Pcs', 0, 1, NULL, NULL, NULL),
      ('8901234567892', 'MILK-1L', 'Amul Milk 1L', 'Amul', 'Dairy', 60, 60, 55, 0, 30, 10, 1, 0, 1, NULL, NULL, NULL, 'Pcs', 0, 1, NULL, NULL, NULL),
      ('8901234567893', 'INACTIVE', 'Inactive Product', NULL, NULL, 10, 10, 8, 18, 0, 0, 0, 0, 1, NULL, NULL, NULL, 'Pcs', 0, 1, NULL, NULL, NULL),
      ('8901234567894', 'MRP-PROD', 'MRP Product', NULL, NULL, 105, 105, 80, 5, 10, 0, 1, 1, 1, NULL, NULL, NULL, 'Pcs', 0, 1, NULL, NULL, NULL),
      ('MED-001', 'DOLO-650', 'Dolo 650', 'Micro Labs', 'Tablets', 30, 30, 20, 12, 100, 10, 1, 0, 1, 'BATCH001', '2026-12-31', 'Paracetamol', 'Pcs', 0, 15, 'Schedule H', NULL, NULL),
      ('MED-002', 'PAN-40', 'Pan 40', 'Alkem', 'Tablets', 150, 150, 120, 12, 50, 5, 1, 0, 1, 'BATCH002', '2026-06-30', 'Pantoprazole', 'Pcs', 0, 10, 'Schedule H', NULL, NULL),
      ('MED-003', 'EXP-DONE', 'Expired Med', 'Test', 'Tablets', 10, 10, 5, 12, 10, 0, 1, 0, 1, 'BATCH003', '2020-01-01', 'Paracetamol', 'Pcs', 0, 10, 'Schedule H', NULL, NULL),
      ('MED-004', 'EXP-SOON', 'Expiring Soon', 'Test', 'Tablets', 10, 10, 5, 12, 10, 0, 1, 0, 1, 'BATCH004', '2026-03-15', 'Paracetamol', 'Pcs', 0, 10, 'Schedule H', NULL, NULL);
  `);

  db.exec(`
    INSERT INTO suppliers (name, phone, gstin, balance_due, is_active)
    VALUES 
      ('Generic Pharma', '9000000001', '27ABCDE1234F1Z1', 0, 1),
      ('Local Distributor', '9000000002', NULL, 1500, 1),
      ('Inactive Supplier', '0000000000', NULL, 0, 0);
  `);

  db.exec(`
    INSERT INTO customers (name, phone, email, address, balance_due, is_active)
    VALUES 
      ('Ramesh Kumar', '9876543210', 'ramesh@example.com', 'Bangalore', 0, 1),
      ('Suresh Singh', '9876543211', 'suresh@example.com', 'Delhi', 500, 1),
      ('Inactive Customer', '9000000000', NULL, NULL, 0, 0);
  `);

  db.exec(`
    INSERT INTO app_config (id, shop_name, paper_size, gst_enabled, gst_percentage, billing_only, customers_enabled, gst_exclusive_mode, auto_update_enabled, supply_type)
    VALUES (1, 'Test Shop', '58mm', 1, 5, 0, 1, 0, 1, 'intrastate');
  `);

  db.exec(`
    INSERT INTO settings (key, value)
    VALUES 
      ('shop_name', 'Test Shop'),
      ('gst_enabled', 'true'),
      ('default_gst_rate', '5');
  `);

  db.exec(`
    INSERT INTO license (id, license_key, is_trial, expires_on)
    VALUES (1, '', 1, '9999-12-31');
  `);
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
