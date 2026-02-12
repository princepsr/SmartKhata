-- Migration: Add GST Percentage to Configuration
-- Version: 005
-- Description: Adds a default GST percentage field to the app_config table.

ALTER TABLE app_config ADD COLUMN gst_percentage INTEGER DEFAULT 18 CHECK(gst_percentage IN (5, 12, 18));
