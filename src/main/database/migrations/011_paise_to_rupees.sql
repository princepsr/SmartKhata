-- Migration: Paise to Rupees
-- Version: 011
-- Description: Convert price columns from Paise (INTEGER) to Rupees (DECIMAL/REAL) and GST basis points to percentage.

-- 1. PRODUCTS TABLE
-- sale_price: integer paise -> decimal rupees
-- purchase_price: integer paise -> decimal rupees
-- gst_percent: basis points (1800) -> percentage (18.0)
-- Only run if gst_percent looks like basis points (> 100) or if we haven't converted yet
UPDATE products 
SET 
  sale_price = sale_price / 100.0,
  purchase_price = CASE WHEN purchase_price IS NOT NULL THEN purchase_price / 100.0 ELSE NULL END,
  gst_percent = gst_percent / 100.0,
  updated_at = datetime('now')
WHERE EXISTS (SELECT 1 FROM products WHERE gst_percent > 100 OR sale_price > 1000 LIMIT 1);

-- 2. CUSTOMERS TABLE
-- balance_due: integer paise -> decimal rupees
UPDATE customers
SET 
  balance_due = balance_due / 100.0,
  updated_at = datetime('now')
WHERE EXISTS (SELECT 1 FROM products WHERE gst_percent > 100 OR sale_price > 1000 LIMIT 1);

-- 3. BILLS TABLE
-- subtotal, gst_total, discount_amount, grand_total: integer paise -> decimal rupees
UPDATE bills
SET 
  subtotal = subtotal / 100.0,
  gst_total = gst_total / 100.0,
  discount_amount = discount_amount / 100.0,
  grand_total = grand_total / 100.0
WHERE EXISTS (SELECT 1 FROM products WHERE gst_percent > 100 OR sale_price > 1000 LIMIT 1);

-- 4. BILL_ITEMS TABLE
-- unit_price, line_total: integer paise -> decimal rupees
-- gst_percent: basis points (1800) -> percentage (18.0)
UPDATE bill_items
SET 
  unit_price = unit_price / 100.0,
  line_total = line_total / 100.0,
  gst_percent = gst_percent / 100.0
WHERE EXISTS (SELECT 1 FROM products WHERE gst_percent > 100 OR sale_price > 1000 LIMIT 1);
