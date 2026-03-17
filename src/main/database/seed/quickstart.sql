PRAGMA foreign_keys = OFF;

-- ==========================
-- 1. PRODUCTS (Count: 15)
-- ==========================
INSERT INTO products (id, name, sku, barcode, sale_price, purchase_price, gst_percent, stock_qty, low_stock_alert, is_active, track_inventory, is_gst_inclusive, created_at, updated_at)
VALUES
  (1, 'Coca Cola 500ml', 'BEV-001', '8901234567890', 40.00, 30.00, 18.0, 100, 20, 1, 1, 1, datetime('now'), datetime('now')),
  (2, 'Pepsi 500ml', 'BEV-002', '8901234567891', 40.00, 30.00, 18.0, 80, 20, 1, 1, 1, datetime('now'), datetime('now')),
  (3, 'Amul Milk 1L', 'DAIRY-001', '8901234567893', 60.00, 55.00, 0, 50, 10, 1, 1, 1, datetime('now'), datetime('now')),
  (4, 'Amul Butter 100g', 'DAIRY-002', '8901234567894', 55.00, 50.00, 0, 30, 5, 1, 1, 1, datetime('now'), datetime('now')),
  (5, 'Toor Dal 1kg', 'GROC-001', '8901234567895', 150.00, 120.00, 5.0, 100, 20, 1, 1, 1, datetime('now'), datetime('now')),
  (6, 'Rice Premium 1kg', 'GROC-002', '8901234567896', 80.00, 70.00, 5.0, 150, 30, 1, 1, 1, datetime('now'), datetime('now')),
  (7, 'Wheat Flour 5kg', 'GROC-003', '8901234567897', 240.00, 210.00, 5.0, 40, 10, 1, 1, 1, datetime('now'), datetime('now')),
  (8, 'Lays Magic Masala', 'SNACK-001', '8901234567898', 20.00, 15.00, 12.0, 200, 50, 1, 1, 1, datetime('now'), datetime('now')),
  (9, 'Kurkure Masala 50g', 'SNACK-002', '8901234567899', 20.00, 15.00, 12.0, 180, 50, 1, 1, 1, datetime('now'), datetime('now')),
  (10, 'Surf Excel 1kg', 'HOME-001', '8901234567800', 250.00, 220.00, 18.0, 40, 10, 1, 1, 1, datetime('now'), datetime('now')),
  (11, 'Vim Gel 250ml', 'HOME-002', '8901234567801', 55.00, 45.00, 18.0, 60, 15, 1, 1, 1, datetime('now'), datetime('now')),
  (12, 'Tata Salt 1kg', 'GROC-004', '8901234567802', 25.00, 20.00, 0, 100, 20, 1, 1, 1, datetime('now'), datetime('now')),
  (13, 'Parle-G 250g', 'SNACK-003', '8901234567803', 30.00, 25.00, 5.0, 120, 30, 1, 1, 1, datetime('now'), datetime('now')),
  (14, 'Maggi Noodles 70g', 'SNACK-004', '8901234567804', 14.00, 11.00, 5.0, 300, 50, 1, 1, 1, datetime('now'), datetime('now')),
  (15, 'Dettol Soap 125g', 'HOME-003', '8901234567805', 45.00, 38.00, 18.0, 80, 20, 1, 1, 1, datetime('now'), datetime('now'));

-- ==========================
-- 2. CUSTOMERS (Count: 5)
-- ==========================
INSERT INTO customers (id, name, phone, balance_due, is_active, created_at, address)
VALUES
  (1, 'Ramesh Kumar', '9876543210', 0, 1, datetime('now'), '123, Gandhi Nagar, Mumbai'),
  (2, 'Suresh Patel', '9123456789', 500.00, 1, datetime('now'), '45, Station Road, Ahmedabad'),
  (3, 'Mahesh Shah', '9988776655', -200.00, 1, datetime('now'), 'B/12, Galaxy Apt, Pune'),
  (4, 'Rajesh Gupta', '9876512345', 0, 1, datetime('now'), 'Flat 104, Sunrise Residency, Delhi'),
  (5, 'Anita Sharma', '9112233445', 0, 1, datetime('now'), '7, Park View, Lucknow');

-- ==========================
-- 3. SUPPLIERS (Count: 3)
-- ==========================
INSERT INTO suppliers (id, name, phone, gstin, address, is_active)
VALUES
  (1, 'Global Provisions Ltd', '9991112223', '27ABCDE1234F1Z5', 'Industrial Area, Mumbai', 1),
  (2, 'Quality Dairy Hub', '9994445556', '24FGHIJ5678K1Z2', 'Anand GIDC, Gujarat', 1),
  (3, 'Metro Wholesale', '9997778889', '07KLMNO9012P1Z3', 'Okhla Phase 3, Delhi', 1);

