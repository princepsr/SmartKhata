-- Add Language preference field
ALTER TABLE app_config ADD COLUMN language TEXT DEFAULT 'en';
