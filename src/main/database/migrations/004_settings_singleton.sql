-- Migration: Singleton Settings Table
-- Version: 004
-- Description: Create a single-row configuration table for application settings.

-- ============================================
-- APP_CONFIG TABLE (Singleton)
-- ============================================
CREATE TABLE IF NOT EXISTS app_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  shop_name TEXT NOT NULL DEFAULT 'SmartKhata Shop',
  owner_name TEXT,
  address TEXT,
  phone TEXT,
  gst_number TEXT,
  printer_name TEXT,
  paper_size TEXT CHECK(paper_size IN ('58mm', '80mm')) DEFAULT '58mm',
  gst_enabled INTEGER DEFAULT 1 CHECK(gst_enabled IN (0, 1)),
  round_off_enabled INTEGER DEFAULT 1 CHECK(round_off_enabled IN (0, 1)),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Insert default settings row if it doesn't exist
INSERT OR IGNORE INTO app_config (id, shop_name) VALUES (1, 'SmartKhata Shop');

-- Note: We keep the old 'settings' table for now to avoid breaking existing code,
-- but all new logic will use 'app_config'.
