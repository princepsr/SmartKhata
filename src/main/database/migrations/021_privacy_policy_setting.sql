-- Migration: Add Privacy Policy Acceptance Flag
-- Description: Adds a column to app_config to track if the user has accepted the privacy policy.

ALTER TABLE app_config ADD COLUMN privacy_policy_accepted INTEGER DEFAULT 0;
