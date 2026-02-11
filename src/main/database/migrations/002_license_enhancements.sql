-- Migration to enhance license table with trial info
-- Version: 002
-- Description: Add trial_started_at to license table

ALTER TABLE license ADD COLUMN trial_started_at TEXT;
