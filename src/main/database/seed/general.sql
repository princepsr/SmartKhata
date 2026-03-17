PRAGMA foreign_keys = OFF;

-- ==========================
-- 1. PRODUCTS (Count: 1)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i < 1000
)
INSERT INTO products (
  id, name, sku, barcode, sale_price, purchase_price, gst_percent,
  stock_qty, low_stock_alert, is_active, created_at, updated_at,
  track_inventory, is_gst_inclusive, hsn_code, uom
)
SELECT
  i,
  'Product ' || printf('%03d', i),
  'SKU-' || printf('%05d', i),
  CAST(1000000000000 + i AS TEXT),
  price,
  ROUND(price * 0.70, 2),
  CASE i % 4 WHEN 0 THEN 0 WHEN 1 THEN 5.0 WHEN 2 THEN 12.0 ELSE 18.0 END,
  CASE WHEN i % 10 = 0 THEN 5 ELSE 100 END,
  10, 1,
  datetime('now', '-' || (i % 365) || ' days'),
  datetime('now'),
  1, 1, '1234', 'Pcs'
FROM (
  SELECT i, ROUND(100 + (i * 17 % 500), 2) AS price FROM seq
);

-- ==========================
-- 2. CUSTOMERS (Count: 2)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 500
)
INSERT INTO customers (id, name, phone, balance_due, is_active, created_at, address)
SELECT
  i,
  'Customer ' || printf('%03d', i),
  '987' || printf('%07d', i),
  0, 1,
  datetime('now', '-' || (i % 365) || ' days'),
  'Address for Customer ' || i
FROM seq;

-- ==========================
-- 3. SUPPLIERS (Count: 3)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 50
)
INSERT INTO suppliers (id, name, phone, gstin, address, is_active)
SELECT
  i,
  'Supplier ' || printf('%02d', i),
  '888' || printf('%07d', i),
  '27ABCDE' || printf('%04d', i) || 'F1Z5',
  'Industrial Zone ' || i,
  1
FROM seq;

-- ==========================
-- 4. PURCHASES (Count: 4)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 200
)
INSERT INTO purchases (id, purchase_number, supplier_name, invoice_number, invoice_date, total_taxable, gst_total, grand_total)
SELECT
  i,
  'PUR-' || printf('%05d', i),
  'Supplier ' || printf('%02d', (i % 50) + 1),
  'INV-' || i,
  date('now', '-' || (i % 365) || ' days'),
  10000.00, 1800.00, 11800.00
FROM seq;

-- ==========================
-- 5. PURCHASE_ITEMS (Count: 5)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 600
)
INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, unit_price, gst_percent, line_total)
SELECT
  (i % 200) + 1,
  (i % 1000) + 1,
  'Product ' || printf('%03d', (i % 1000) + 1),
  10, 1000.00, 18.0, 11800.00
FROM seq;

-- ==========================
-- 6. PURCHASE_ORDERS (Count: 6)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 100
)
INSERT INTO purchase_orders (id, po_number, supplier_id, supplier_name_snapshot, po_date, grand_total, status)
SELECT
  i,
  'PO-' || printf('%05d', i),
  (i % 50) + 1,
  'Supplier ' || printf('%02d', (i % 50) + 1),
  date('now', '-' || (i % 30) || ' days'),
  5000.00, 'RECEIVED'
FROM seq;

-- ==========================
-- 7. PURCHASE_ORDER_ITEMS (Count: 7)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 300
)
INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, gst_percent, line_total)
SELECT
  (i % 100) + 1,
  (i % 1000) + 1,
  'Product ' || printf('%03d', (i % 1000) + 1),
  5, 1000.00, 18.0, 5900.00
FROM seq;

-- ==========================
-- 8. BILLS (Count: 8)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 1000
)
INSERT INTO bills (id, bill_number, customer_id, subtotal, gst_total, grand_total, payment_mode, created_at)
SELECT
  i,
  'BILL-' || printf('%06d', i),
  (i % 500) + 1,
  5000.00, 900.00, 5900.00,
  CASE WHEN i % 2 = 0 THEN 'cash' ELSE 'upi' END,
  datetime('now', '-' || (i % 365) || ' days')
FROM seq;

