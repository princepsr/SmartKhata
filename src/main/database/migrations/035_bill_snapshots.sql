-- Migration: 035_bill_snapshots
-- Version: 035
-- Description: Adds snapshot columns to bills table for historical accuracy of customer details.

-- 1. Add customer_gstin_snapshot
ALTER TABLE bills ADD COLUMN customer_gstin_snapshot TEXT DEFAULT NULL;

-- 2. Add billing_address_snapshot
ALTER TABLE bills ADD COLUMN billing_address_snapshot TEXT DEFAULT NULL;

-- 3. Add shipping_address_snapshot
ALTER TABLE bills ADD COLUMN shipping_address_snapshot TEXT DEFAULT NULL;
