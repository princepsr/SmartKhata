-- Add purchase_price column to bill_items to record historical cost at time of sale
ALTER TABLE bill_items ADD COLUMN purchase_price INTEGER;

-- Update existing items to use current product purchase price (best effort for history)
UPDATE bill_items 
SET purchase_price = (SELECT purchase_price FROM products WHERE products.id = bill_items.product_id)
WHERE purchase_price IS NULL;
