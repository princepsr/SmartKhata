-- Migration 017: Add automated backup settings to app_config
ALTER TABLE app_config ADD COLUMN auto_backup_enabled INTEGER DEFAULT 1;
ALTER TABLE app_config ADD COLUMN auto_backup_interval_days INTEGER DEFAULT 1;
ALTER TABLE app_config ADD COLUMN auto_backup_retain_count INTEGER DEFAULT 5;
ALTER TABLE app_config ADD COLUMN last_auto_backup TEXT;
