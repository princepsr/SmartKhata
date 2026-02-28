# Comprehensive GST & Reporting Guide

This guide provides an end-to-end overview of how GST (Goods and Services Tax) is handled in SmartKhata—from point-of-sale through returns and purchases to final tax liability reporting.

---

## 🏛️ The Three Pillars of GST in SmartKhata

SmartKhata's GST engine is built on three pillars to ensure total tax compliance and robust financial reporting:

1.  **Sales (Output GST)**: Tax collected from customers.
2.  **Returns (Credit Notes)**: Tax reversed when goods are returned.
3.  **Purchases (Input Tax Credit)**: Tax paid when buying stock from suppliers.

Together, these pillars determine your **Net GST Liability**.

---

## 1. Sales & Output GST

Every sale recorded in SmartKhata computes tax based on the product's GST rate and the shop's tax configuration.

### A. Pricing Modes

- **Exclusive Mode**: Price + GST. (e.g., ₹100 + 18% = ₹118).
- **Inclusive Mode (MRP)**: GST is baked in. (e.g., ₹118 total → ₹100 base + ₹18 GST).
- **Master Toggle**: The `gst_exclusive_mode` in settings can force all bills to behave as "Add-on GST," regardless of individual product settings.

### B. Proportional Discounting

To remain compliant, discounts must reduce the taxable base. SmartKhata distributes global bill discounts proportionally across all items.

- **Formula**: `Discounted Line Total = Original Line Total * ((Total Gross - Global Discount) / Total Gross)`.
- **Impact**: This lowers the GST collected on each item fairly, preventing "tax leakage" or over-reporting.

---

## 2. Sales Returns (Credit Notes)

When a customer returns items, legal GST reversal is required.

- **Linked Returns**: Credit Notes are linked to original bills to maintain traceability.
- **SNAPSHOTTED Data**: The system uses a "Snapshot" of the price and GST rate from the original bill. If you sold an item with a discount, the reversal uses the _discounted_ price.
- **GST Reversal**: The reversed GST is categorized exactly as the original (CGST/SGST or IGST) and is subtracted from your periodic output tax liability.

---

## 3. Purchases & Input Tax Credit (ITC)

Tracking what you pay to suppliers is essential to avoid double taxation.

- **Recording Purchases**: When you buy stock, you enter the supplier's Invoice Date and GST breakdown.
- **Automatic ITC**: The GST paid on these invoices is automatically flagged as **ITC (Input Tax Credit)**.
- **Intrastate vs Interstate**: Based on your `supply_type`, the system categorizes ITC into CGST/SGST or IGST.

---

## 📊 GST Reporting: The "Net Payable" Calculation

The **GST Summary Report** consolidates all transactions for a given period to tell you exactly what you owe the government.

### The Formula:

> **Net GST Payable** = (Total Output GST from Sales) - (Total GST Reversed via Credit Notes) - (Total ITC from Purchases)

### Example Scenario:

1.  **Sale**: You sell goods with **₹1,000 Output GST**.
2.  **Return**: A customer returns goods worth **₹200 GST**.
3.  **Purchase**: You bought stock and paid **₹300 GST (ITC)**.
4.  **Final Report**:
    - Gross Output: ₹1,000
    - Returns: ₹200
    - ITC: ₹300
    - **Net Payable: ₹500**

---

## 🏗️ Technical Data Flow

1.  **Main Process (`BillingTransactionService`)**: Handles the atomic creation of Sales and Inventory updates.
2.  **Main Process (`CreditNoteService`)**: Handles the mathematical reversal and database persistence of returns.
3.  **Main Process (`PurchaseService`)**: Records supplier invoices and calculates available ITC.
4.  **Repository Layer (`ReportRepository`)**: Performs high-performance SQL cross-joins to aggregate data from `bills`, `credit_notes`, and `purchases` into a unified `GstReport` object.

---

## ✅ Summary of Features

- **Intrastate (CGST/SGST)** & **Interstate (IGST)** support.
- **Partial Returns**: Return 1 item out of a bill of 5.
- **Historical Integrity**: Profit and GST reports use snapshotted cost and tax data (they don't change if you update product prices today).
- **Round-off Accuracy**: 2-decimal precision for tax slabs, nearest-rupee for grand totals.

---

**Status**: ✅ End-to-End GST Robustness Implemented.
**Last Updated**: 2026-02-27
