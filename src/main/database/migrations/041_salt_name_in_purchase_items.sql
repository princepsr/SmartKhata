-- Migration: Add salt_name to purchase items
-- Version: 041
-- Description: Adds salt_name column to purchase_order_items and purchase_items for better medicine tracking.

-- Add salt_name to purchase_order_items
ALTER TABLE purchase_order_items ADD COLUMN salt_name TEXT;

-- Add salt_name to purchase_items
ALTER TABLE purchase_items ADD COLUMN salt_name TEXT;
