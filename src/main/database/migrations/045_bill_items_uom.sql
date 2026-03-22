-- Migration: Add UOM Snapshot to Bill Items
-- To show "KG" or "Pcs" on printed bills for historical accuracy

ALTER TABLE bill_items ADD COLUMN uom_snapshot TEXT DEFAULT 'Pcs';