-- ==========================
-- 9. BILL_ITEMS (Count: 9)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 3000
)
INSERT INTO bill_items (bill_id, product_id, product_name_snapshot, quantity, unit_price, gst_percent, line_total)
SELECT
  (i % 1000) + 1,
  (i % 1000) + 1,
  'Product ' || printf('%03d', (i % 1000) + 1),
  2, 2500.00, 18.0, 5900.00
FROM seq;

-- ==========================
-- 10. CREDIT_NOTES (Count: 10)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 50
)
INSERT INTO credit_notes (id, credit_note_number, original_bill_id, customer_id, reason, refund_amount, created_at)
SELECT
  i, 'CN-' || printf('%05d', i), i, (i % 500) + 1, 'DEFECTIVE', 500.00, datetime('now')
FROM seq;

-- ==========================
-- 11. CREDIT_NOTE_ITEMS (Count: 11)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 100
)
INSERT INTO credit_note_items (credit_note_id, product_id, product_name_snapshot, quantity, unit_price, gst_percent, line_total)
SELECT
  (i % 50) + 1, (i % 1000) + 1, 'Product Snap', 1, 500.00, 18.0, 590.00
FROM seq;

-- ==========================
-- 12. DEBIT_NOTES (Count: 12)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 50
)
INSERT INTO debit_notes (id, debit_note_number, purchase_id, supplier_id, total_taxable, gst_total, grand_total, reason)
SELECT
  i, 'DN-' || printf('%05d', i), i, (i % 50) + 1, 1000.00, 180.00, 1180.00, 'PURCHASE_RETURN'
FROM seq;

-- ==========================
-- 13. DEBIT_NOTE_ITEMS (Count: 13)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 100
)
INSERT INTO debit_note_items (debit_note_id, product_id, product_name, quantity, unit_price, gst_percent, line_total)
SELECT
  (i % 50) + 1, (i % 1000) + 1, 'Product ' || (i % 1000) + 1, 1, 1000.00, 18.0, 1180.00
FROM seq;

-- ==========================
-- 14. QUOTATIONS (Count: 14)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 80
)
INSERT INTO quotations (id, quotation_number, customer_id, customer_name_snapshot, total_taxable, gst_total, grand_total, status)
SELECT
  i, 'QTN-' || printf('%05d', i), (i % 500) + 1, 'Customer Name', 5000.00, 900.00, 5900.00, 'PENDING'
FROM seq;

-- ==========================
-- 15. QUOTATION_ITEMS (Count: 15)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 200
)
INSERT INTO quotation_items (quotation_id, product_id, product_name, quantity, unit_price, gst_percent, line_total)
SELECT
  (i % 80) + 1, (i % 1000) + 1, 'Product ' || (i % 1000) + 1, 2, 2500.00, 18.0, 5900.00
FROM seq;

-- ==========================
-- 16. EXPENSES (Count: 16)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 150
)
INSERT INTO expenses (category, amount, date, payment_mode, notes)
SELECT
  CASE i % 3 WHEN 0 THEN 'Rent' WHEN 1 THEN 'Salary' ELSE 'Electricity' END,
  2000.00, date('now', '-' || (i % 180) || ' days'), 'cash', 'Monthly expense'
FROM seq;

-- ==========================
-- 17. INVENTORY_LOGS (Count: 17)
-- ==========================
INSERT INTO inventory_logs (product_id, change_qty, reason, reference_id, notes, created_at)
SELECT product_id, -quantity, 'SALE', bill_id, 'Sold in Bill', created_at FROM bill_items JOIN bills ON bill_items.bill_id = bills.id;

-- ==========================
-- 18. CUSTOMER_LEDGER (Count: 18)
-- ==========================
INSERT INTO customer_ledger (customer_id, amount, type, reference_id, notes, created_at)
SELECT customer_id, grand_total, 'SALE', id, 'Bill Payment Due', created_at FROM bills;

-- ==========================
-- 19. SUPPLIER_LEDGER (Count: 19)
-- ==========================
INSERT INTO supplier_ledger (supplier_id, amount, type, reference_id, notes, created_at)
SELECT (id % 50) + 1, grand_total, 'PURCHASE', id, 'Purchase payment', created_at FROM purchases;

PRAGMA foreign_keys = ON;