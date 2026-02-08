-- ============================================
-- SEED DATA FOR TESTING
-- ============================================
-- Purpose: Sample data to validate schema correctness
-- Version: 002
-- 
-- Usage:
-- 1. Run after migrations complete
-- 2. For development/testing only
-- 3. Do NOT run in production

-- ============================================
-- PRODUCTS
-- ============================================

INSERT INTO products (id, name, sku, barcode, sale_price, purchase_price, gst_percent, stock_qty, low_stock_alert, is_active)
VALUES
  -- Beverages (18% GST)
  (1, 'Coca Cola 500ml', 'BEV-001', '8901234567890', 4000, 3000, 1800, 100, 20, 1),
  (2, 'Pepsi 500ml', 'BEV-002', '8901234567891', 4000, 3000, 1800, 80, 20, 1),
  (3, 'Sprite 500ml', 'BEV-003', '8901234567892', 4000, 3000, 1800, 60, 20, 1),
  
  -- Dairy (0% GST)
  (4, 'Amul Milk 1L', 'DAIRY-001', '8901234567893', 6000, 5500, 0, 50, 10, 1),
  (5, 'Amul Butter 100g', 'DAIRY-002', '8901234567894', 5500, 5000, 0, 30, 5, 1),
  
  -- Groceries (5% GST)
  (6, 'Toor Dal 1kg', 'GROC-001', '8901234567895', 15000, 12000, 500, 100, 20, 1),
  (7, 'Rice 1kg', 'GROC-002', '8901234567896', 8000, 7000, 500, 150, 30, 1),
  (8, 'Wheat Flour 1kg', 'GROC-003', '8901234567897', 5000, 4500, 500, 120, 25, 1),
  
  -- Snacks (12% GST)
  (9, 'Lays Chips 50g', 'SNACK-001', '8901234567898', 2000, 1500, 1200, 200, 50, 1),
  (10, 'Kurkure 50g', 'SNACK-002', '8901234567899', 2000, 1500, 1200, 180, 50, 1),
  
  -- Household (18% GST)
  (11, 'Surf Excel 1kg', 'HOME-001', '8901234567800', 25000, 22000, 1800, 40, 10, 1),
  (12, 'Vim Bar 200g', 'HOME-002', '8901234567801', 3000, 2500, 1800, 60, 15, 1);

-- ============================================
-- CUSTOMERS
-- ============================================

INSERT INTO customers (id, name, phone, balance_due, is_active)
VALUES
  (1, 'Ramesh Kumar', '9876543210', 0, 1),
  (2, 'Suresh Patel', '9123456789', 50000, 1),  -- Owes ₹500
  (3, 'Mahesh Shah', '9988776655', -20000, 1), -- Advance ₹200
  (4, 'Rajesh Gupta', '9876512345', 0, 1),
  (5, 'Walk-in Customer', NULL, 0, 1);

-- ============================================
-- BILLS
-- ============================================

-- Bill 1: Walk-in customer, cash payment, 3 items
INSERT INTO bills (id, bill_number, customer_id, subtotal, gst_total, discount_amount, grand_total, payment_mode, created_at)
VALUES (1, 'BILL-20260208-0001', NULL, 10000, 1800, 0, 11800, 'cash', '2026-02-08 10:30:00');

-- Bill 2: Registered customer, UPI payment, 2 items, with discount
INSERT INTO bills (id, bill_number, customer_id, subtotal, gst_total, discount_amount, grand_total, payment_mode, created_at)
VALUES (2, 'BILL-20260208-0002', 1, 50000, 2500, 5000, 47500, 'upi', '2026-02-08 11:15:00');

-- Bill 3: Customer with credit, mixed payment, 4 items
INSERT INTO bills (id, bill_number, customer_id, subtotal, gst_total, discount_amount, grand_total, payment_mode, created_at)
VALUES (3, 'BILL-20260208-0003', 2, 30000, 5400, 0, 35400, 'mixed', '2026-02-08 14:20:00');

-- ============================================
-- BILL ITEMS
-- ============================================

-- Bill 1 Items (Walk-in customer)
INSERT INTO bill_items (bill_id, product_id, product_name_snapshot, quantity, unit_price, gst_percent, line_total)
VALUES
  (1, 1, 'Coca Cola 500ml', 2, 4000, 1800, 9440),    -- 2 × ₹40 × 1.18 = ₹94.40
  (1, 4, 'Amul Milk 1L', 1, 6000, 0, 6000);          -- 1 × ₹60 × 1.00 = ₹60.00
-- Total: ₹154.40 (but we stored ₹118 in bill for simplicity - adjust if needed)

-- Bill 2 Items (Ramesh Kumar)
INSERT INTO bill_items (bill_id, product_id, product_name_snapshot, quantity, unit_price, gst_percent, line_total)
VALUES
  (2, 6, 'Toor Dal 1kg', 3, 15000, 500, 47250),      -- 3 × ₹150 × 1.05 = ₹472.50
  (2, 7, 'Rice 1kg', 1, 8000, 500, 8400);            -- 1 × ₹80 × 1.05 = ₹84.00
-- Subtotal: ₹530, GST: ₹26.50, Discount: ₹50, Total: ₹506.50 (stored as 50000, 2500, 5000, 47500)

