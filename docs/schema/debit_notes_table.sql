CREATE TABLE IF NOT EXISTS debit_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debit_note_number TEXT UNIQUE NOT NULL,
  purchase_id INTEGER,
  supplier_id INTEGER NOT NULL,
  total_taxable REAL NOT NULL,
  gst_total REAL NOT NULL,
  grand_total REAL NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE INDEX IF NOT EXISTS idx_debit_notes_number ON debit_notes(debit_note_number);
CREATE INDEX IF NOT EXISTS idx_debit_notes_supplier_id ON debit_notes(supplier_id);
