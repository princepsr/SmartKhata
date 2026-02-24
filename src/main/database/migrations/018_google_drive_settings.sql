-- Add Google Drive Cloud Backup settings to app_config
ALTER TABLE app_config ADD COLUMN google_drive_sync_enabled INTEGER DEFAULT 0;
ALTER TABLE app_config ADD COLUMN last_cloud_sync TEXT DEFAULT NULL;
