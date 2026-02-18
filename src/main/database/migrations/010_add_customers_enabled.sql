-- Migration: Add Customers Enabled Flag to app_config
-- Added: 2026-02-18
-- Description: Toggle to enable/disable the Customers page and management.

ALTER TABLE app_config ADD COLUMN customers_enabled INTEGER DEFAULT 1;
