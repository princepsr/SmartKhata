CREATE TABLE IF NOT EXISTS debit_note_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debit_note_id INTEGER NOT NULL,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  gst_percent REAL NOT NULL,
  line_total REAL NOT NULL,
  FOREIGN KEY (debit_note_id) REFERENCES debit_notes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_debit_note_items_parent ON debit_note_items(debit_note_id);
