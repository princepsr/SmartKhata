-- Migration: GST Enhancements (Unification)
-- Version: 013
-- Description: Consolidates GST-related schema changes into a single migration.
-- 1. Add GST inclusive flag to products (MRP logic)
-- 2. Add global GST exclusive mode master switch

ALTER TABLE products ADD COLUMN is_gst_inclusive INTEGER DEFAULT 1;
ALTER TABLE app_config ADD COLUMN gst_exclusive_mode INTEGER DEFAULT 0;
