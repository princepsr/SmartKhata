-- Migration: Credit Notes (Sales Returns)
-- Version: 025
-- Description: Creates credit_notes and credit_note_items tables for
--              managing sales returns and reversing GST on returned goods.

-- ============================================
-- CREDIT NOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS credit_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  credit_note_number TEXT UNIQUE NOT NULL,        -- e.g. CN-20260226-0001
  original_bill_id INTEGER,                       -- Original bill being reversed (nullable for manual CNs)
  original_bill_number TEXT,                      -- Snapshot of original bill number
  customer_id INTEGER,                            -- Customer (if applicable)
  reason TEXT NOT NULL,                           -- Return reason: 'DEFECTIVE', 'EXCESS', 'WRONG_ITEM', 'OTHER'
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

-- ============================================
-- CREDIT NOTE ITEMS TABLE
-- ============================================
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
