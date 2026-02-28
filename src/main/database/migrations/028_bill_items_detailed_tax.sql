-- Migration: 028_bill_items_detailed_tax
-- Adds per-line tax breakdowns to facilitate accurate reporting and printing without re-calculation.

ALTER TABLE bill_items ADD COLUMN line_subtotal REAL DEFAULT 0;
ALTER TABLE bill_items ADD COLUMN line_gst REAL DEFAULT 0;
ALTER TABLE bill_items ADD COLUMN line_cgst REAL DEFAULT 0;
ALTER TABLE bill_items ADD COLUMN line_sgst REAL DEFAULT 0;
ALTER TABLE bill_items ADD COLUMN line_igst REAL DEFAULT 0;
