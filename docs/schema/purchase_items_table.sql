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

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
