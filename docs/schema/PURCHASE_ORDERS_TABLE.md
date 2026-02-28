# Purchase Orders Table Design

## Overview

The `purchase_orders` table manages planned procurement. It is a **Non-Financial Entity** (it does not affect ledgers or stock) until it is transitioned to a `RECEIVED` state, at which point it is converted into a live Purchase.

---

## Table Definition

```sql
CREATE TABLE purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number TEXT UNIQUE NOT NULL,
  supplier_id INTEGER NOT NULL,
  supplier_name_snapshot TEXT NOT NULL,
  po_date TEXT NOT NULL, -- YYYY-MM-DD
  total_taxable REAL NOT NULL DEFAULT 0,
  gst_total REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'RECEIVED', 'CANCELLED')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
);
```

---

## Column Specifications

### Identification & Workflow

| Column      | Type | Constraints      | Description                          |
| ----------- | ---- | ---------------- | ------------------------------------ |
| `po_number` | TEXT | UNIQUE, NOT NULL | Internal reference (PO-YYYYMMDD-NNNN)|
| `po_date`   | TEXT | NOT NULL         | Expected order issuance date         |
| `status`    | TEXT | CHECK(IN ...)    | Lifecycle state                      |

**PO Status Lifecycle:**

| Status      | Meaning                                            | Action |
| ----------- | -------------------------------------------------- | ------ |
| `PENDING`   | Draft/Sent. No impact on inventory or finance.     | Edit/Cancel possible |
| `RECEIVED`  | Goods arrived. Locked entry.                       | Conversion to Purchase |
| `CANCELLED` | Order voided by user or supplier.                  | Locked entry |

---

### Snapshots & FKs

| Column           | Type    | Constraints      | Description                               |
| ---------------- | ------- | ---------------- | ----------------------------------------- |
| `supplier_id`    | INTEGER | FK (RESTRICT)    | Links to master supplier record           |
| `name_snapshot`  | TEXT    |                  | Name at time of PO creation (for A4 PDFs) |

---

### Estimations

| Column         | Type | Description                              |
| -------------- | ---- | ---------------------------------------- |
| `total_taxable`| REAL | Estimated base cost                      |
| `grand_total`  | REAL | Estimated landing cost including taxes   |

---

## Design Choices

### 1. `RESTRICT` Deletion on Suppliers
A supplier cannot be deleted if they have a `PENDING` Purchase Order. This prevents "Orphaned Orders" that have no return address.

### 2. Snapshots for Document Generation
Because Purchase Orders are physical documents sent to distributors, the `supplier_name_snapshot` is critical. If your distributor changes their trade name mid-order, the PO you sent them remains legally linked to the name under which it was issued.

### 3. Workflow Engine
The `status` field is used by `PurchaseOrderService` to block multi-receipt. Once a PO is `RECEIVED`, any attempt to receive it again will be blocked at the database constraint level or via service logic.

---

## Indexes

```sql
-- Fast search by PO Number
CREATE INDEX idx_po_number ON purchase_orders(po_number);

-- Dashboard summaries (Pending Orders grid)
CREATE INDEX idx_po_status ON purchase_orders(status);

-- Supplier history lookup
CREATE INDEX idx_po_supplier_id ON purchase_orders(supplier_id);
```

---

## Usage Examples

### Receive a Purchase Order

```typescript
// Transition from Planning to Reality
db.transaction(() => {
  // 1. Mark PO as RECEIVED
  db.execute(`UPDATE purchase_orders SET status = 'RECEIVED' WHERE id = ?`, [poId]);
  
  // 2. Clone to Purchases Table (Live Transaction)
  db.execute(`
    INSERT INTO purchases (purchase_number, grand_total, supplier_name) 
    SELECT CONCAT('PUR-', po_number), grand_total, supplier_name_snapshot 
    FROM purchase_orders WHERE id = ?
  `, [poId]);
});
```

---

## Summary

| Aspect              | Design Choice                 | Rationale                                |
| ------------------- | ----------------------------- | ---------------------------------------- |
| **Logic Type**      | Tentative (Non-Impactful)     | POs are intentions, not finalities       |
| **PDF Stability**   | Name Snapshotting             | Ensures document consistency             |
| **State Machine**   | Checked Status Field          | Standardized workflow states             |

**The purchase orders table enables efficient supply chain planning and forecasting!**
