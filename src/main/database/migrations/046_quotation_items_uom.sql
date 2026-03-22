-- Migration: Add UOM to Quotation Items
-- To show "KG" or "Pcs" on printed quotations

ALTER TABLE quotation_items ADD COLUMN uom TEXT DEFAULT 'Pcs';
