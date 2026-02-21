-- ============================================
-- DATABASE CONSTRAINTS & INTEGRITY
-- ============================================
-- Purpose: Enforce data integrity at database level
-- Version: 002
-- 
-- Key Design Decisions:
-- 1. Foreign keys enabled (PRAGMA foreign_keys = ON)
-- 2. Cascade rules for parent-child relationships
-- 3. CHECK constraints for data validation
-- 4. Application-level logic for complex constraints

-- ============================================
-- PRAGMA SETTINGS (Applied at connection time)
-- ============================================

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- WAL mode for better concurrency
PRAGMA journal_mode = WAL;

-- Full synchronous mode for data safety
PRAGMA synchronous = FULL;

-- Busy timeout (5 seconds)
PRAGMA busy_timeout = 5000;

-- ============================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================

-- Products Table: No foreign keys (master data)

-- Customers Table: No foreign keys (master data)

-- Bills Table
-- customer_id → customers(id) ON DELETE SET NULL
-- Allows customer deletion, bill remains valid with NULL customer_id

-- Bill Items Table
-- bill_id → bills(id) ON DELETE CASCADE
-- If bill deleted, all items deleted (atomic relationship)
-- product_id → products(id) ON DELETE RESTRICT
-- Cannot delete product if it has been sold (audit requirement)

-- Inventory Logs Table
-- product_id → products(id) ON DELETE RESTRICT
-- Cannot delete product if it has inventory history

-- Settings Table: No foreign keys (key-value store)

-- License Table: No foreign keys (standalone)

-- ============================================
-- CHECK CONSTRAINTS
-- ============================================

-- Products Table
-- sale_price >= 0
-- purchase_price >= 0
-- gst_percent >= 0 AND gst_percent <= 100
-- stock_qty >= 0
-- low_stock_alert >= 0
-- is_active IN (0, 1)

-- Customers Table
-- is_active IN (0, 1)

-- Bills Table
-- subtotal >= 0
-- gst_total >= 0
-- discount_amount >= 0
-- grand_total >= 0
-- payment_mode IN ('cash', 'upi', 'mixed')

-- Bill Items Table
-- quantity > 0
-- unit_price >= 0
-- gst_percent >= 0 AND gst_percent <= 100
-- line_total >= 0

-- Inventory Logs Table
-- reason IN ('SALE', 'MANUAL', 'ADJUSTMENT')

-- License Table
-- id = 1 (single row enforcement)

-- ============================================
-- UNIQUE CONSTRAINTS
-- ============================================

-- Products: sku UNIQUE, barcode UNIQUE
-- Customers: phone UNIQUE
-- Bills: bill_number UNIQUE
-- Settings: key PRIMARY KEY (implicit UNIQUE)
-- License: license_key UNIQUE

-- ============================================
-- NOT NULL CONSTRAINTS
-- ============================================

-- All tables enforce NOT NULL on critical fields:
-- - Primary keys (id)
-- - Required business fields (name, price, etc.)
-- - Audit timestamps (created_at, updated_at)

-- ============================================
-- APPLICATION-LEVEL CONSTRAINTS
-- ============================================

-- The following constraints CANNOT be enforced at DB level
-- and must be handled in application logic:

-- 1. Prevent Negative Stock
--    - Check stock_qty >= quantity before sale
--    - Transaction: check → deduct → log

-- 2. Bill Total Validation
--    - Ensure grand_total = subtotal + gst_total - discount_amount
--    - Calculate in application, validate before insert

-- 3. License Validation
--    - Check expiry date
--    - Verify machine fingerprint
--    - Validate signature

-- 4. Business Rules
--    - Maximum discount percentage
--    - Minimum order amount
--    - Customer credit limit

-- ============================================
-- EXAMPLE: Transaction with Constraints
-- ============================================

-- Sale Transaction (demonstrates constraint enforcement)
BEGIN TRANSACTION;

-- 1. Check stock availability (application-level)
-- SELECT stock_qty FROM products WHERE id = ? FOR UPDATE;
-- IF stock_qty < quantity THEN ROLLBACK;

-- 2. Create bill (DB-level constraints: CHECK, NOT NULL)
INSERT INTO bills (bill_number, customer_id, subtotal, gst_total, discount_amount, grand_total, payment_mode)
VALUES ('BILL-20260208-0001', 1, 100.0, 18.0, 0, 118.0, 'cash');

-- 3. Insert bill items (DB-level constraints: CHECK, FOREIGN KEY)
INSERT INTO bill_items (bill_id, product_id, product_name_snapshot, quantity, unit_price, gst_percent, line_total)
VALUES (1, 101, 'Coca Cola 500ml', 2, 40.0, 18.0, 94.4);

-- 4. Deduct stock (application-level: prevent negative)
UPDATE products 
SET stock_qty = stock_qty - 2, updated_at = datetime('now')
WHERE id = 101;

-- 5. Log inventory change (DB-level constraints: CHECK, FOREIGN KEY)
INSERT INTO inventory_logs (product_id, change_qty, reason, reference_id, notes)
VALUES (101, -2, 'SALE', 1, 'Bill #BILL-20260208-0001');

COMMIT;
