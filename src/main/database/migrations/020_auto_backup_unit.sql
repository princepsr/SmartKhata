-- Migration 020: Add interval unit to auto backup settings
ALTER TABLE app_config ADD COLUMN auto_backup_interval_unit TEXT DEFAULT 'days';
