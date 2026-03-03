-- Migration: Add Supplier GSTIN Snapshot to Purchase Orders
-- Version: 039
-- Description: Ensures GSTIN is captured at the time of PO creation for accurate pre-filling.

ALTER TABLE purchase_orders ADD COLUMN supplier_gstin_snapshot TEXT;
