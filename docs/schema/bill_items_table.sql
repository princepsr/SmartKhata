-- ============================================
-- BILL_ITEMS TABLE
-- ============================================
-- Purpose: Line items for each bill with immutable product snapshots
-- Version: 002 (Enhanced for INTEGER monetary values and snapshot strategy)
-- 
-- Key Design Decisions:
-- 1. Product details (name, price, GST) are SNAPSHOTS at time of sale
-- 2. All monetary values stored as INTEGER (paise) for precision
-- 3. Historical safety > normalization (denormalized for audit trail)
-- 4. product_id retained for reference, but details are immutable
-- 5. ON DELETE RESTRICT prevents product deletion if used in bills

CREATE TABLE bill_items (
  -- Primary Key
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Bill Reference
  bill_id INTEGER NOT NULL,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
  -- CASCADE: If bill is deleted, all items are deleted (bill + items are atomic)
  
  -- Product Reference (for reporting, not for data retrieval)
  product_id INTEGER NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  -- RESTRICT: Cannot delete product if it has been sold (audit requirement)
  
  -- Product Snapshot (IMMUTABLE - captured at time of sale)
  product_name_snapshot TEXT NOT NULL,
  -- Snapshot of product name at time of sale
  -- Example: "Coca Cola 500ml"
  -- If product name changes later, this remains unchanged
  
  -- Quantity
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  -- Stored as INTEGER (supports whole units only for simplicity)
  -- Example: 2 bottles, 5 packets
  -- Future: Can change to REAL for fractional quantities (e.g., 1.5 kg)
  
  -- Pricing Snapshot (IMMUTABLE - stored in paise)
  unit_price INTEGER NOT NULL CHECK(unit_price >= 0),
  -- Price per unit at time of sale (in paise)
  -- Example: 4000 paise = ₹40.00 per bottle
  
  gst_percent INTEGER NOT NULL DEFAULT 0 CHECK(gst_percent >= 0 AND gst_percent <= 10000),
  -- GST rate at time of sale (basis points)
  -- Example: 1800 = 18.00%
  
  -- Line Total (IMMUTABLE - stored in paise)
  line_total INTEGER NOT NULL CHECK(line_total >= 0),
  -- Total for this line item: (unit_price * quantity) + GST
  -- Example: 2 bottles × ₹40.00 × 1.18 (18% GST) = ₹94.40 = 9440 paise
  
  -- Audit Timestamp
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
  -- No updated_at - bill items are immutable once created
);

-- ============================================
-- INDEXES
-- ============================================

-- Bill items lookup (most common query)
CREATE INDEX idx_bill_items_bill_id ON bill_items(bill_id);

-- Product sales history (reporting)
CREATE INDEX idx_bill_items_product_id ON bill_items(product_id);

-- Date-based product sales (for analytics)
CREATE INDEX idx_bill_items_created_at ON bill_items(created_at);

-- ============================================
-- SAMPLE DATA
-- ============================================

-- Example 1: Simple item (Coca Cola)
INSERT INTO bill_items (bill_id, product_id, product_name_snapshot, quantity, unit_price, gst_percent, line_total)
VALUES (1, 101, 'Coca Cola 500ml', 2, 4000, 1800, 9440);
-- 2 bottles × ₹40.00 = ₹80.00, GST 18% = ₹14.40, Total = ₹94.40

-- Example 2: Item with no GST (Milk)
INSERT INTO bill_items (bill_id, product_id, product_name_snapshot, quantity, unit_price, gst_percent, line_total)
VALUES (1, 102, 'Amul Milk 1L', 1, 6000, 0, 6000);
-- 1 packet × ₹60.00 = ₹60.00, No GST, Total = ₹60.00

-- Example 3: Item with 5% GST (Dal)
INSERT INTO bill_items (bill_id, product_id, product_name_snapshot, quantity, unit_price, gst_percent, line_total)
VALUES (2, 103, 'Toor Dal 1kg', 3, 15000, 500, 47250);
-- 3 kg × ₹150.00 = ₹450.00, GST 5% = ₹22.50, Total = ₹472.50
