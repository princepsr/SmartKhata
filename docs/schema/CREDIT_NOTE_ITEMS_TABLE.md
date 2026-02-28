# Credit Note Items Table Design

## Overview

The `credit_note_items` table stores line-item details for Sales Returns. It records the specific products, quantities, and taxable values being returned to the inventory.

---

## Table Definition

```sql
CREATE TABLE credit_note_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  credit_note_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name_snapshot TEXT NOT NULL,
  hsn_code TEXT,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price REAL NOT NULL CHECK(unit_price >= 0),
  gst_percent REAL NOT NULL CHECK(gst_percent >= 0),
  line_taxable REAL NOT NULL DEFAULT 0,
  line_cgst REAL NOT NULL DEFAULT 0,
  line_sgst REAL NOT NULL DEFAULT 0,
  line_igst REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL CHECK(line_total >= 0),
  FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);
```

---

## Column Specifications

### Parent Relationship

| Column           | Type    | Constraints          | Description                   |
| ---------------- | ------- | -------------------- | ----------------------------- |
| `credit_note_id` | INTEGER | FOREIGN KEY (NOT NULL) | Parent document link        |

---

### Product Data

| Column         | Type    | Constraints       | Description                                  |
| -------------- | ------- | ----------------- | -------------------------------------------- |
| `product_id`   | INTEGER | FOREIGN KEY (RESTRICT) | Links to master product catalog           |
| `name_snapshot`| TEXT    | NOT NULL          | Preserves name at time of original sale        |

**Design Choice: `RESTRICT` Deletion on Products**
A product cannot be deleted if it is linked to a Credit Note. This ensures the inventory reversal trace always has a valid product target.

---

### Reversal Calculation

| Column        | Type | Description                                   |
| ------------- | ---- | --------------------------------------------- |
| `quantity`    | INT  | Number of units returned                      |
| `line_taxable`| REAL | Taxable portion returned for this item        |
| `line_total`  | REAL | Total cash value including tax for this row   |

---

## Design Choices

### 1. Integer Quantity
Unlike Purchases, `credit_note_items` uses `INTEGER` for quantity, as individual unit returns (Bills) are the primary source for this module.

### 2. Snaphotting
`unit_price` and `gst_percent` are pulled from the `bill_items` record (not the current product price) to ensure the refund matches the original amount paid.

---

## Indexes

```sql
-- Fast retrieval for return summaries or receipt printing
CREATE INDEX idx_credit_note_items_cn_id ON credit_note_items(credit_note_id);
```

---

## Summary

| Aspect              | Design Choice                 | Rationale                                |
| ------------------- | ----------------------------- | ---------------------------------------- |
| **Sync**            | `ON DELETE CASCADE`           | Items removed if CN is voided            |
| **Integrity**       | Restrict Product Deletion     | Guarantees valid audit trail             |
| **Calculation**     | Snaps price from original bill| Exact financial reversal guaranteed      |

**The credit note items table ensures your inventory and tax reversals are mathematically perfect!**
