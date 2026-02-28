# Purchase Order Items Table Design

## Overview

The `purchase_order_items` table stores line-item estimates for a pending procurement order. It mirrors the structure of `purchase_items` but acts as an independent "Draft" layer that has no effect on real-time inventory counts.

---

## Table Definition

```sql
CREATE TABLE purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id INTEGER NOT NULL,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  hsn_code TEXT,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  gst_percent REAL NOT NULL,
  line_total REAL NOT NULL,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
);
```

---

## Column Specifications

### Parent Relationship

| Column              | Type    | Constraints          | Description                   |
| ------------------- | ------- | -------------------- | ----------------------------- |
| `purchase_order_id` | INTEGER | FOREIGN KEY (NOT NULL) | Parent PO link              |

---

### Item Metadata

| Column         | Type | Constraints | Description                                   |
| -------------- | ---- | ----------- | --------------------------------------------- |
| `product_id`   | INTEGER |          | Link to master inventory (optional linkage)   |
| `product_name` | TEXT | NOT NULL    | Snapshot of item description                  |

---

### Estimated Quantities & Values

| Column        | Type | Description                                   |
| ------------- | ---- | --------------------------------------------- |
| `quantity`    | REAL | Targeted quantity to order                    |
| `unit_price`  | REAL | Targeted cost per unit                        |
| `line_total`  | REAL | Total for this line including estimated tax   |

---

## Design Choices

### 1. `REAL` for Kirana/Bulk
Just like the main Purchase items, the PO items support decimal quantities (e.g. "Order 50.5 KG of sugar") which is essential for Grocery wholesalers.

### 2. Decoupled Workflow
Values here are **Estimated**. When the PO is converted to a `PURCHASE`, the system allows the operator to override the `quantity` and `unit_price` if the physical goods delivered differ from the order (e.g. partial fulfillment).

---

## Indexes

```sql
-- Fast retrieval of items for PO Document (PDF) generation
CREATE INDEX idx_po_items_parent ON purchase_order_items(purchase_order_id);
```

---

## Usage Examples

### Cloning to a Live Purchase

```typescript
// Part of the Receive PO workflow
function convertToPurchaseItems(poId: number, purchaseId: number) {
  db.execute(`
    INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, unit_price, line_total)
    SELECT ?, product_id, product_name, quantity, unit_price, line_total
    FROM purchase_order_items WHERE purchase_order_id = ?
  `, [purchaseId, poId]);
}
```

---

## Summary

| Aspect              | Design Choice                 | Rationale                                |
| ------------------- | ----------------------------- | ---------------------------------------- |
| **State**           | Transitional / Draft          | Decouples planning from inventory reality|
| **Cleanup**         | `ON DELETE CASCADE`           | Order items are deleted if PO record is  |
| **Linkage**         | Optional `product_id`         | Allows ordering items not yet in catalog |

**The purchase order items table ensures your procurement planning remains accurate and organized!**
