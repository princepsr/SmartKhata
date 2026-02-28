# Credit Notes Table Design

## Overview

The `credit_notes` table records Sales Returns (reversal of `bills`). It is a **Financial Reversal Entity** that decrements the total tax liability (Output GST) and modifies the corresponding customer or cash balance.

---

## Table Definition

```sql
CREATE TABLE credit_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  credit_note_number TEXT UNIQUE NOT NULL,        -- CN-YYYYMMDD-NNNN
  original_bill_id INTEGER,                       -- Linking to original sale
  original_bill_number TEXT,                      -- Snapshot of original bill #
  customer_id INTEGER,                            -- Linked customer
  reason TEXT NOT NULL,                           -- 'DEFECTIVE', 'EXCESS', etc.
  refund_amount REAL NOT NULL CHECK(refund_amount >= 0),
  taxable_amount REAL NOT NULL DEFAULT 0,
  cgst_amount REAL NOT NULL DEFAULT 0,
  sgst_amount REAL NOT NULL DEFAULT 0,
  igst_amount REAL NOT NULL DEFAULT 0,
  gst_total REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (original_bill_id) REFERENCES bills(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);
```

---

## Column Specifications

### Identification & Linking

| Column                | Type    | Constraints               | Description                     |
| --------------------- | ------- | ------------------------- | ------------------------------- |
| `credit_note_number`  | TEXT    | UNIQUE, NOT NULL          | Legal document number           |
| `original_bill_id`    | INTEGER | FOREIGN KEY (SET NULL)    | Reference to original sales bill|
| `original_bill_number`| TEXT    | Snapshot                  | Preserves original bill ID string|

**Why Link to `original_bill_id`?**
To prevent "Ghost Returns". By linking, the system can verify that the items being returned were actually sold in that specific bill and at what specific price (accounting for historical discounts).

---

### Reversal Totals

| Column           | Type | Description                              |
| ---------------- | ---- | ---------------------------------------- |
| `refund_amount`  | REAL | Total cash/credit returned (Tax Included)|
| `taxable_amount` | REAL | Total taxable base being reversed        |
| `gst_total`      | REAL | Total tax originally collected now reversed|

**GS Detailed Breakdown:**
Like the `bills` table, granular splits (`cgst_amount`, `sgst_amount`, `igst_amount`) are stored to ensure the periodic Output Tax Liability is accurately reduced for the correct government department.

---

## Design Choices

### 1. Snapshotting for Integrity
The `original_bill_number` is snapshotted to ensure the Credit Note remains readable even if the `bills` record is archived or manually cleaned (though the system prevents `bills` deletion).

### 2. Negative Stock Prevention
When a Credit Note is created, the system **Increments** the `products.stock_qty` (adding the item back to the shelf), provided it isn't flagged as 'DEFECTIVE' for write-off.

---

## Indexes

```sql
-- Fast search for individual Credit Note
CREATE INDEX idx_credit_notes_number ON credit_notes(credit_note_number);

-- Traceability lookup from original bill
CREATE INDEX idx_credit_notes_original_bill ON credit_notes(original_bill_id);

-- Date range filters for tax returns (GSTR-1)
CREATE INDEX idx_credit_notes_created_at ON credit_notes(created_at);
```

---

## Usage Examples

### Reversing Output Tax Liability

```typescript
// Part of GSTR-1 preparation
const totalOutputGst = (AllSalesGst - CreditNoteGst);
```

---

## Summary

| Aspect              | Design Choice                 | Rationale                                |
| ------------------- | ----------------------------- | ---------------------------------------- |
| **Integrity**       | Linked to original bill       | Prevents manual entry errors and fraud|
| **Audit Path**      | Full GST breakdown            | Required for legal tax filing (Reversals)|
| **State**           | Immutable Finality            | Reversals are legal documents; no edits  |

**The credit notes table ensures your returns process is legal and financially accurate!**
