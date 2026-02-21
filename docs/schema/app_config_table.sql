-- ============================================
-- APP_CONFIG TABLE (Singleton)
-- ============================================
-- Stores application-wide configuration in a single-row table.

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
  gst_percentage INTEGER DEFAULT 18 CHECK(gst_percentage IN (5, 12, 18)),
  show_logo INTEGER DEFAULT 0 CHECK(show_logo IN (0, 1)),
  show_customer_details INTEGER DEFAULT 1 CHECK(show_customer_details IN (0, 1)),
  footer_message TEXT DEFAULT 'Thank you! Visit Again',
  print_copies INTEGER DEFAULT 1 CHECK(print_copies BETWEEN 1 AND 5),
  auto_print INTEGER DEFAULT 1 CHECK(auto_print IN (0, 1)),
  billing_only INTEGER DEFAULT 0 CHECK(billing_only IN (0, 1)),
  customers_enabled INTEGER DEFAULT 1 CHECK(customers_enabled IN (0, 1)),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Default record
INSERT OR IGNORE INTO app_config (id, shop_name) VALUES (1, 'SmartKhata Shop');
