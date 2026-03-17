-- ====================================================================
-- SMARTKHATA ENTERPRISE AUDIT SUITE
-- ====================================================================
-- Purpose: Comprehensive integrity verification for all 19 business tables.
-- Version: 3.0 (ITC & Pro-Feature Compatible)
--
-- Categories Covered:
-- 1. Catalog & Inventory
-- 2. Sales & Revenue (B2C/B2B)
-- 3. Procurement & ITC Tracking (B2B)
-- 4. Returns & Reversals (Credit/Debit Notes)
-- 5. Financial Ledgers (Customer/Supplier)
-- 6. Professional Modules (Quotations/Expenses)
-- 7. System & Compliance (Config/License)
-- ====================================================================

-- ====================================================================
-- 1. CATALOG & INVENTORY INTEGRITY
-- ====================================================================

-- Check product count and active status
SELECT 
    COUNT(*) as total_count,
    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_count,
    SUM(CASE WHEN track_inventory = 1 THEN 1 ELSE 0 END) as tracked_count
FROM products;

-- Inventory Reconciliation: Calculate stock from logs vs products table
-- (Should return 0 rows if perfectly synced)
SELECT 
    p.id, p.name, p.stock_qty as table_stock,
    COALESCE(SUM(il.change_qty), 0) as calculated_stock,
    (p.stock_qty - COALESCE(SUM(il.change_qty), 0)) as discrepancy
FROM products p
LEFT JOIN inventory_logs il ON p.id = il.product_id
GROUP BY p.id
HAVING discrepancy != 0;

-- ====================================================================
-- 2. SALES INTEGRITY (BILLS)
-- ====================================================================

-- Verify Bill Grand Totals (Subtotal + GST - Discount)
-- (Should return 0 rows if valid)
SELECT 
    bill_number, grand_total,
    (subtotal + gst_total - discount_amount) as calculated_total
FROM bills
WHERE ABS(grand_total - (subtotal + gst_total - discount_amount)) > 0.01;

-- Verify Bill Items vs Bill Total
-- (Should return 0 rows if valid)
SELECT 
    b.bill_number, b.subtotal as bill_subtotal,
    SUM(bi.line_total) as items_total
FROM bills b
JOIN bill_items bi ON b.id = bi.bill_id
GROUP BY b.id
HAVING ABS(b.grand_total - SUM(bi.line_total) + b.discount_amount - b.gst_total) > 0.01;

-- ====================================================================
-- 3. PROCUREMENT & ITC AUDIT (B2B)
-- ====================================================================

-- Audit Input Tax Credit (ITC) for Purchases
SELECT 
    purchase_number, 
    supplier_name,
    total_taxable,
    gst_total as itc_claimed,
    grand_total
FROM purchases
ORDER BY invoice_date DESC;

-- Verify Purchase Items vs Purchase Total
SELECT 
    p.purchase_number,
    p.total_taxable as purchase_taxable,
    SUM(pi.line_taxable) as items_taxable
FROM purchases p
JOIN purchase_items pi ON p.id = pi.purchase_id
GROUP BY p.id
HAVING ABS(p.total_taxable - SUM(pi.line_taxable)) > 0.01;

-- ====================================================================
-- 4. RETURNS & REVERSALS (Notes)
-- ====================================================================

-- Credit Notes (Sales Returns) vs Original Bills
SELECT 
    cn.credit_note_number,
    b.bill_number as original_bill,
    cn.refund_amount,
    cn.reason
FROM credit_notes cn
JOIN bills b ON cn.original_bill_id = b.id;

-- Debit Notes (Purchase Returns) vs Purchases
SELECT 
    dn.debit_note_number,
    p.purchase_number as original_purchase,
    dn.grand_total as reversal_amount,
    dn.reason
FROM debit_notes dn
LEFT JOIN purchases p ON dn.purchase_id = p.id;

-- ====================================================================
-- 5. FINANCIAL LEDGERS (Receivables/Payables)
-- ====================================================================

-- Customer Ledger Audit (Sales vs Payments)
SELECT 
    c.name,
    c.balance_due as table_balance,
    SUM(CASE WHEN cl.type = 'SALE' THEN cl.amount WHEN cl.type = 'PAYMENT' THEN -cl.amount ELSE 0 END) as ledger_calculated
FROM customers c
LEFT JOIN customer_ledger cl ON c.id = cl.customer_id
GROUP BY c.id;

-- Supplier Ledger Audit (Purchases vs Payments)
SELECT 
    s.name,
    SUM(CASE WHEN sl.type = 'PURCHASE' THEN sl.amount WHEN sl.type = 'PAYMENT' THEN -sl.amount ELSE 0 END) as net_payable
FROM suppliers s
LEFT JOIN supplier_ledger sl ON s.id = sl.supplier_id
GROUP BY s.id;

-- ====================================================================
-- 6. PROFESSIONAL MODULES
-- ====================================================================

-- Quotation Pipeline Summary
SELECT 
    status,
    COUNT(*) as count,
    SUM(grand_total) as total_value
FROM quotations
GROUP BY status;

-- Expense Breakdown by Category
SELECT 
    category,
    COUNT(*) as entries,
    SUM(amount) as total_spent
FROM expenses
GROUP BY category;

-- ====================================================================
-- 7. SYSTEM & COMPLIANCE
-- ====================================================================

-- Application Config Singleton Check
SELECT shop_name, gst_enabled, gst_number FROM app_config LIMIT 1;

-- License Validity Check
SELECT 
    license_key,
    expires_on,
    CASE 
        WHEN datetime(expires_on) > datetime('now') THEN 'VALID' 
        ELSE 'EXPIRED' 
    END as license_status
FROM license;

-- ====================================================================
-- END OF AUDIT SUITE
-- ====================================================================
