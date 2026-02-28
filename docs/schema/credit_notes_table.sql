CREATE TABLE IF NOT EXISTS credit_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  credit_note_number TEXT UNIQUE NOT NULL,        -- CN-YYYYMMDD-NNNN
  original_bill_id INTEGER,                       -- Original bill being reversed
  original_bill_number TEXT,                      -- Snapshot of original bill number
  customer_id INTEGER,                            -- Customer (if applicable)
  reason TEXT NOT NULL,                           -- Return reason: 'DEFECTIVE', 'EXCESS', etc.
  refund_amount REAL NOT NULL CHECK(refund_amount >= 0),   -- Total refund amount
  taxable_amount REAL NOT NULL DEFAULT 0,         -- Taxable value being reversed
  cgst_amount REAL NOT NULL DEFAULT 0,            -- CGST reversed
  sgst_amount REAL NOT NULL DEFAULT 0,            -- SGST reversed
  igst_amount REAL NOT NULL DEFAULT 0,            -- IGST reversed
  gst_total REAL NOT NULL DEFAULT 0,              -- Total GST reversed
  notes TEXT,                                     -- Additional notes
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (original_bill_id) REFERENCES bills(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_number ON credit_notes(credit_note_number);
CREATE INDEX IF NOT EXISTS idx_credit_notes_original_bill ON credit_notes(original_bill_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_created_at ON credit_notes(created_at);
