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

CREATE INDEX IF NOT EXISTS idx_quotation_items_parent ON quotation_items(quotation_id);
