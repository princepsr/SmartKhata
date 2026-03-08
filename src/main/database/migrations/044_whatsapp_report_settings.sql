-- Migration: WhatsApp Report Settings
-- Version: 044
-- Description: Add configuration for automated WhatsApp Daily Reports via Meta API

ALTER TABLE app_config ADD COLUMN whatsapp_auto_report_enabled INTEGER DEFAULT 0 CHECK(whatsapp_auto_report_enabled IN (0, 1));
ALTER TABLE app_config ADD COLUMN whatsapp_recipient_number TEXT;
ALTER TABLE app_config ADD COLUMN whatsapp_report_time TEXT DEFAULT '20:00'; -- HH:mm format
ALTER TABLE app_config ADD COLUMN last_whatsapp_report_date TEXT; -- YYYY-MM-DD
