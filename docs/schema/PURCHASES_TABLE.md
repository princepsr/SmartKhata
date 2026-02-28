# Purchases Table Design

## Overview

The `purchases` table records incoming stock from suppliers (Inward Invoices). It is the backbone of **Inventory Replenishment** and **Input Tax Credit (ITC)** tracking for GST compliance.

---

## Table Definition

```sql
CREATE TABLE purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_number TEXT UNIQUE NOT NULL,           -- PUR-YYYYMMDD-NNNN
  supplier_name TEXT NOT NULL,                    -- Snapshot of vendor
  supplier_gstin TEXT,                            -- Snapshot for ITC
  invoice_number TEXT,                            -- The vendor's invoice #
  invoice_date TEXT NOT NULL,                     -- Effective tax date
  total_taxable REAL NOT NULL CHECK(total_taxable >= 0),
  cgst_amount REAL NOT NULL DEFAULT 0,
  sgst_amount REAL NOT NULL DEFAULT 0,
  igst_amount REAL NOT NULL DEFAULT 0,
  gst_total REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL CHECK(grand_total >= 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Column Specifications

### Identification

| Column            | Type | Constraints      | Description                               |
| ----------------- | ---- | ---------------- | ----------------------------------------- |
| `purchase_number` | TEXT | UNIQUE, NOT NULL | SmartKhata internal reference             |
| `invoice_number`  | TEXT |                  | Vendor's physical invoice number          |
| `invoice_date`    | TEXT | NOT NULL         | The date on the physical invoice          |

---

### Snapshots

| Column           | Type | Description                                   |
| ---------------- | ---- | --------------------------------------------- |
| `supplier_name`  | TEXT | Vendor name at time of purchase               |
| `supplier_gstin` | TEXT | Vendor GSTIN at time of purchase (for ITC)    |

**Why Snapshots?**
If a supplier rebrands or changes their GSTIN in the future, your historical Input Tax Credit claims for this specific invoice must remain legally accurate according to the original document.

---

### Monetary & Tax Totals

| Column         | Type | Constraints | Description                              |
| -------------- | ---- | ----------- | ---------------------------------------- |
| `total_taxable`| REAL | >= 0        | Subtotal before GST                      |
| `gst_total`    | REAL |             | Total tax paid (Availabe as ITC)         |
| `grand_total`  | REAL | >= 0        | Total amount payable to supplier         |

**GST Detailed Breakdown:**

To support GSTR-3B filing, the tax is split into:
- `cgst_amount` (Central Tax)
- `sgst_amount` (State Tax)
- `igst_amount` (Integrated Tax for interstate purchases)

---

## Design Choices

### 1. RUPEES Storage
Consistent with other tables, all monetary values are `REAL` (Rupees) with 2-decimal precision.

### 2. ITC Availability
Entries in this table are treated as **Confirmed Input Tax Credit**. The `ReportRepository` aggregates `gst_total` from this table as positive credit to offset Sales Tax Liability.

---

## Indexes

```sql
-- Fast lookup by internal number
CREATE INDEX idx_purchases_number ON purchases(purchase_number);

-- Filter by vendor for balance reports
CREATE INDEX idx_purchases_supplier ON purchases(supplier_name);

-- Date range filters for tax filing periods
CREATE INDEX idx_purchases_invoice_date ON purchases(invoice_date);
```

---

## Usage Examples

### Calculate Net GST Payable

```typescript
// The core logic of the GST Report
const netPayable = (OutputGst - CreditNoteReversals) - InputPurchasesItc;
```

### Record a Purchase

```typescript
db.execute(`
  INSERT INTO purchases (purchase_number, supplier_name, supplier_gstin, grand_total, gst_total)
  VALUES ('PUR-20260228-0001', 'Vikas Dist', '24AAAAA0000A1Z5', 1180, 180)
`);
```

---

## Summary

| Aspect              | Design Choice                 | Rationale                                |
| ------------------- | ----------------------------- | ---------------------------------------- |
| **Historical Accuracy**| Full snapshots of vendor data| Legally required for audit compliance    |
| **ITC Reporting**   | Granular CGST/SGST/IGST splits| Facilitates automated GSTR prep          |
| **Ref System**      | `purchase_number`             | Unique internal ID for easy search       |

**The purchases table ensures your stock entry is audit-ready and tax-compliant!**
