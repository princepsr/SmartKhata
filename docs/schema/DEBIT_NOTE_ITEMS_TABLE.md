# Debit Note Items Table Design

## Overview

The `debit_note_items` table stores granular details for products being returned to suppliers. It acts as the mirror for `purchase_items` but subtracts value from the inventory and financial ledgers.

---

## Table Definition

```sql
CREATE TABLE debit_note_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debit_note_id INTEGER NOT NULL,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  gst_percent REAL NOT NULL,
  line_total REAL NOT NULL,
  FOREIGN KEY (debit_note_id) REFERENCES debit_notes(id) ON DELETE CASCADE
);
```

---

## Column Specifications

### Item Data

| Column         | Type    | Constraints       | Description                                  |
| -------------- | ------- | ----------------- | -------------------------------------------- |
| `product_id`   | INTEGER |                   | Optional link to the master catalog       |
| `product_name` | TEXT    | NOT NULL          | Snapshot of name in the original purchase    |

---

### Reversal Quantities

| Column        | Type | Description                                   |
| ------------- | ---- | --------------------------------------------- |
| `quantity`    | REAL | Number of units returned (Supports decimals)  |
| `unit_price`  | REAL | Cost price originally paid to vendor          |
| `line_total`  | REAL | Total value reversal including tax            |

---

## Design Choices

### 1. Decimal Quantity
Essential for Bulk/Kirana modes where goods like oil or sugar might be returned in partial weights.

### 2. Cascading Delete
If a Debit Note is deleted (e.g., entered in error), the row items are automatically purged to keep the database size optimized.

---

## Indexes

```sql
-- Fast retrieval for printing Debit Note vouchers (A4/Thermal)
CREATE INDEX idx_debit_note_items_parent ON debit_note_items(debit_note_id);
```

---

## Summary

| Aspect              | Design Choice                 | Rationale                                |
| ------------------- | ----------------------------- | ---------------------------------------- |
| **Logic**           | Inverse Purchase              | Reverses stock and cost accurately       |
| **Snapshot**        | Name snapshotting             | Preserves record even if item is renamed |
| **Integrity**       | Cascade on parent             | Prevents orphaned result rows            |

**The debit note items table ensures your purchase return records remain accurate and detailed!**
