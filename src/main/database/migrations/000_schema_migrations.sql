-- Migration Tracking Table
-- This table keeps track of which migrations have been applied

CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  checksum TEXT NOT NULL,
  execution_time_ms INTEGER NOT NULL
);

-- Index for fast version lookups
CREATE INDEX IF NOT EXISTS idx_schema_migrations_version 
ON schema_migrations(version);

-- Index for chronological queries
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at 
ON schema_migrations(applied_at);
