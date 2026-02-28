CREATE TABLE IF NOT EXISTS credit_note_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  credit_note_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name_snapshot TEXT NOT NULL,
  hsn_code TEXT,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price REAL NOT NULL CHECK(unit_price >= 0),
  gst_percent REAL NOT NULL CHECK(gst_percent >= 0),
  line_taxable REAL NOT NULL DEFAULT 0,           -- Taxable amount for this line
  line_cgst REAL NOT NULL DEFAULT 0,
  line_sgst REAL NOT NULL DEFAULT 0,
  line_igst REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL CHECK(line_total >= 0),
  FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_credit_note_items_cn_id ON credit_note_items(credit_note_id);
