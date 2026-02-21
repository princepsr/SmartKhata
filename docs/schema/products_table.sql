-- ============================================
-- PRODUCTS TABLE
-- ============================================
-- Purpose: Product catalog with pricing, stock, and GST information
-- Version: 002 (Enhanced for GST compliance and INTEGER monetary values)
-- 
-- Key Design Decisions:
-- 1. Monetary values stored as REAL (Rupees) for simplicity
-- 2. GST rate stored as REAL (Percentage: 18.0 = 18.00%)
-- 3. Optional SKU and barcode for flexibility
-- 4. Soft delete via is_active flag (0 = Inactive)
-- 5. Stock managed manually + auto-deducted on sales

CREATE TABLE products (
  -- Primary Key
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Identification
  name TEXT NOT NULL,
  sku TEXT UNIQUE,                    -- Optional: Stock Keeping Unit (e.g., "PROD-001")
  barcode TEXT UNIQUE,                -- Optional: Barcode for scanner (e.g., "8901234567890")
  
  -- Pricing (stored in Rupees)
  sale_price REAL NOT NULL CHECK(sale_price >= 0),      -- Selling price in Rupees
  purchase_price REAL CHECK(purchase_price >= 0),       -- Cost price in Rupees (optional)
  
  -- GST Information
  gst_percent REAL NOT NULL DEFAULT 0 CHECK(gst_percent >= 0 AND gst_percent <= 100),
  -- Stored as percentage: 18.0 = 18.00%, 5.0 = 5.00%, 28.0 = 28.00%
  -- Range: 0 to 100 (0% to 100%)
  
  -- Inventory
  stock_qty INTEGER NOT NULL DEFAULT 0 CHECK(stock_qty >= 0),
  low_stock_alert INTEGER CHECK(low_stock_alert >= 0),     -- Alert threshold (optional)
  
  -- Status
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  
  -- Audit Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- INDEXES
-- ============================================

-- Name search (frequent operation in POS)
CREATE INDEX idx_products_name ON products(name);

-- Barcode lookup (scanner integration)
CREATE INDEX idx_products_barcode ON products(barcode);

-- SKU lookup (inventory management)
CREATE INDEX idx_products_sku ON products(sku);

-- Active products filter (most queries only need active products)
CREATE INDEX idx_products_is_active ON products(is_active);

-- Low stock alerts (for inventory reports)
CREATE INDEX idx_products_stock_alert ON products(stock_qty, low_stock_alert) 
  WHERE is_active = 1 AND low_stock_alert IS NOT NULL;

-- ============================================
-- SAMPLE DATA
-- ============================================

-- Example 1: Product with barcode, GST 18%
INSERT INTO products (name, barcode, sale_price, purchase_price, gst_percent, stock_qty, low_stock_alert)
VALUES ('Coca Cola 500ml', '8901234567890', 40.0, 30.0, 18.0, 50, 10);
-- Sale price: ₹40.00, Purchase: ₹30.00, GST: 18%, Stock: 50, Alert at: 10

-- Example 2: Product with SKU, GST 5%
INSERT INTO products (name, sku, sale_price, purchase_price, gst_percent, stock_qty, low_stock_alert)
VALUES ('Toor Dal 1kg', 'DAL-001', 150.0, 120.0, 5.0, 100, 20);
-- Sale price: ₹150.00, Purchase: ₹120.00, GST: 5%, Stock: 100, Alert at: 20

-- Example 3: Simple product, no SKU/barcode, no GST
INSERT INTO products (name, sale_price, stock_qty)
VALUES ('Plastic Bag', 2.0, 500);
-- Sale price: ₹2.00, No purchase price, GST: 0%, Stock: 500, No alert
