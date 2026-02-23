-- Customer Ledger Migration
-- Version: 014
-- Description: Create customer_ledger table for tracking udhaar and payments

CREATE TABLE IF NOT EXISTS customer_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,                             -- In Paise (absolute amount)
  type TEXT NOT NULL CHECK(type IN ('SALE', 'PAYMENT_IN', 'PAYMENT_OUT', 'OPENING_BALANCE')),
  reference_id INTEGER,                                -- Bill ID or other reference depending on type
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer_id ON customer_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_created_at ON customer_ledger(created_at);
