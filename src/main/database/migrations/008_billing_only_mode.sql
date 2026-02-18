-- Migration: Add Billing Only Mode to app_config
-- Added: 2026-02-18
-- Description: Global toggle to skip inventory operations during billing.

ALTER TABLE app_config ADD COLUMN billing_only INTEGER DEFAULT 0;
