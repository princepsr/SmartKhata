# Purchase Items Table Design

## Overview

The `purchase_items` table stores line-item details for every procurement invoice. It links the master `purchases` record to individual `products`, recording the quantity, cost price, and tax at the moment of acquisition.

---

## Table Definition

```sql
CREATE TABLE purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  hsn_code TEXT,
  quantity REAL NOT NULL CHECK(quantity > 0),
  unit_price REAL NOT NULL CHECK(unit_price >= 0),
  gst_percent REAL NOT NULL DEFAULT 0 CHECK(gst_percent >= 0),
  line_taxable REAL NOT NULL DEFAULT 0,
  line_cgst REAL NOT NULL DEFAULT 0,
  line_sgst REAL NOT NULL DEFAULT 0,
  line_igst REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL CHECK(line_total >= 0),
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);
```

---

## Column Specifications

### Relationships

| Column        | Type    | Constraints               | Description                               |
| ------------- | ------- | ------------------------- | ----------------------------------------- |
| `purchase_id` | INTEGER | FOREIGN KEY (NOT NULL)    | Reference to the parent invoice           |
| `product_id`  | INTEGER | FOREIGN KEY (NULL Allowed)| Link to the local master inventory table  |

**Design Choice: `SET NULL` on `product_id`**
If a product is deleted from the master catalog, the purchase record must remain intact for tax audit purposes. The `product_name` snapshot ensures the invoice is still readable.

---

### Item Specifications

| Column        | Type | Constraints | Description                                   |
| ------------- | ---- | ----------- | --------------------------------------------- |
| `product_name`| TEXT | NOT NULL    | Snapshot of the product name                  |
| `hsn_code`    | TEXT |             | Tax classification for the item               |
| `quantity`    | REAL | NOT NULL    | Number of units bought (Supports fractions)   |

---

### Financial & Tax Splits

| Column        | Type | Constraints | Description                              |
| -------------- | ---- | ----------- | ---------------------------------------- |
| `unit_price`   | REAL | NOT NULL    | The cost of 1 unit (Excl. Tax)           |
| `line_taxable` | REAL |             | Total taxable value for this row         |
| `line_total`   | REAL | NOT NULL    | Final value of row (Taxable + Tax)       |

**Tax Details:**
The table includes granular splits (`line_cgst`, `line_sgst`, `line_igst`) to ensure that tax liability set-offs can be verified line-by-line during a GST audit.

---

## Design Choices

### 1. Inventory Link
Unlike `bill_items`, which only snapshots info, `purchase_items` is the primary driver for **Stock Increments**. When a purchase is saved, the system iterates through these items and increments `products.stock_qty`.

### 2. Fractional Quantity (`REAL`)
Crucial for **Kirana Mode** (e.g., buying 5.5 Kg of pulses) and **Medical Mode** (e.g., buying 1.5 strips).

---

## Indexes

```sql
-- Fast lookup of all items in a single invoice
CREATE INDEX idx_purchase_items_purchase_id ON purchase_items(purchase_id);
```

---

## Usage Examples

### Stock Replenishment Logic

```typescript
// When a purchase is finalized
purchase_items.forEach(item => {
  productRepo.updateStock(item.product_id, item.quantity);
  // Log movement as PURCHASE
  inventoryLogRepo.log(item.product_id, item.quantity, 'PURCHASE');
});
```

---

## Summary

| Aspect              | Design Choice                 | Rationale                                |
| ------------------- | ----------------------------- | ---------------------------------------- |
| **Integrity**       | `ON DELETE CASCADE`           | Items vanish if the main invoice is voided|
| **Audit Trace**     | `product_name` snapshot       | Human-readable history                   |
| **Calculation**     | Granular tax splits           | Precision for GST filings                |

**The purchase items table is the engine that drives stock growth and tax credits!**
