-- Migration: Add Bill Format Settings to app_config
-- Added: 2026-02-13

ALTER TABLE app_config ADD COLUMN show_logo INTEGER DEFAULT 0;
ALTER TABLE app_config ADD COLUMN show_customer_details INTEGER DEFAULT 1;
ALTER TABLE app_config ADD COLUMN footer_message TEXT DEFAULT 'Thank you! Visit Again';