-- ==========================
-- 4. PURCHASES (Count: 2)
-- ==========================
INSERT INTO purchases (id, purchase_number, supplier_name, invoice_number, invoice_date, total_taxable, gst_total, grand_total)
VALUES
  (1, 'PUR-20260301-0001', 'Global Provisions Ltd', 'INV-G-101', '2026-03-01', 9523.81, 476.19, 10000.00),
  (2, 'PUR-20260305-0002', 'Metro Wholesale', 'INV-M-552', '2026-03-05', 18644.07, 3355.93, 22000.00);

-- ==========================
-- 5. PURCHASE_ITEMS (Count: 4)
-- ==========================
INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, unit_price, gst_percent, line_taxable, line_total)
VALUES
  (1, 1, 'Coca Cola 500ml', 100, 30.00, 18.0, 3000.00, 3540.00),
  (1, 5, 'Toor Dal 1kg', 50, 120.00, 5.0, 6000.00, 6300.00),
  (2, 10, 'Surf Excel 1kg', 80, 220.00, 18.0, 17600.00, 20768.00),
  (2, 14, 'Maggi Noodles 70g', 100, 11.00, 5.0, 1100.00, 1155.00);

-- ==========================
-- 6. PURCHASE_ORDERS (Count: 1)
-- ==========================
INSERT INTO purchase_orders (id, po_number, supplier_id, supplier_name_snapshot, po_date, grand_total, status)
VALUES
  (1, 'PO-20260310-0001', 1, 'Global Provisions Ltd', '2026-03-10', 5000.00, 'PENDING');

-- ==========================
-- 7. PURCHASE_ORDER_ITEMS (Count: 2)
-- ==========================
INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, gst_percent, line_total)
VALUES
  (1, 6, 'Rice Premium 1kg', 20, 70.00, 5.0, 1470.00),
  (1, 12, 'Tata Salt 1kg', 50, 20.00, 0, 1000.00);

-- ==========================
-- 8. BILLS (Count: 5)
-- ==========================
INSERT INTO bills (id, bill_number, customer_id, subtotal, gst_total, discount_amount, grand_total, payment_mode, created_at)
VALUES
  (1, 'BILL-20260315-0001', NULL, 100.00, 18.00, 0, 118.00, 'cash', '2026-03-15 10:30:00'),
  (2, 'BILL-20260315-0002', 1, 500.00, 25.00, 50.00, 475.00, 'upi', '2026-03-15 11:15:00'),
  (3, 'BILL-20260316-0003', 2, 300.00, 54.00, 0, 354.00, 'mixed', '2026-03-16 14:20:00'),
  (4, 'BILL-20260317-0004', 5, 250.00, 45.00, 0, 295.00, 'cash', '2026-03-17 09:45:00'),
  (5, 'BILL-20260317-0005', NULL, 120.00, 0, 0, 120.00, 'upi', '2026-03-17 19:10:00');

-- ==========================
-- 9. BILL_ITEMS (Count: 10)
-- ==========================
INSERT INTO bill_items (bill_id, product_id, product_name_snapshot, quantity, unit_price, gst_percent, line_total)
VALUES
  (1, 1, 'Coca Cola 500ml', 2, 40.00, 18.0, 94.40),
  (1, 3, 'Amul Milk 1L', 1, 60.00, 0, 60.00),
  (2, 5, 'Toor Dal 1kg', 3, 150.00, 5.0, 472.50),
  (2, 8, 'Lays Magic Masala', 5, 20.00, 12.0, 112.00),
  (3, 11, 'Vim Gel 250ml', 4, 55.00, 18.0, 259.60),
  (3, 15, 'Dettol Soap 125g', 2, 45.00, 18.0, 106.20),
  (4, 10, 'Surf Excel 1kg', 1, 250.00, 18.0, 295.00),
  (5, 12, 'Tata Salt 1kg', 2, 25.00, 0, 50.00),
  (5, 13, 'Parle-G 250g', 2, 30.00, 5.0, 63.00),
  (5, 14, 'Maggi Noodles 70g', 2, 14.00, 5.0, 29.40);

-- ==========================
-- 10. CREDIT_NOTES (Count: 1)
-- ==========================
INSERT INTO credit_notes (id, credit_note_number, original_bill_id, customer_id, reason, refund_amount, created_at)
VALUES
  (1, 'CN-20260317-0001', 3, 2, 'DAMAGE_ON_DELIVERY', 100.00, datetime('now'));

