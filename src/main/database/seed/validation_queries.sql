-- ============================================
-- VALIDATION QUERIES
-- ============================================
-- Purpose: Verify schema correctness and data integrity
-- Version: 002
-- 
-- Run these queries after seeding data to validate:
-- 1. Foreign key relationships
-- 2. Data integrity
-- 3. Calculations
-- 4. Joins

-- ============================================
-- 1. VERIFY PRODUCT DATA
-- ============================================

-- Check all products loaded
SELECT COUNT(*) as product_count FROM products;
-- Expected: 12

-- Check active products only
SELECT COUNT(*) as active_products FROM products WHERE is_active = 1;
-- Expected: 12

-- Check products with low stock
SELECT 
  id,
  name,
  stock_qty,
  low_stock_alert
FROM products
WHERE is_active = 1 
  AND low_stock_alert IS NOT NULL 
  AND stock_qty <= low_stock_alert;
-- Expected: Check if any products are below alert threshold

-- ============================================
-- 2. VERIFY CUSTOMER DATA
-- ============================================

-- Check all customers
SELECT COUNT(*) as customer_count FROM customers;
-- Expected: 5

-- Check customers with outstanding balance
SELECT 
  name,
  phone,
  balance_due,
  ROUND(balance_due / 100.0, 2) as balance_rupees
FROM customers
WHERE is_active = 1 AND balance_due > 0;
-- Expected: Suresh Patel with ₹500 balance

-- Check customers with advance payment
SELECT 
  name,
  phone,
  balance_due,
  ROUND(ABS(balance_due) / 100.0, 2) as advance_rupees
FROM customers
WHERE is_active = 1 AND balance_due < 0;
-- Expected: Mahesh Shah with ₹200 advance

-- ============================================
-- 3. VERIFY BILL DATA
-- ============================================

-- Check all bills
SELECT COUNT(*) as bill_count FROM bills;
-- Expected: 3

-- Check bill totals
SELECT 
  bill_number,
  ROUND(subtotal / 100.0, 2) as subtotal_rupees,
  ROUND(gst_total / 100.0, 2) as gst_rupees,
  ROUND(discount_amount / 100.0, 2) as discount_rupees,
  ROUND(grand_total / 100.0, 2) as grand_total_rupees,
  payment_mode
FROM bills
ORDER BY created_at;
-- Expected: 3 bills with correct totals

-- Verify bill total calculation
SELECT 
  bill_number,
  subtotal + gst_total - discount_amount as calculated_total,
  grand_total,
  CASE 
    WHEN subtotal + gst_total - discount_amount = grand_total 
    THEN 'VALID' 
    ELSE 'INVALID' 
  END as validation
FROM bills;
-- Expected: All bills should show 'VALID'

-- ============================================
-- 4. VERIFY BILL ITEMS
-- ============================================

-- Check all bill items
SELECT COUNT(*) as item_count FROM bill_items;
-- Expected: 8 items (2 + 2 + 4)

-- Check bill items with product details
SELECT 
  b.bill_number,
  bi.product_name_snapshot,
  bi.quantity,
  ROUND(bi.unit_price / 100.0, 2) as unit_price_rupees,
  bi.gst_percent / 100.0 as gst_percent,
  ROUND(bi.line_total / 100.0, 2) as line_total_rupees
FROM bill_items bi
JOIN bills b ON bi.bill_id = b.id
ORDER BY b.created_at, bi.id;
-- Expected: All 8 items with correct details

-- ============================================
-- 5. VERIFY FOREIGN KEY RELATIONSHIPS
-- ============================================

-- Bills with customer names (LEFT JOIN to include walk-ins)
SELECT 
  b.bill_number,
  COALESCE(c.name, 'Walk-in') as customer_name,
  ROUND(b.grand_total / 100.0, 2) as total_rupees
FROM bills b
LEFT JOIN customers c ON b.customer_id = c.id
ORDER BY b.created_at;
-- Expected: 3 bills, first one shows 'Walk-in'

-- Bill items with current product prices (verify snapshot)
SELECT 
  b.bill_number,
  bi.product_name_snapshot as sold_as,
  p.name as current_name,
  ROUND(bi.unit_price / 100.0, 2) as sold_price,
  ROUND(p.sale_price / 100.0, 2) as current_price,
  CASE 
    WHEN bi.unit_price = p.sale_price THEN 'SAME' 
    ELSE 'CHANGED' 
  END as price_status
