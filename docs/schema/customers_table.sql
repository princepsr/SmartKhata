-- ============================================
-- CUSTOMERS TABLE
-- ============================================
-- Purpose: Customer information with udhaar (credit) tracking
-- Version: 002 (Enhanced for INTEGER monetary values)
-- 
-- Key Design Decisions:
-- 1. balance_due stored as REAL (Rupees)
-- 2. Phone is primary lookup field (indexed)
-- 3. Simple udhaar tracking (no credit limit enforcement)
-- 4. Soft delete via is_active flag

CREATE TABLE customers (
  -- Primary Key
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Identification
  name TEXT NOT NULL,
  phone TEXT UNIQUE,                  -- Primary lookup field (e.g., "9876543210")
  
  -- Udhaar (Credit) Tracking
  balance_due REAL NOT NULL DEFAULT 0,
  -- Stored in Rupees (positive = customer owes money, negative = advance payment)
  -- Example: 500.00 = ₹500.00 owed by customer
  
  -- Status
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  
  -- Audit Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- INDEXES
-- ============================================

-- Phone lookup (primary search method in POS)
CREATE INDEX idx_customers_phone ON customers(phone);

-- Name search (autocomplete, reports)
CREATE INDEX idx_customers_name ON customers(name);

-- Active customers filter
CREATE INDEX idx_customers_is_active ON customers(is_active);

-- Customers with outstanding balance (for udhaar reports)
CREATE INDEX idx_customers_balance_due ON customers(balance_due) 
  WHERE is_active = 1 AND balance_due > 0;

-- ============================================
-- SAMPLE DATA
-- ============================================

-- Example 1: Customer with outstanding balance (udhaar)
INSERT INTO customers (name, phone, balance_due)
VALUES ('Ramesh Kumar', '9876543210', 500.0);
-- Balance: ₹500.00 owed by customer

-- Example 2: Customer with no balance
INSERT INTO customers (name, phone, balance_due)
VALUES ('Suresh Patel', '9123456789', 0);
-- Balance: ₹0.00 (no udhaar)

-- Example 3: Customer with advance payment (negative balance)
INSERT INTO customers (name, phone, balance_due)
VALUES ('Mahesh Shah', '9988776655', -200.0);
-- Balance: -₹200.00 (customer paid advance)

-- Example 4: Walk-in customer (no phone)
INSERT INTO customers (name)
VALUES ('Walk-in Customer');
-- No phone, no balance
