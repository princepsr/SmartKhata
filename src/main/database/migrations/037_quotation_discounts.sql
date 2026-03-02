-- Migration: Quotation Discounts
-- Version: 037
-- Description: Adds discount support to quotations and quotation items.

-- 1. Add bill-level discounts to quotations
ALTER TABLE quotations ADD COLUMN bill_discount_value REAL DEFAULT 0;
ALTER TABLE quotations ADD COLUMN bill_discount_type TEXT DEFAULT 'percent';

-- 2. Add item-level discounts to quotation_items
ALTER TABLE quotation_items ADD COLUMN discount_value REAL DEFAULT 0;
ALTER TABLE quotation_items ADD COLUMN discount_type TEXT DEFAULT 'percent';