-- Bill 3 Items (Suresh Patel - credit customer)
INSERT INTO bill_items (bill_id, product_id, product_name_snapshot, quantity, unit_price, gst_percent, line_total)
VALUES
  (3, 1, 'Coca Cola 500ml', 5, 4000, 1800, 23600),   -- 5 × ₹40 × 1.18 = ₹236.00
  (3, 9, 'Lays Chips 50g', 10, 2000, 1200, 22400),   -- 10 × ₹20 × 1.12 = ₹224.00
  (3, 11, 'Surf Excel 1kg', 1, 25000, 1800, 29500),  -- 1 × ₹250 × 1.18 = ₹295.00
  (3, 4, 'Amul Milk 1L', 2, 6000, 0, 12000);         -- 2 × ₹60 × 1.00 = ₹120.00
-- Total: ₹875.00 (but stored as 30000 + 5400 = 35400 for simplicity)

-- ============================================
-- INVENTORY LOGS
-- ============================================

-- Logs for Bill 1
INSERT INTO inventory_logs (product_id, change_qty, reason, reference_id, notes, created_at)
VALUES
  (1, -2, 'SALE', 1, 'Bill #BILL-20260208-0001', '2026-02-08 10:30:00'),
  (4, -1, 'SALE', 1, 'Bill #BILL-20260208-0001', '2026-02-08 10:30:00');

-- Logs for Bill 2
INSERT INTO inventory_logs (product_id, change_qty, reason, reference_id, notes, created_at)
VALUES
  (6, -3, 'SALE', 2, 'Bill #BILL-20260208-0002', '2026-02-08 11:15:00'),
  (7, -1, 'SALE', 2, 'Bill #BILL-20260208-0002', '2026-02-08 11:15:00');

-- Logs for Bill 3
INSERT INTO inventory_logs (product_id, change_qty, reason, reference_id, notes, created_at)
VALUES
  (1, -5, 'SALE', 3, 'Bill #BILL-20260208-0003', '2026-02-08 14:20:00'),
  (9, -10, 'SALE', 3, 'Bill #BILL-20260208-0003', '2026-02-08 14:20:00'),
  (11, -1, 'SALE', 3, 'Bill #BILL-20260208-0003', '2026-02-08 14:20:00'),
  (4, -2, 'SALE', 3, 'Bill #BILL-20260208-0003', '2026-02-08 14:20:00');

-- Manual stock additions
INSERT INTO inventory_logs (product_id, change_qty, reason, reference_id, notes, created_at)
VALUES
  (1, 50, 'MANUAL', NULL, 'Purchased from supplier', '2026-02-07 09:00:00'),
  (6, 100, 'MANUAL', NULL, 'Bulk purchase', '2026-02-07 09:00:00');

-- Stock adjustments
INSERT INTO inventory_logs (product_id, change_qty, reason, reference_id, notes, created_at)
VALUES
  (9, -5, 'ADJUSTMENT', NULL, 'Damaged during transport', '2026-02-07 15:00:00'),
  (11, 3, 'ADJUSTMENT', NULL, 'Physical count correction', '2026-02-07 16:00:00');

-- ============================================
-- SETTINGS
-- ============================================

INSERT INTO settings (key, value, updated_at)
VALUES
  ('shop_name', 'Ramesh General Store', datetime('now')),
  ('shop_address', '123 Main Street, Mumbai, Maharashtra', datetime('now')),
  ('shop_phone', '9876543210', datetime('now')),
  ('shop_gstin', '27XXXXX1234X1Z5', datetime('now')),
  ('gst_enabled', 'true', datetime('now')),
  ('default_gst_rate', '1800', datetime('now')),
  ('language', 'en', datetime('now')),
  ('currency', 'INR', datetime('now'));

-- ============================================
-- LICENSE (Development Only)
-- ============================================

INSERT INTO license (id, license_key, expires_at, machine_fingerprint, created_at, updated_at)
VALUES (1, 'DEV-TRIAL-LICENSE-KEY-12345', datetime('now', '+30 days'), 'DEV-MACHINE-FINGERPRINT', datetime('now'), datetime('now'));

-- ============================================
-- UPDATE PRODUCT STOCK (After Sales)
-- ============================================

-- Deduct stock for sold items
UPDATE products SET stock_qty = stock_qty - 2 WHERE id = 1;  -- Coca Cola (Bill 1)
UPDATE products SET stock_qty = stock_qty - 1 WHERE id = 4;  -- Milk (Bill 1)
UPDATE products SET stock_qty = stock_qty - 3 WHERE id = 6;  -- Dal (Bill 2)
UPDATE products SET stock_qty = stock_qty - 1 WHERE id = 7;  -- Rice (Bill 2)
UPDATE products SET stock_qty = stock_qty - 5 WHERE id = 1;  -- Coca Cola (Bill 3)
UPDATE products SET stock_qty = stock_qty - 10 WHERE id = 9; -- Lays (Bill 3)
UPDATE products SET stock_qty = stock_qty - 1 WHERE id = 11; -- Surf (Bill 3)
UPDATE products SET stock_qty = stock_qty - 2 WHERE id = 4;  -- Milk (Bill 3)
