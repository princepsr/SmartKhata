# Debit Notes Table Design

## Overview

The `debit_notes` table records Purchase Returns (reversal of `purchases`). It is a **Financial Reversal Entity** that decrements the Input Tax Credit (ITC) claim and reduces the balance due to the supplier (Accounts Payable).

---

## Table Definition

```sql
CREATE TABLE debit_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debit_note_number TEXT UNIQUE NOT NULL,
  purchase_id INTEGER,
  supplier_id INTEGER NOT NULL,
  total_taxable REAL NOT NULL,
  gst_total REAL NOT NULL,
  grand_total REAL NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);
```

---

## Column Specifications

### Identification & Linking

| Column                | Type    | Constraints               | Description                     |
| --------------------- | ------- | ------------------------- | ------------------------------- |
| `debit_note_number`  | TEXT    | UNIQUE, NOT NULL           | Internal reference (DN-YYYY-NNN)|
| `purchase_id`         | INTEGER | FOREIGN KEY (SET NULL)    | Reference to original purchase  |
| `supplier_id`         | INTEGER | FOREIGN KEY (NOT NULL)    | Reference to distributor        |

**Business Logic: Linked Returns**
Linking to `purchase_id` is recommended to ensure that the cost price and tax being reversed matches the original inward invoice.

---

### Reversal Totals

| Column           | Type | Description                              |
| ---------------- | ---- | ---------------------------------------- |
| `grand_total`    | REAL | Total amount deducted from supplier debt |
| `total_taxable`  | REAL | Taxable portion effectively reversed     |
| `gst_total`      | REAL | GST originally claimed now forfeited     |

---

## Design Choices

### 1. ITC Correction
When a Debit Note is filed, the periodic "Net Product Tax" report subtracts this `gst_total` from the available Input Tax Credit, preventing over-claiming of GST during filing.

### 2. Stock Deduction
Creation of a Debit Note triggers an automatic **Decrement** in `products.stock_qty`. This mirrors the physical act of returning goods to the distributor's truck.

---

## Indexes

```sql
-- Fast search for DN records
CREATE INDEX idx_debit_notes_number ON debit_notes(debit_note_number);

-- Supplier purchase history verification
CREATE INDEX idx_debit_notes_supplier_id ON debit_notes(supplier_id);
```

---

## Usage Examples

### Reversing Supplier Debt

```typescript
// Part of the Debit Note finalization service
db.transaction(() => {
  // 1. Reduce Amount Owed to Vendor
  db.execute(`UPDATE suppliers SET balance_due = balance_due - ? WHERE id = ?`, [amount, supplierId]);
  
  // 2. Reduce Stock
  db.execute(`UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?`, [qty, prodId]);
});
```

---

## Summary

| Aspect              | Design Choice                 | Rationale                                |
| ------------------- | ----------------------------- | ---------------------------------------- |
| **Balance Impact**  | Decrement Debt                | Direct reversal of accounts payable      |
| **GST Logic**       | Reverses ITC claim            | Mandatory for Indian Tax Compliance      |
| **Integrity**       | Linked to parent Supplier     | Guarantees valid accounts payable flow   |

**The debit notes table ensures your purchase returns are mathematically and legally sound!**
