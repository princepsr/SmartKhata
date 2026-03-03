-- Migration: Update Supplier Ledger Type to support PAYMENT_IN
-- Version: 040
-- Description: Alters the supplier_ledger table to add 'PAYMENT_IN' to the type CHECK constraint

CREATE TABLE supplier_ledger_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('PURCHASE', 'PAYMENT_OUT', 'PAYMENT_IN', 'OPENING_BALANCE')),
  reference_id INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (reference_id) REFERENCES purchases(id) ON DELETE SET NULL
);

INSERT INTO supplier_ledger_new SELECT * FROM supplier_ledger;

DROP TABLE supplier_ledger;

ALTER TABLE supplier_ledger_new RENAME TO supplier_ledger;

CREATE INDEX IF NOT EXISTS idx_supplier_ledger_supplier_id ON supplier_ledger(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_ledger_created_at ON supplier_ledger(created_at);
