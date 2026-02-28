-- Migration: ITC Purchase Tracking
-- Version: 026
-- Description: Creates tables for recording supplier purchase invoices and
--              tracking Input Tax Credit (ITC) for GST filing (GSTR-3B).

-- ============================================
-- PURCHASES TABLE (Supplier Invoices)
-- ============================================
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_number TEXT UNIQUE NOT NULL,           -- Auto-generated: PUR-YYYYMMDD-NNNN
  supplier_name TEXT NOT NULL,                    -- Supplier / vendor name
  supplier_gstin TEXT,                            -- Supplier GSTIN (optional but needed for ITC)
  invoice_number TEXT,                            -- Supplier's own invoice number
  invoice_date TEXT NOT NULL,                     -- Date of supplier invoice (YYYY-MM-DD)
  total_taxable REAL NOT NULL CHECK(total_taxable >= 0),   -- Total taxable value
  cgst_amount REAL NOT NULL DEFAULT 0,            -- Total CGST paid to supplier
  sgst_amount REAL NOT NULL DEFAULT 0,            -- Total SGST paid to supplier
  igst_amount REAL NOT NULL DEFAULT 0,            -- Total IGST paid to supplier
  gst_total REAL NOT NULL DEFAULT 0,              -- Total GST paid (ITC available)
  grand_total REAL NOT NULL CHECK(grand_total >= 0),       -- Total invoice value
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_purchases_number ON purchases(purchase_number);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_name);
CREATE INDEX IF NOT EXISTS idx_purchases_invoice_date ON purchases(invoice_date);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at);

-- ============================================
-- PURCHASE ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL,
  product_id INTEGER,                             -- Linked product (optional)
  product_name TEXT NOT NULL,                     -- Product/item name (snapshot)
  hsn_code TEXT,                                  -- HSN/SAC code
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

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
