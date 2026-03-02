-- Add updated_at column to quotations table for status tracking
-- Version: 036

ALTER TABLE quotations ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));

-- Update existing rows to have a valid updated_at
UPDATE quotations SET updated_at = created_at WHERE updated_at IS NULL;
