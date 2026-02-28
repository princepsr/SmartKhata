-- Migration: Add Batch Tracking Enable flag to app_config
ALTER TABLE app_config ADD COLUMN enable_batch_tracking INTEGER DEFAULT 0;
