PRAGMA foreign_keys = OFF;

-- ==========================
-- 1. PRODUCTS (MEDICAL - Count: 1)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 500
)
INSERT INTO products (
  id, name, sku, barcode, sale_price, purchase_price, gst_percent,
  stock_qty, low_stock_alert, is_active, track_inventory, is_gst_inclusive,
  hsn_code, batch_number, expiry_date, salt_name, uom, strip_size, drug_category
)
SELECT
  i,
  CASE (i % 5)
    WHEN 0 THEN 'Dolo 650'
    WHEN 1 THEN 'Crocin Advance'
    WHEN 2 THEN 'Azithral 500'
    WHEN 3 THEN 'Augmentin 625'
    ELSE 'Pantocid DSR'
  END || ' Tab',
  'MED-' || printf('%05d', i),
  CAST(8901000000000 + i AS TEXT),
  price,
  ROUND(price * 0.75, 2),
  CASE WHEN i % 4 = 0 THEN 12.0 ELSE 5.0 END,
  CASE WHEN i < 50 THEN 5 ELSE 100 END,
  10, 1, 1, 1, '3004',
  'B-' || printf('%04d', i),
  date('now', '+' || (i % 720) || ' days'),
  CASE (i % 5)
    WHEN 0 THEN 'Paracetamol 650mg'
    WHEN 1 THEN 'Paracetamol 500mg'
    WHEN 2 THEN 'Azithromycin 500mg'
    WHEN 3 THEN 'Amoxicillin + Clavulanic Acid'
    ELSE 'Pantoprazole + Domperidone'
  END,
  'Strip', 10,
  CASE WHEN i % 4 = 0 THEN 'SCHEDULE_H' ELSE 'GENERAL' END
FROM (
  SELECT i, ROUND(40 + (i * 23 % 400), 2) AS price FROM seq
);

-- ==========================
-- 2. CUSTOMERS (PATIENTS - Count: 2)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 200
)
INSERT INTO customers (id, name, phone, balance_due, is_active, address)
SELECT
  i, 'Patient ' || printf('%03d', i), '9' || printf('%09d', i), 0, 1, 'Street ' || i || ', Medical Colony'
FROM seq;

-- ==========================
-- 3. SUPPLIERS (PHARMA - Count: 3)
-- ==========================
INSERT INTO suppliers (id, name, phone, gstin, address, is_active)
VALUES
  (1, 'Sun Pharma Distributor', '9876543210', '27SUNPH1234A1Z1', 'Mumbai HQ', 1),
  (2, 'Cipla Wholesale', '9876543211', '27CIPLA1234A1Z2', 'Mumbai Industrial', 1),
  (3, 'Dr Reddys Medicals', '9876543212', '27REDDY1234A1Z3', 'Hyderabad Hub', 1),
  (4, 'Mankind Distributors', '9876543213', '27MANKI1234A1Z4', 'Delhi North', 1),
  (5, 'Alkem Pharma Solutions', '9876543214', '27ALKEM1234A1Z5', 'Mumbai West', 1);

-- ==========================
-- 4. PURCHASES (Count: 4)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 50
)
INSERT INTO purchases (id, purchase_number, supplier_name, invoice_number, invoice_date, total_taxable, gst_total, grand_total)
SELECT
  i, 'PUR-MED-' || printf('%04d', i), 'Supplier ' || (i % 5 + 1), 'INV-PH-' || i, date('now', '-' || (i % 365) || ' days'), 9523.81, 476.19, 10000
FROM seq;

-- ==========================
-- 5. PURCHASE_ITEMS (Count: 5)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 150
)
INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, unit_price, gst_percent, line_taxable, line_total)
SELECT
  (i % 50) + 1, (i % 500) + 1, 'Medicine ' || (i % 500) + 1, 50, 150.00, 5.0, 7500.00, 7875.00
FROM seq;

-- ==========================
-- 6. PURCHASE_ORDERS (Count: 6)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 30
)
INSERT INTO purchase_orders (id, po_number, supplier_id, supplier_name_snapshot, po_date, grand_total, status)
SELECT
  i, 'POM-' || printf('%04d', i), (i % 5) + 1, 'Supplier Snap', date('now', '-' || (i % 30) || ' days'), 8000, 'RECEIVED'
FROM seq;

-- ==========================
-- 7. PURCHASE_ORDER_ITEMS (Count: 7)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 100
)
INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, gst_percent, line_total)
SELECT
  (i % 30) + 1, (i % 500) + 1, 'Med Snap', 100, 120.00, 5.0, 12600.00
