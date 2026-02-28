-- Add toggles for auxiliary features
ALTER TABLE app_config ADD COLUMN expenses_enabled INTEGER DEFAULT 1;
ALTER TABLE app_config ADD COLUMN quotations_enabled INTEGER DEFAULT 1;
ALTER TABLE app_config ADD COLUMN barcode_gen_enabled INTEGER DEFAULT 1;
