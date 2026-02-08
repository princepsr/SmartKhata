-- ============================================
-- SETTINGS TABLE
-- ============================================
-- Purpose: Flexible key-value store for application configuration
-- Version: 002 (Enhanced with metadata)
-- 
-- Key Design Decisions:
-- 1. Simple key-value structure (no schema changes for new settings)
-- 2. All values stored as TEXT (parsed in application layer)
-- 3. Primary key on 'key' for fast lookups
-- 4. updated_at for tracking configuration changes

CREATE TABLE settings (
  -- Primary Key (the setting key)
  key TEXT PRIMARY KEY,
  -- Examples: 'shop_name', 'gst_enabled', 'printer_name'
  
  -- Setting Value (stored as TEXT)
  value TEXT NOT NULL,
  -- All values stored as TEXT, parsed by application
  -- Examples: 'My Shop', 'true', '{"name": "Printer1", "port": "USB001"}'
  
  -- Audit Timestamp
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  -- Track when setting was last changed
);

-- ============================================
-- INDEXES
-- ============================================

-- Primary key automatically indexed (key lookup)
-- No additional indexes needed (small table, < 100 rows)

-- ============================================
-- DEFAULT SETTINGS
-- ============================================

-- Shop Information
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('shop_name', 'SmartKhata POS'),
  ('shop_address', ''),
  ('shop_phone', ''),
  ('shop_gstin', '');

-- GST Configuration
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('gst_enabled', 'true'),
  ('default_gst_rate', '1800');  -- 18% in basis points

-- Printer Configuration
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('printer_enabled', 'false'),
  ('printer_name', ''),
  ('printer_paper_width', '80');  -- 80mm thermal printer

-- Receipt Configuration
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('receipt_header', 'Thank you for shopping with us!'),
  ('receipt_footer', 'Visit again!'),
  ('receipt_show_gstin', 'true');

-- Application Settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('language', 'en'),  -- 'en', 'hi'
  ('currency', 'INR'),
  ('low_stock_alert_enabled', 'true');

-- Billing Settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('bill_prefix', 'BILL'),
  ('auto_print_receipt', 'false'),
  ('allow_discount', 'true'),
  ('max_discount_percent', '2000');  -- 20% in basis points
