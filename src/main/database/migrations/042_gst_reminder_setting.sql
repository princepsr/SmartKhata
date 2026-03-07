-- Add GST Filing Reminder persistence field
ALTER TABLE app_config ADD COLUMN last_gst_reminder_seen TEXT DEFAULT NULL;
