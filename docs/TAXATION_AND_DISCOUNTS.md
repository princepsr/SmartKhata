# Taxation & Discount Logic

This document explains how SmartKhata handles GST calculations and discount distribution to ensure financial accuracy and tax compliance.

---

## 🏛️ GST Calculation Models

SmartKhata supports two pricing models, configurable at the product level and governed by global settings.

### 1. Exclusive Pricing (Add-on Tax)

In this model, the GST is added on top of the base Selling Price.

- **Formula**: `Line Total = (Selling Price * Quantity) + ((Selling Price * Quantity) * GST% / 100)`
- **Taxable Value**: Internal Subtotal is equal to `Selling Price * Quantity`.

### 2. Inclusive Pricing (MRP-based Tax)

In this model, the GST is already "baked into" the Selling Price (MRP). The system performs an "Inverse GST" calculation to separate the base price from the tax.

- **Line Total**: `MRP * Quantity`
- **Taxable Value (Subtotal)**: `Line Total / (1 + GST% / 100)`
- **GST Amount**: `Line Total - Taxable Value`
- **Example**: An item sold for ₹118 (MRP) with 18% GST has a taxable value of ₹100 and tax of ₹18.

---

## ✂️ Proportional Discount Distribution

When a global discount (e.g., ₹50 off the bill) is applied, the system does not simply subtract it from the final total. Instead, it **distributes the discount proportionally** across all taxable line items.

### Why Proportional?

- **GST Compliance**: Tax must be calculated on the _net taxable value_ after discounts. By distributing the discount to items, the system accurately reduces the taxable base for each item, lowering the total GST collected and paid.
- **Financial Accuracy**: Ensures that if an item is returned, the exactly discounted refund amount is known.

### How it Works:

1.  **Calculate Total Gross Amount**: Sum of all items (Price \* Qty) including taxes (if exclusive mode is off).
2.  **Calculate Discount Factor**: `(Total Gross - Discount Amount) / Total Gross`.
3.  **Apply to Line Items**:
    - **Base Total**: Original line total before global discount.
    - **Discounted Total**: `Math.round(Base Total * Discount Factor * 100) / 100`.
4.  **Reverse GST (Inclusive)**: `Discounted Total / (1 + GST%)` gives the new taxable subtotal.
5.  **Calculate Line GST**: `Discounted Total - Line Subtotal`.

This ensures that the discount reduces the **taxable base** proportionally, a critical requirement for GST compliance in India.

---

## 🔄 Sales Returns & GST Reversal

When a sale is returned, the system generates a **Credit Note**. This triggers a legal reversal of the GST originally collected.

- **Taxable Reversal**: The taxable value of the returned quantity is removed from the periodic liability.
- **GST Reversal**: CGST, SGST, or IGST are reversed based on the original bill's `supply_type`.
- **Consistency**: Line-level unit prices in returns are SNAPSHOTTED from the original bill (inclusive of any proportional discounts applied at the time of sale) to ensure exact financial reversal.

---

## 📦 Input Tax Credit (ITC)

SmartKhata tracks GST paid on supplier purchases, known as **Input Tax Credit**, which can be set off against the GST collected on sales (Output Tax).

- **Output GST**: Tax collected from customers on bills.
- **Input ITC**: Tax paid to suppliers on purchases.
- **Net Payable**: `(Gross Output GST - Credit Note GST) - Input ITC`.

---

## 📈 Round-Off Behavior

SmartKhata implements a standard mathematical round-off to the nearest rupee:

- **Rule**: If the decimal part is `< 0.50`, it rounds down. If `≥ 0.50`, it rounds up.
- **Implementation**: Performed only at the **Grand Total** level to prevent compounding rounding errors at the line-item level.

---

## 📊 GST & Profit Reporting

The reporting system ensures that profit reflects **taxable revenue** (the actual business gain) rather than the grand total.

### Profit Formula

`Est. Profit = (Taxable Revenue) - (Cost of Goods Sold)`

- **Taxable Revenue**: `Line Total - Line GST`.
- **Handling Zero-GST Bills**: If a bill is issued with `0` total GST, the system treats the entire subtotal as taxable revenue to prevent artificial profit loss.
- **Why this matters**: Subtracting GST from revenue is essential because GST collected must be paid to the government and is not part of the business profit.

---

## 🛠️ Implementation References

- **Math Logic**: `src/renderer/utils/billing-math.ts`
- **Validation**: `src/shared/validation/billing.schema.ts`
- **Persistence**: `src/main/repositories/bill-repository.ts`

---

**Last updated:** 2026-02-23  
**Status:** ✅ Robust tax-inclusive logic and proportional discounts implemented.
