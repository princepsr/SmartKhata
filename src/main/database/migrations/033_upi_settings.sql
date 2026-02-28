-- Migration 033: Add UPI Settings to app_config
-- Description: Adds upi_id and upi_name fields to app_config to enable dynamic UPI QR generation.

ALTER TABLE app_config ADD COLUMN upi_id TEXT DEFAULT '';
ALTER TABLE app_config ADD COLUMN upi_name TEXT DEFAULT '';
