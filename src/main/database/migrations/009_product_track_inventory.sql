-- Migration: Add Track Inventory Flag to Products
-- Added: 2026-02-18
-- Description: Per-product flag to enable/disable inventory tracking.
-- Default is 1 (TRUE) for existing products so behavior doesn't change.

ALTER TABLE products ADD COLUMN track_inventory INTEGER DEFAULT 1;
