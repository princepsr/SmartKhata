-- Migration: Add HSN Snapshot to Bill Items
-- Version: 027
-- Description: Adds hsn_snapshot column to bill_items to preserve HSN code at time of sale.

-- 1. Add the column
ALTER TABLE bill_items ADD COLUMN hsn_snapshot TEXT DEFAULT NULL;

-- 2. Populate existing items from products table (one-time migration)
-- This join ensures historical data gets the current HSN code if available.
UPDATE bill_items
SET hsn_snapshot = (
  SELECT hsn_code 
  FROM products 
  WHERE products.id = bill_items.product_id
)
WHERE hsn_snapshot IS NULL;
