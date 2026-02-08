-- ============================================
-- BILLS TABLE
-- ============================================
-- Purpose: Billing transactions with immutable final totals
-- Version: 002 (Enhanced for INTEGER monetary values and GST compliance)
-- 
-- Key Design Decisions:
-- 1. All monetary values stored as INTEGER (paise) for precision
-- 2. Totals are FINAL and immutable (no recalculation from items)
-- 3. Unique bill_number for audit trail and receipt printing
-- 4. customer_id is nullable (walk-in customers)
-- 5. payment_mode supports cash, UPI, and mixed payments

CREATE TABLE bills (
  -- Primary Key
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Bill Identification
  bill_number TEXT NOT NULL UNIQUE,
  -- Format: BILL-YYYYMMDD-NNNN (e.g., "BILL-20260208-0001")
  -- Sequential per day, human-readable, sortable
  
  -- Customer Reference (Optional)
  customer_id INTEGER,
  -- NULL = Walk-in customer (no customer record)
  -- Foreign key to customers table
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  
  -- Monetary Totals (Stored in paise - IMMUTABLE)
  subtotal INTEGER NOT NULL CHECK(subtotal >= 0),
  -- Sum of all item prices (before GST and discount)
  
  gst_total INTEGER NOT NULL DEFAULT 0 CHECK(gst_total >= 0),
  -- Total GST amount (CGST + SGST or IGST)
  
  discount_amount INTEGER NOT NULL DEFAULT 0 CHECK(discount_amount >= 0),
  -- Total discount applied to the bill
  
  grand_total INTEGER NOT NULL CHECK(grand_total >= 0),
  -- Final amount to be paid: subtotal + gst_total - discount_amount
  -- This is the FINAL, IMMUTABLE total
  
  -- Payment Information
  payment_mode TEXT NOT NULL DEFAULT 'cash' CHECK(payment_mode IN ('cash', 'upi', 'mixed')),
  -- cash = Full payment in cash
  -- upi = Full payment via UPI
  -- mixed = Combination of cash and UPI (details in payments table)
  
  -- Audit Timestamp
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
  -- No updated_at - bills are immutable once created
);

-- ============================================
-- INDEXES
-- ============================================

-- Bill number lookup (receipt reprint, search)
CREATE UNIQUE INDEX idx_bills_bill_number ON bills(bill_number);

-- Date-based queries (daily reports, date range filters)
CREATE INDEX idx_bills_created_at ON bills(created_at);

-- Customer bills lookup
CREATE INDEX idx_bills_customer_id ON bills(customer_id);

-- Payment mode reports
CREATE INDEX idx_bills_payment_mode ON bills(payment_mode);

-- ============================================
-- SAMPLE DATA
-- ============================================

-- Example 1: Walk-in customer, cash payment
INSERT INTO bills (bill_number, customer_id, subtotal, gst_total, discount_amount, grand_total, payment_mode)
VALUES ('BILL-20260208-0001', NULL, 10000, 1800, 0, 11800, 'cash');
-- Subtotal: ₹100.00, GST: ₹18.00, Discount: ₹0.00, Total: ₹118.00

-- Example 2: Registered customer, UPI payment
INSERT INTO bills (bill_number, customer_id, subtotal, gst_total, discount_amount, grand_total, payment_mode)
VALUES ('BILL-20260208-0002', 1, 50000, 2500, 5000, 47500, 'upi');
-- Subtotal: ₹500.00, GST: ₹25.00, Discount: ₹50.00, Total: ₹475.00

-- Example 3: Customer with discount, mixed payment
INSERT INTO bills (bill_number, customer_id, subtotal, gst_total, discount_amount, grand_total, payment_mode)
VALUES ('BILL-20260208-0003', 2, 100000, 18000, 10000, 108000, 'mixed');
-- Subtotal: ₹1000.00, GST: ₹180.00, Discount: ₹100.00, Total: ₹1080.00
-- Payment details in separate payments table
