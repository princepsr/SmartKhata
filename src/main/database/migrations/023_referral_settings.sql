-- Migration 023: Add Referral Settings
ALTER TABLE app_config ADD COLUMN last_referral_banner_seen TEXT;
