-- Migration to align license schema with T2.5.3 requirements
-- Version: 003
-- Description: Rename columns for alignment and add is_trial flag

-- SQLite doesn't support RENAME COLUMN in older versions easily with multiple columns,
-- but SmartKhata uses a modern enough version (better-sqlite3).
-- However, to be safe and clean, we recreate the table or use multiple ALTER TABLEs.

-- 1. Rename existing columns
ALTER TABLE license RENAME COLUMN machine_fingerprint TO device_id;
ALTER TABLE license RENAME COLUMN activated_at TO activated_on;
ALTER TABLE license RENAME COLUMN expires_at TO expires_on;
ALTER TABLE license RENAME COLUMN trial_started_at TO trial_started_on;

-- 2. Add is_trial flag (Default to 1 if no license_key, else 0)
ALTER TABLE license ADD COLUMN is_trial INTEGER NOT NULL DEFAULT 1;

-- 3. Update is_trial based on license_key
UPDATE license SET is_trial = 0 WHERE license_key IS NOT NULL AND license_key != '';
