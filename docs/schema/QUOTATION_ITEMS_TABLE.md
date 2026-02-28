# Quotation Items Table Design

## Overview

The `quotation_items` table stores the individual products and quantities listed in a Sales Estimate. It parallels the structure of `bill_items` but has no effect on real inventory.

---

## Table Definition

```sql
CREATE TABLE quotation_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_id INTEGER NOT NULL,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  gst_percent REAL NOT NULL,
  line_total REAL NOT NULL,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
);
```

---

## Column Specifications

### Relationships

| Column         | Type    | Constraints          | Description                   |
| -------------- | ------- | -------------------- | ----------------------------- |
| `quotation_id` | INTEGER | FOREIGN KEY (CASCADE)| Parent estimate link          |

---

### Item Data

| Column         | Type | Constraints | Description                                   |
| -------------- | ---- | ----------- | --------------------------------------------- |
| `product_id`   | INT  |             | Optional link to master inventory             |
| `product_name` | TEXT | NOT NULL    | Snapshot of the product name                  |

---

## Design Choices

### 1. No Stock Impact
Unlike `bill_items`, adding rows here does not decrement `products.stock_qty`. It is a purely informative record.

### 2. Cascading Purge
When a Quotation is deleted, these items are automatically cleaned up to maintain database efficiency.

---

## Indexes

```sql
-- Fast retrieval for quote document (PDF) generation
CREATE INDEX idx_quotation_items_parent ON quotation_items(quotation_id);
```

---

## Summary

| Aspect              | Design Choice                 | Rationale                                |
| ------------------- | ----------------------------- | ---------------------------------------- |
| **Integrity**       | Cascading Delete              | Simplified cleanup                       |
| **Snapshot**        | Name snapshotting             | Record stability                         |
| **Quantity**        | REAL supportive               | Handles bulk weights in quotes           |

**The quotation items table ensures your sales estimates are detailed and professional!**
