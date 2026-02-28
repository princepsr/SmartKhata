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

CREATE INDEX IF NOT EXISTS idx_quotations_number ON quotations(quotation_number);
CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON quotations(customer_id);
