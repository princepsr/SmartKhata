# Taxation & Discount Logic (GST Compliance Engine)

SmartKhata implements a rigorous mathematical engine to ensure 100% accuracy in GST calculations, proportional discounting, and financial reporting. This document details the low-level math and compliance rules used in the application.

---

## 🏛️ 1. GST Calculation Models

The system supports two primary pricing models, configurable at the product level.

### A. Exclusive Pricing (Add-on Tax)
GST is added on top of the base Selling Price. Usually used in B2B environments.
- **Subtotal**: `Price * Quantity`
- **GST Amount**: `Subtotal * (GST% / 100)`
- **Grand Total**: `Subtotal + GST Amount`

### B. Inclusive Pricing (MRP-based Tax)
GST is embedded within the Selling Price. Standard for B2C retail (Kirana/Medical).
- **Grand Total**: `Price * Quantity`
- **Subtotal (Taxable Value)**: `Grand Total / (1 + GST% / 100)`
- **GST Amount**: `Grand Total - Subtotal`
- **Mathematical Significance**: This "Inverse GST" ensures that the tax is calculated from the base value, not the total, preventing "Tax on Tax" errors.

---

## ✂️ 2. Proportional Discount Redistribution

SmartKhata does NOT apply global discounts (e.g., ₹50 off) to the final total. Doing so would lead to "Tax Over-Reporting." Instead, it redistributes the discount across every line item BEFORE calculating tax.

### The Problem: Tax Leakage
If a bill is ₹1000 + 18% GST = ₹1180, and you give a ₹180 discount:
- **Naive approach**: Final Total = ₹1000. GST remains ₹180.
- **Correction**: The discount should reduce the taxable base. The new taxable base is ₹847.46, and GST is ₹152.54. Total = ₹1000.

### The Algorithm
1.  **Calculate Total Gross**: Sum of all line totals (`Price * Qty`).
2.  **Calculate Discount Ratio**: `(Total Gross - Global Discount) / Total Gross`.
3.  **Redistribute**: For each item:
    - `New Line Total = Original Line Total * Discount Ratio`.
    - `New Taxable Subtotal = New Line Total / (1 + GST%)`.
    - `New Line GST = New Line Total - New Taxable Subtotal`.

This ensures the **GSTR-1** report accurately reflects the net taxable value after all discounts.

---

## 📊 3. Tax Slabs & GST Splitting

SmartKhata automatically splits the total GST into component taxes based on the `supply_type` configured in **Shop Settings**.

### Intrastate (Within State)
- **Logic**: Used if `supply_type === 'intrastate'`.
- **Split**: `CGST = GST / 2` and `SGST = GST / 2`.
- **Reporting**: Displayed separately on receipts and reports.

### Interstate (Outside State)
- **Logic**: Used if `supply_type === 'interstate'`.
- **Split**: `IGST = GST (100%)`.
- **Reporting**: Aggregated as a single tax line.

### Slab Aggregation (GSTR-1 Alignment)
The reporting engine groups all sales into standard HSN/GST slabs (0%, 5%, 12%, 18%, 28%) to simplify tax filing.
- `Total Taxable = SUM(lineSubtotal) WHERE gst_percent = X`
- `Total Tax = SUM(lineGst) WHERE gst_percent = X`

---

## 📉 4. Round-Off & Precision Management

### Precision
- **Internal Math**: 4-decimal precision for intermediate ratios.
- **Line Level**: Fixed to 2-decimal precision (`.toFixed(2)`) to prevent IEEE-754 floating-point drift.
- **Storage**: All values are stored as `REAL` (Dollars/Rupees) in the database.

### Grand Total Round-Off
The system applies a final round-off to the Grand Total to ensure whole-number transactions for Cash/UPI.
- **Mechanism**: `roundOff = Math.round(Sum(lineTotals)) - Sum(lineTotals)`.
- **Persistence**: The `round_off_amount` is stored in the `bills` table as an audit trail. This prevents the "Missing Paisa" problem where the sum of items doesn't match the payment received.

---

## 🛠️ Technical Reference
- **Core Math Library**: `src/renderer/utils/billing-math.ts`
- **Database Schema**: `bills` table (`subtotal`, `gst_total`, `discount_amount`, `round_off_amount`, `grand_total`).
- **Reporting Integration**: `src/main/repositories/report-repository.ts`.
