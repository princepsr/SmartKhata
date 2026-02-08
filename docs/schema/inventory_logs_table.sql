-- ============================================
-- INVENTORY_LOGS TABLE
-- ============================================
-- Purpose: Complete audit trail of all stock changes
-- Version: 002 (Enhanced for comprehensive audit logging)
-- 
-- Key Design Decisions:
-- 1. Every stock change is logged (no silent changes)
-- 2. Immutable audit trail (append-only, no updates/deletes)
-- 3. Reason tracking (SALE, MANUAL, ADJUSTMENT)
-- 4. Reference linking (bill_id for sales)
-- 5. Positive/negative change_qty for increase/decrease

CREATE TABLE inventory_logs (
  -- Primary Key
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Product Reference
  product_id INTEGER NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  -- RESTRICT: Cannot delete product if it has inventory history
  
  -- Stock Change
  change_qty INTEGER NOT NULL,
  -- Positive = Stock increase (purchase, return, correction)
  -- Negative = Stock decrease (sale, damage, theft)
  -- Example: +50 = Added 50 units, -2 = Sold 2 units
  
  -- Reason for Change
  reason TEXT NOT NULL CHECK(reason IN ('SALE', 'MANUAL', 'ADJUSTMENT')),
  -- SALE = Stock decreased due to sale (automatic)
  -- MANUAL = Manual stock update by user (purchase, initial stock)
  -- ADJUSTMENT = Stock correction (damage, theft, count mismatch)
  
  -- Reference to Source Transaction (Optional)
  reference_id INTEGER,
  -- If reason = 'SALE', reference_id = bill_id
  -- If reason = 'MANUAL' or 'ADJUSTMENT', reference_id = NULL
  -- No foreign key constraint (flexible reference)
  
  -- Optional Notes
  notes TEXT,
  -- Additional context for manual adjustments
  -- Example: "Damaged during transport", "Initial stock entry"
  
  -- Audit Timestamp
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
  -- No updated_at - logs are immutable (append-only)
);

-- ============================================
-- INDEXES
-- ============================================

-- Product inventory history (most common query)
CREATE INDEX idx_inventory_logs_product_id ON inventory_logs(product_id);

-- Date-based inventory reports
CREATE INDEX idx_inventory_logs_created_at ON inventory_logs(created_at);

-- Reason-based filtering (e.g., all sales, all adjustments)
CREATE INDEX idx_inventory_logs_reason ON inventory_logs(reason);

-- Reference lookup (e.g., find inventory log for a bill)
CREATE INDEX idx_inventory_logs_reference_id ON inventory_logs(reference_id);

-- ============================================
-- SAMPLE DATA
-- ============================================

-- Example 1: Sale (automatic stock decrease)
INSERT INTO inventory_logs (product_id, change_qty, reason, reference_id, notes)
VALUES (101, -2, 'SALE', 1, 'Bill #BILL-20260208-0001');
-- Sold 2 units of product 101 in bill 1

-- Example 2: Manual stock addition (purchase)
INSERT INTO inventory_logs (product_id, change_qty, reason, reference_id, notes)
VALUES (102, 50, 'MANUAL', NULL, 'Purchased 50 units from supplier');
-- Added 50 units of product 102 (purchase)

-- Example 3: Adjustment (damage)
INSERT INTO inventory_logs (product_id, change_qty, reason, reference_id, notes)
VALUES (103, -5, 'ADJUSTMENT', NULL, 'Damaged during transport');
-- Removed 5 units of product 103 (damage)

-- Example 4: Adjustment (stock count correction)
INSERT INTO inventory_logs (product_id, change_qty, reason, reference_id, notes)
VALUES (104, 3, 'ADJUSTMENT', NULL, 'Physical count mismatch - added 3 units');
-- Added 3 units of product 104 (count correction)
