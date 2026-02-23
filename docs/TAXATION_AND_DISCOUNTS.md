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

1. Calculate the **Weight** of each item based on its share of the total bill amount.
2. Multiply the **Weight** by the **Total Discount Amount**.
3. Subtract the **Item Discount** from the item's taxable value _before_ applying GST (for exclusive) or _before_ separating GST (for inclusive).

---

## 📈 Round-Off Behavior

SmartKhata implements a standard mathematical round-off to the nearest rupee:

- **Rule**: If the decimal part is `< 0.50`, it rounds down. If `≥ 0.50`, it rounds up.
- **Implementation**: Performed only at the **Grand Total** level to prevent compounding rounding errors at the line-item level.

---

## 🛠️ Implementation References

- **Math Logic**: `src/renderer/utils/billing-math.ts`
- **Validation**: `src/shared/validation/billing.schema.ts`
- **Persistence**: `src/main/repositories/bill-repository.ts`

---

**Last updated:** 2026-02-23  
**Status:** ✅ Robust tax-inclusive logic and proportional discounts implemented.
