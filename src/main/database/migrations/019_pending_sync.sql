-- Track pending cloud backups for offline-aware sync
ALTER TABLE app_config ADD COLUMN cloud_sync_pending INTEGER DEFAULT 0;
ALTER TABLE app_config ADD COLUMN pending_sync_path TEXT DEFAULT NULL;