-- ==========================
-- 11. CREDIT_NOTE_ITEMS (Count: 1)
-- ==========================
INSERT INTO credit_note_items (credit_note_id, product_id, product_name_snapshot, quantity, unit_price, gst_percent, line_total)
VALUES
  (1, 11, 'Vim Gel 250ml', 1, 55.00, 18.0, 64.90);

-- ==========================
-- 12. DEBIT_NOTES (Count: 1)
-- ==========================
INSERT INTO debit_notes (id, debit_note_number, purchase_id, supplier_id, total_taxable, gst_total, grand_total, reason)
VALUES
  (1, 'DN-20260317-0001', 1, 1, 150.00, 27.00, 177.00, 'EXPIRED_BATCH');

-- ==========================
-- 13. DEBIT_NOTE_ITEMS (Count: 1)
-- ==========================
INSERT INTO debit_note_items (debit_note_id, product_id, product_name, quantity, unit_price, gst_percent, line_total)
VALUES
  (1, 1, 'Coca Cola 500ml', 5, 30.00, 18.0, 177.00);

-- ==========================
-- 14. QUOTATIONS (Count: 1)
-- ==========================
INSERT INTO quotations (id, quotation_number, customer_id, customer_name_snapshot, total_taxable, gst_total, grand_total, status)
VALUES
  (1, 'QTN-20260318-0001', 4, 'Rajesh Gupta', 500.00, 90.00, 590.00, 'PENDING');

-- ==========================
-- 15. QUOTATION_ITEMS (Count: 1)
-- ==========================
INSERT INTO quotation_items (quotation_id, product_id, product_name, quantity, unit_price, gst_percent, line_total)
VALUES
  (1, 10, 'Surf Excel 1kg', 2, 250.00, 18.0, 590.00);

-- ==========================
-- 16. EXPENSES (Count: 3)
-- ==========================
INSERT INTO expenses (category, amount, date, payment_mode, notes)
VALUES
  ('Electricity', 1200.00, date('now', '-5 days'), 'upi', 'Feb Bill'),
  ('Rent', 15000.00, date('now', '-18 days'), 'cash', 'Shop Rent'),
  ('Maintenance', 500.00, date('now', '-2 days'), 'cash', 'Cleaning');

-- ==========================
-- 17. INVENTORY_LOGS
-- ==========================
-- Stock additions from purchases
INSERT INTO inventory_logs (product_id, change_qty, reason, reference_id, notes, created_at)
SELECT product_id, quantity, 'MANUAL', purchase_id, 'Purchase Inward', datetime('now', '-2 days') FROM purchase_items;

-- Stock deductions from sales
INSERT INTO inventory_logs (product_id, change_qty, reason, reference_id, notes, created_at)
SELECT product_id, -quantity, 'SALE', bill_id, 'Sale Bill', created_at FROM bill_items JOIN bills ON bill_items.bill_id = bills.id;

-- ==========================
-- 18. CUSTOMER_LEDGER
-- ==========================
INSERT INTO customer_ledger (customer_id, amount, type, reference_id, notes, created_at)
SELECT customer_id, grand_total, 'SALE', id, 'Bill Payment', created_at FROM bills WHERE customer_id IS NOT NULL;

-- ==========================
-- 19. SUPPLIER_LEDGER
-- ==========================
INSERT INTO supplier_ledger (supplier_id, amount, type, reference_id, notes, created_at)
VALUES
  (1, 10000.00, 'PURCHASE', 1, 'Inward Stock', datetime('now', '-2 days')),
  (3, 22000.00, 'PURCHASE', 2, 'Bulk Stock', datetime('now', '-1 day'));

-- ==========================
-- 20. APP_CONFIG
-- ==========================
INSERT OR REPLACE INTO app_config (id, shop_name, address, phone, gst_number, gst_enabled, updated_at)
VALUES (1, 'Ramesh General Store', '123 Main Street, Mumbai, MH', '9876543210', '27ABCDE1234F1Z5', 1, datetime('now'));

-- ==========================
-- 21. LICENSE
-- ==========================
INSERT OR REPLACE INTO license (id, license_key, activated_on, expires_on, device_id, is_trial, created_at, updated_at)
VALUES (1, 'QUICKSTART-TRIAL-KEY', datetime('now'), datetime('now', '+30 days'), 'DEV-MACHINE-001', 0, datetime('now'), datetime('now'));

PRAGMA foreign_keys = ON;
