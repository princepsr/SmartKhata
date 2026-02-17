-- Migration: Add Printer Configuration to app_config
-- Added: 2026-02-17

ALTER TABLE app_config ADD COLUMN print_copies INTEGER DEFAULT 1;
ALTER TABLE app_config ADD COLUMN auto_print INTEGER DEFAULT 1;