FROM bill_items bi
JOIN products p ON bi.product_id = p.id
JOIN bills b ON bi.bill_id = b.id;
-- Expected: All should show 'SAME' (prices haven't changed yet)

-- ============================================
-- 6. VERIFY INVENTORY LOGS
-- ============================================

-- Check all inventory logs
SELECT COUNT(*) as log_count FROM inventory_logs;
-- Expected: 12 logs (8 sales + 2 manual + 2 adjustments)

-- Check logs by reason
SELECT 
  reason,
  COUNT(*) as count,
  SUM(change_qty) as total_change
FROM inventory_logs
GROUP BY reason;
-- Expected: SALE (8, negative), MANUAL (2, positive), ADJUSTMENT (2, mixed)

-- Verify inventory logs match bill items
SELECT 
  b.bill_number,
  bi.product_name_snapshot,
  bi.quantity as sold_qty,
  il.change_qty as logged_qty,
  CASE 
    WHEN -bi.quantity = il.change_qty THEN 'MATCH' 
    ELSE 'MISMATCH' 
  END as validation
FROM bill_items bi
JOIN bills b ON bi.bill_id = b.id
JOIN inventory_logs il ON il.reference_id = b.id AND il.product_id = bi.product_id
WHERE il.reason = 'SALE'
ORDER BY b.created_at;
-- Expected: All should show 'MATCH'

-- ============================================
-- 7. VERIFY STOCK CALCULATIONS
-- ============================================

-- Calculate stock from inventory logs
SELECT 
  p.id,
  p.name,
  p.stock_qty as current_stock,
  COALESCE(SUM(il.change_qty), 0) as calculated_stock,
  CASE 
    WHEN p.stock_qty = COALESCE(SUM(il.change_qty), 0) THEN 'MATCH' 
    ELSE 'MISMATCH' 
  END as validation
FROM products p
LEFT JOIN inventory_logs il ON il.product_id = p.id
GROUP BY p.id, p.name, p.stock_qty
HAVING p.stock_qty != COALESCE(SUM(il.change_qty), 0);
-- Expected: Empty result (all stocks should match)
-- Note: This assumes initial stock was 0 and all changes are logged

-- ============================================
-- 8. VERIFY SETTINGS
-- ============================================

-- Check all settings
SELECT COUNT(*) as setting_count FROM settings;
-- Expected: 8

-- Check critical settings
SELECT key, value FROM settings WHERE key IN ('shop_name', 'gst_enabled', 'language');
-- Expected: shop_name, gst_enabled=true, language=en

-- ============================================
-- 9. VERIFY LICENSE
-- ============================================

-- Check license exists
SELECT COUNT(*) as license_count FROM license;
-- Expected: 1

-- Check license validity
SELECT 
  license_key,
  expires_at,
  CASE 
    WHEN datetime(expires_at) > datetime('now') THEN 'VALID' 
    ELSE 'EXPIRED' 
  END as status
FROM license WHERE id = 1;
-- Expected: VALID (30 days from now)

-- ============================================
-- 10. COMPLEX QUERIES (Real-world scenarios)
-- ============================================

-- Daily sales report
SELECT 
  DATE(created_at) as sale_date,
  COUNT(*) as bill_count,
  SUM(grand_total) as total_sales_paise,
  ROUND(SUM(grand_total) / 100.0, 2) as total_sales_rupees
FROM bills
GROUP BY DATE(created_at)
ORDER BY sale_date DESC;
-- Expected: One row for 2026-02-08 with 3 bills

-- Top selling products
SELECT 
  p.name,
  SUM(bi.quantity) as total_quantity,
  COUNT(DISTINCT bi.bill_id) as bill_count,
  ROUND(SUM(bi.line_total) / 100.0, 2) as total_sales_rupees
FROM bill_items bi
JOIN products p ON bi.product_id = p.id
GROUP BY p.id, p.name
ORDER BY total_quantity DESC
LIMIT 5;
-- Expected: Top 5 products by quantity sold

-- Customer purchase history
SELECT 
  c.name,
  COUNT(b.id) as bill_count,
  ROUND(SUM(b.grand_total) / 100.0, 2) as total_spent_rupees,
  ROUND(c.balance_due / 100.0, 2) as balance_rupees
FROM customers c
LEFT JOIN bills b ON b.customer_id = c.id
WHERE c.is_active = 1
GROUP BY c.id, c.name, c.balance_due
ORDER BY total_spent_rupees DESC;
-- Expected: Customer purchase summary

-- Payment mode breakdown
SELECT 
  payment_mode,
  COUNT(*) as bill_count,
  ROUND(SUM(grand_total) / 100.0, 2) as total_rupees
FROM bills
GROUP BY payment_mode;
-- Expected: Breakdown by cash/upi/mixed

-- ============================================
-- 11. CONSTRAINT VALIDATION
-- ============================================

-- Test UNIQUE constraints (should fail)
-- INSERT INTO products (name, sku, sale_price, stock_qty) VALUES ('Test', 'BEV-001', 1000, 10);
-- Expected: Error (duplicate SKU)

-- Test CHECK constraints (should fail)
-- INSERT INTO products (name, sale_price, stock_qty) VALUES ('Test', -1000, 10);
-- Expected: Error (negative price)

-- Test FOREIGN KEY constraints (should fail)
-- DELETE FROM products WHERE id = 1;
-- Expected: Error (product has been sold)

-- Test single row license (should fail)
-- INSERT INTO license (id, license_key, expires_at, machine_fingerprint) VALUES (2, 'TEST', '2027-01-01', 'TEST');
-- Expected: Error (id must be 1)

-- ============================================
-- EXPECTED RESULTS SUMMARY
-- ============================================

/*
1. Products: 12 total, all active
2. Customers: 5 total, 1 with debt, 1 with advance
3. Bills: 3 total, all with valid totals
4. Bill Items: 8 total, all linked correctly
5. Inventory Logs: 12 total (8 sales + 2 manual + 2 adjustments)
6. Settings: 8 total
7. License: 1 valid license
8. All foreign keys working correctly
9. All constraints enforced
10. Stock calculations match inventory logs
*/
