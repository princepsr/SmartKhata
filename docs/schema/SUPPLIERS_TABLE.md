# Suppliers Table Design

## Overview

The `suppliers` table manages vendor and distributor records, serving as the foundation for **Accounts Payable** tracking. It stores contact details, B2B tax information, and the current outstanding balance owed to the supplier.

---

## Table Definition

```sql
CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  gstin TEXT,
  address TEXT,
  email TEXT,
  balance_due REAL DEFAULT 0, -- Positive = we owe them
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Column Specifications

### Primary Key

| Column | Type    | Constraints               | Description                |
| ------ | ------- | ------------------------- | -------------------------- |
| `id`   | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique supplier identifier |

---

### Supplier Identification

| Column  | Type | Constraints | Description                    |
| ------- | ---- | ----------- | ------------------------------ |
| `name`  | TEXT | NOT NULL    | Commercial name of the vendor  |
| `phone` | TEXT | UNIQUE      | Primary contact mobile number  |
| `gstin` | TEXT |             | 15-digit Indian GST Identifier |

**Design Choices:**

- **`phone` uniqueness**: Prevents duplicate supplier accounts, ensuring the ledger remains clean.
- **`gstin` optional**: Allows recording purchases from unregistered dealers (URDs) or small vendors.

---

### Financial Tracking

| Column        | Type | Constraints | Description                   |
| ------------- | ---- | ----------- | ----------------------------- |
| `balance_due` | REAL | DEFAULT 0   | Current net balance in Rupees |

**Balance Logic:**

- **`+ ₹X` (Positive)**: The shop owes money to the supplier (Credit Purchase).
- **`- ₹X` (Negative)**: The shop has paid in advance or is owed a refund (Debit Note / Advance).

---

### Status & Timestamps

| Column       | Type    | Constraints     | Description                          |
| ------------ | ------- | --------------- | ------------------------------------ |
| `is_active`  | INTEGER | DEFAULT 1 (1/0) | Soft delete flag                     |
| `created_at` | TEXT    | DEFAULT (now)   | Registration date (ISO 8601)         |
| `updated_at` | TEXT    | DEFAULT (now)   | Last profile modification (ISO 8601) |

---

## Indexes

```sql
-- Fast lookup by name for search/autocomplete
CREATE INDEX idx_suppliers_name ON suppliers(name);

-- Fast lookup by phone for identification
CREATE INDEX idx_suppliers_phone ON suppliers(phone);
```

---

## Usage Examples

### Create Supplier

```typescript
const supplier = {
  name: 'Vikas Distributors',
  phone: '9876543210',
  gstin: '24AAAAA0000A1Z5',
  balance_due: 0,
};

db.execute(
  `
  INSERT INTO suppliers (name, phone, gstin) 
  VALUES (?, ?, ?)
`,
  [supplier.name, supplier.phone, supplier.gstin]
);
```

### Update Balance (Purchase)

```typescript
// When receiving an invoice of ₹5000 on credit
db.execute(
  `
  UPDATE suppliers 
  SET balance_due = balance_due + ?, updated_at = datetime('now')
  WHERE id = ?
`,
  [5000, supplierId]
);
```

---

## Summary

| Aspect               | Design Choice            | Rationale                               |
| -------------------- | ------------------------ | --------------------------------------- |
| **Balance Tracking** | REAL (Rupees)            | Consistency with billing and inventory  |
| **Soft Delete**      | `is_active` flag         | Preserves historical purchase integrity |
| **GSTIN**            | Snapshotting recommended | Legal requirement for B2B tax filing    |

**The suppliers table ensures rigorous tracking of vendor debts and procurement history!**
