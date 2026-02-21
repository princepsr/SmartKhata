-- Migration: Consolidate Settings
-- Version: 012
-- Description: Drop the legacy k-v settings table as all configuration is now in app_config.

DROP TABLE IF EXISTS settings;
