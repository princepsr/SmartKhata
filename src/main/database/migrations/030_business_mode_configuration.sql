-- Migration: Business Mode Specialization
-- Version: 030
-- Description: Adds app_mode to app_config to distinguish between General, Kirana, and Medical store profiles.

ALTER TABLE app_config ADD COLUMN app_mode TEXT DEFAULT 'GENERAL' CHECK(app_mode IN ('GENERAL', 'KIRANA', 'MEDICAL'));

-- Mark initial setup as incomplete if no shop name is set
-- This is a heuristic to trigger the setup screen