FROM seq;

-- ==========================
-- 8. BILLS (Count: 8)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 400
)
INSERT INTO bills (id, bill_number, customer_id, subtotal, gst_total, grand_total, payment_mode, created_at)
SELECT
  i, 'BILL-MED-' || printf('%06d', i), (i % 200) + 1, 2000.00, 240.00, 2240.00, 'cash', datetime('now', '-' || (i % 365) || ' days')
FROM seq;

-- ==========================
-- 9. BILL_ITEMS (Count: 9)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 1200
)
INSERT INTO bill_items (bill_id, product_id, product_name_snapshot, quantity, unit_price, gst_percent, line_total)
SELECT
  (i % 400) + 1, (i % 500) + 1, 'Med Name Snap', 1, 350.00, 5.0, 367.50
FROM seq;

-- ==========================
-- 10. CREDIT_NOTES (Count: 10)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 20
)
INSERT INTO credit_notes (id, credit_note_number, original_bill_id, customer_id, reason, refund_amount)
SELECT
  i, 'CNM-' || printf('%04d', i), i, (i % 200) + 1, 'EXPIRED_RETURN', 250.00
FROM seq;

-- ==========================
-- 11. CREDIT_NOTE_ITEMS (Count: 11)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 40
)
INSERT INTO credit_note_items (credit_note_id, product_id, product_name_snapshot, quantity, unit_price, gst_percent, line_total)
SELECT
  (i % 20) + 1, (i % 500) + 1, 'Med Snap', 1, 250.00, 5.0, 262.50
FROM seq;

-- ==========================
-- 12. DEBIT_NOTES (Count: 12)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 20
)
INSERT INTO debit_notes (id, debit_note_number, purchase_id, supplier_id, total_taxable, gst_total, grand_total, reason)
SELECT
  i, 'DNM-' || printf('%04d', i), i, (i % 5) + 1, 1000, 50, 1050, 'EXPIRED_RETURN'
FROM seq;

-- ==========================
-- 13. DEBIT_NOTE_ITEMS (Count: 13)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 40
)
INSERT INTO debit_note_items (debit_note_id, product_id, product_name, quantity, unit_price, gst_percent, line_total)
SELECT
  (i % 20) + 1, (i % 500) + 1, 'Med Snap', 5, 200.00, 5.0, 1050.00
FROM seq;

-- ==========================
-- 14. QUOTATIONS (Count: 14)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 30
)
INSERT INTO quotations (id, quotation_number, customer_id, customer_name_snapshot, total_taxable, gst_total, grand_total, status)
SELECT
  i, 'QTM-' || printf('%04d', i), (i % 200) + 1, 'Patient Snap', 1142.86, 57.14, 1200, 'PENDING'
FROM seq;

-- ==========================
-- 15. QUOTATION_ITEMS (Count: 15)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 60
)
INSERT INTO quotation_items (quotation_id, product_id, product_name, quantity, unit_price, gst_percent, line_total)
SELECT
  (i % 30) + 1, (i % 500) + 1, 'Med Snap', 1, 1200.00, 5.0, 1260.00
FROM seq;

-- ==========================
-- 16. EXPENSES (Count: 16)
-- ==========================
WITH RECURSIVE seq(i) AS (
  SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i <= 40
)
INSERT INTO expenses (category, amount, date, payment_mode, notes)
SELECT 'Rent', 30000.00, date('now', '-' || (i % 30) || ' days'), 'cash', 'Pharmacy Rent' FROM seq;

-- ==========================
-- 17. INVENTORY_LOGS (Count: 17)
-- ==========================
INSERT INTO inventory_logs (product_id, change_qty, reason, reference_id, notes, created_at)
SELECT product_id, -quantity, 'SALE', bill_id, 'Medical Sale', created_at FROM bill_items JOIN bills ON bill_items.bill_id = bills.id;

-- ==========================
-- 18. CUSTOMER_LEDGER (Count: 18)
-- ==========================
INSERT INTO customer_ledger (customer_id, amount, type, reference_id, notes, created_at)
SELECT customer_id, grand_total, 'SALE', id, 'Patient Udhaar', created_at FROM bills;

-- ==========================
-- 19. SUPPLIER_LEDGER (Count: 19)
-- ==========================
INSERT INTO supplier_ledger (supplier_id, amount, type, reference_id, notes, created_at)
SELECT (id % 5) + 1, grand_total, 'PURCHASE', id, 'Pharma Stock Refill', created_at FROM purchases;

PRAGMA foreign_keys = ON;