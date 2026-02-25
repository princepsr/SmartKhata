-- Migration: Add Auto-Update Setting
-- Description: Adds a column to app_config to toggle automatic update checks.

ALTER TABLE app_config ADD COLUMN auto_update_enabled INTEGER DEFAULT 1;
