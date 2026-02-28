# Quotations Table Design

## Overview

The `quotations` table manages pre-sales estimates. It acts as a **Non-Financial Entity** (Estimates) that can be converted into a `bills` record once the customer approves the quote.

---

## Table Definition

```sql
CREATE TABLE quotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER,
  customer_name_snapshot TEXT NOT NULL,
  total_taxable REAL NOT NULL,
  gst_total REAL NOT NULL,
  grand_total REAL NOT NULL,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'CONVERTED', 'EXPIRED', 'CANCELLED')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);
```

---

## Column Specifications

### Workflow Control

| Column   | Type | Constraints    | Description                                   |
| -------- | ---- | -------------- | --------------------------------------------- |
| `status` | TEXT | CHECK(IN ...)  | Lifecycle state                               |

**Quotation States:**

- `PENDING`: Quote sent to customer.
- `CONVERTED`: Sales bill generated from this quote.
- `EXPIRED`: Time limit exceeded.
- `CANCELLED`: Quote voided.

---

### Quotation Summary

| Column          | Type | Description                              |
| --------------- | ---- | ---------------------------------------- |
| `total_taxable` | REAL | Subtotal of all quoted items             |
| `grand_total`   | REAL | Final estimated value including tax      |

---

## Design Choices

### 1. `SET NULL` on Customers
If a customer is deleted, their quotation history remains for internal sales performance tracking (e.g. "How many quotes did we lose last month?").

---

## Indexes

```sql
-- Fast search for individual Quote
CREATE INDEX idx_quotations_number ON quotations(quotation_number);

-- Filter by customer for relationship management
CREATE INDEX idx_quotations_customer_id ON quotations(customer_id);
```

---

## Summary

| Aspect              | Design Choice                 | Rationale                                |
| ------------------- | ----------------------------- | ---------------------------------------- |
| **Logic**           | Pre-Sales Estimate            | Non-impacting ledger draft               |
| **Conversion**      | Link to Bill (Future)         | Enables sales funnel tracking            |
| **Integrity**       | Snapshotting name             | Clear history even for deleted customers |

**The quotations table helps you track potential sales and generate professional estimates!**
