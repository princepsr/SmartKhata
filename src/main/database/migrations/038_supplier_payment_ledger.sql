-- Migration: Supplier Payment Ledger
-- Version: 038
-- Description: Adds payment tracking to purchases and creates a supplier ledger table.

-- 1. Add payment columns to purchases
ALTER TABLE purchases ADD COLUMN payment_status TEXT DEFAULT 'PENDING' CHECK(payment_status IN ('PENDING', 'PAID', 'PARTIAL'));
ALTER TABLE purchases ADD COLUMN amount_paid REAL DEFAULT 0;

-- 2. Create supplier_ledger table
CREATE TABLE IF NOT EXISTS supplier_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL,
  amount REAL NOT NULL,                             -- Amount of transaction
  type TEXT NOT NULL CHECK(type IN ('PURCHASE', 'PAYMENT_OUT', 'OPENING_BALANCE')),
  reference_id INTEGER,                                -- Purchase ID or Payment ID
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (reference_id) REFERENCES purchases(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_supplier_ledger_supplier_id ON supplier_ledger(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_ledger_created_at ON supplier_ledger(created_at);
