CREATE TABLE IF NOT EXISTS customer_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('SALE', 'PAYMENT_IN', 'PAYMENT_OUT', 'OPENING_BALANCE', 'REFUND')),
  reference_id INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer_id ON customer_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_created_at ON customer_ledger(created_at);
