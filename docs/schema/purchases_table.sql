CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_number TEXT UNIQUE NOT NULL,           -- SUR-YYYYMMDD-NNNN
  supplier_name TEXT NOT NULL,                    -- Snapshot of vendor
  supplier_gstin TEXT,                            -- Snapshot for ITC
  invoice_number TEXT,                            -- The vendor's invoice #
  invoice_date TEXT NOT NULL,                     -- Effective tax date
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

CREATE INDEX IF NOT EXISTS idx_purchases_number ON purchases(purchase_number);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_name);
CREATE INDEX IF NOT EXISTS idx_purchases_invoice_date ON purchases(invoice_date);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at);
