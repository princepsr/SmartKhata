CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id INTEGER NOT NULL,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  hsn_code TEXT,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  gst_percent REAL NOT NULL,
  line_total REAL NOT NULL,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_po_items_parent ON purchase_order_items(purchase_order_id);
