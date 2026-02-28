-- Migration: Pro Features Schema Extensions
-- Version: 029
-- Description: Adds schema support for Pro modules (Suppliers, Expenses, Quotations, Debit Notes), B2B fields, and Medical/Kirana specialization.

-- ============================================
-- 1. ENHANCE PRODUCTS (Specialization Support)
-- ============================================
ALTER TABLE products ADD COLUMN batch_number TEXT;
ALTER TABLE products ADD COLUMN expiry_date TEXT; -- YYYY-MM-DD
ALTER TABLE products ADD COLUMN salt_name TEXT;   -- For medical generic search
ALTER TABLE products ADD COLUMN uom TEXT DEFAULT 'Pcs'; -- Kg, Ltr, Pcs, Strip, etc.
ALTER TABLE products ADD COLUMN is_weight_based INTEGER DEFAULT 0; -- 0 or 1
ALTER TABLE products ADD COLUMN strip_size INTEGER DEFAULT 1;      -- For medical fractional sales
ALTER TABLE products ADD COLUMN drug_category TEXT; -- e.g., 'Schedule H', 'Narcotic', 'General'
ALTER TABLE products ADD COLUMN last_sale_date TEXT; -- YYYY-MM-DD
ALTER TABLE products ADD COLUMN variant_group_id TEXT; -- For garments variant grouping

CREATE INDEX IF NOT EXISTS idx_products_drug_category ON products(drug_category);
CREATE INDEX IF NOT EXISTS idx_products_last_sale ON products(last_sale_date);
CREATE INDEX IF NOT EXISTS idx_products_variant_group ON products(variant_group_id);

-- ============================================
-- 2. ENHANCE CUSTOMERS (B2B Support)
-- ============================================
ALTER TABLE customers ADD COLUMN gstin TEXT;
ALTER TABLE customers ADD COLUMN billing_address TEXT;
ALTER TABLE customers ADD COLUMN shipping_address TEXT;

-- ============================================
-- 3. SUPPLIERS TABLE (Procurement)
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  gstin TEXT,
  address TEXT,
  email TEXT,
  balance_due REAL DEFAULT 0, -- Positive = we owe them
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers(phone);

-- ============================================
-- 4. EXPENSES TABLE (P&L Accuracy)
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL, -- Rent, Salary, Electricity, etc.
  amount REAL NOT NULL CHECK(amount >= 0),
  date TEXT NOT NULL,    -- YYYY-MM-DD
  payment_mode TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- ============================================
-- 5. QUOTATIONS / ESTIMATES
-- ============================================
CREATE TABLE IF NOT EXISTS quotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER,
  customer_name_snapshot TEXT NOT NULL,
  total_taxable REAL NOT NULL,
  gst_total REAL NOT NULL,
  grand_total REAL NOT NULL,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'CONVERTED', 'EXPIRED', 'CANCELLED')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_id INTEGER NOT NULL,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  gst_percent REAL NOT NULL,
  line_total REAL NOT NULL,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_quotations_number ON quotations(quotation_number);
CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON quotations(customer_id);

-- ============================================
-- 6. DEBIT NOTES (Purchase Returns)
-- ============================================
CREATE TABLE IF NOT EXISTS debit_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debit_note_number TEXT UNIQUE NOT NULL,
  purchase_id INTEGER,
  supplier_id INTEGER NOT NULL,
  total_taxable REAL NOT NULL,
  gst_total REAL NOT NULL,
  grand_total REAL NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

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

CREATE INDEX IF NOT EXISTS idx_debit_notes_number ON debit_notes(debit_note_number);
CREATE INDEX IF NOT EXISTS idx_debit_notes_supplier_id ON debit_notes(supplier_id);
