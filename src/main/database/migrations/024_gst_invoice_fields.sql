-- Migration: Full GST Invoice Compliance Fields
-- Version: 024
-- Description: Adds CGST/SGST/IGST breakdown columns to bills, HSN code to products,
--              state code/supply type to app_config, and invoice lock flag.

-- ============================================
-- APP_CONFIG: GST invoice settings
-- ============================================
ALTER TABLE app_config ADD COLUMN state_code TEXT DEFAULT '29';         -- State code (e.g. 29=Karnataka)
ALTER TABLE app_config ADD COLUMN supply_type TEXT DEFAULT 'intrastate' -- 'intrastate' or 'interstate'
  CHECK(supply_type IN ('intrastate', 'interstate'));
ALTER TABLE app_config ADD COLUMN place_of_supply TEXT DEFAULT NULL;    -- Optional place of supply override

-- ============================================
-- BILLS: CGST/SGST/IGST breakdown + lock flag
-- ============================================
ALTER TABLE bills ADD COLUMN cgst_amount REAL NOT NULL DEFAULT 0;       -- CGST portion of GST total
ALTER TABLE bills ADD COLUMN sgst_amount REAL NOT NULL DEFAULT 0;       -- SGST portion of GST total
ALTER TABLE bills ADD COLUMN igst_amount REAL NOT NULL DEFAULT 0;       -- IGST (for interstate transactions)
ALTER TABLE bills ADD COLUMN is_printed INTEGER NOT NULL DEFAULT 0      -- Invoice lock: 1 after first print
  CHECK(is_printed IN (0, 1));

-- ============================================
-- PRODUCTS: HSN/SAC code for GST compliance
-- ============================================
ALTER TABLE products ADD COLUMN hsn_code TEXT DEFAULT NULL;             -- HSN or SAC code (optional)
