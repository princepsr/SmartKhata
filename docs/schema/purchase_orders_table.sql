CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number TEXT UNIQUE NOT NULL,
  supplier_id INTEGER NOT NULL,
  supplier_name_snapshot TEXT NOT NULL,
  po_date TEXT NOT NULL, -- YYYY-MM-DD
  total_taxable REAL NOT NULL DEFAULT 0,
  gst_total REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'RECEIVED', 'CANCELLED')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_po_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_date ON purchase_orders(po_date);
