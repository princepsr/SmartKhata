# Customer Ledger Table Design

## Overview

The `customer_ledger` table serves as the **Double-Entry Audit Trail** for customer finances. Every time a bill is generated (Credit Sale) or a payment is received (Udhaar Settlement), an entry is made here.

---

## Table Definition

```sql
CREATE TABLE customer_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('SALE', 'PAYMENT_IN', 'PAYMENT_OUT', 'OPENING_BALANCE', 'REFUND')),
  reference_id INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
```

---

## Column Specifications

### Reference Keys

| Column         | Type    | Constraints            | Description                             |
| -------------- | ------- | ---------------------- | --------------------------------------- |
| `customer_id`  | INTEGER | FOREIGN KEY (NOT NULL) | Parent customer record                  |
| `reference_id` | INTEGER |                        | ID of the Bill, Credit Note, or Payment |

---

### Transaction Details

| Column   | Type | Constraints   | Description                     |
| -------- | ---- | ------------- | ------------------------------- |
| `amount` | REAL | NOT NULL      | The transaction value in Rupees |
| `type`   | TEXT | CHECK(IN ...) | Transaction category            |

**Transaction Types:**

| Type              | Description                                     | Balance Impact |
| ----------------- | ----------------------------------------------- | -------------- |
| `SALE`            | Credit sale (Udhaar) generated from POS         | Increases Due  |
| `PAYMENT_IN`      | Customer pays their pending balance             | Decreases Due  |
| `PAYMENT_OUT`     | Shop pays customer (excess refund)              | Increases Due  |
| `REFUND`          | Item returned, amount credited to balance       | Decreases Due  |
| `OPENING_BALANCE` | Initial balance set during migration/onboarding | Set Value      |

---

## Design Choices

### 1. Atomic Aggregation

The `customers.balance_due` column is strictly a cache of the sum of `customer_ledger` entries.

- **Integrity**: Any service modifying `balance_due` MUST create a corresponding `customer_ledger` entry in the same transaction.
- **Verification**: `SELECT SUM(amount) FROM customer_ledger WHERE customer_id = X` should equal `customers.balance_due`.

### 2. Snaphotting vs Linking

- **`reference_id`**: Links to `bills.id` or `credit_notes.id`.
- **`amount`**: The value is snapshotted. Even if a bill is later voided, the ledger entry remains (or is reversed with a new entry) to preserve the historical timeline.

---

## Indexes

```sql
-- Historical timeline query for specific customer
CREATE INDEX idx_customer_ledger_customer_id ON customer_ledger(customer_id);

-- Date range reporting / daily summaries
CREATE INDEX idx_customer_ledger_created_at ON customer_ledger(created_at);
```

---

## Usage Examples

### Record a Payment (Udhaar Settlement)

```typescript
// Atomically update balance and log to ledger
db.transaction(() => {
  const amount = 200;

  // 1. Update master balance
  db.execute(`UPDATE customers SET balance_due = balance_due - ? WHERE id = ?`, [
    amount,
    customerId,
  ]);

  // 2. Add ledger entry
  db.execute(
    `
    INSERT INTO customer_ledger (customer_id, amount, type, notes)
    VALUES (?, ?, 'PAYMENT_IN', ?)
  `,
    [customerId, -amount, 'Monthly settlement']
  );
});
```

---

## Summary

| Aspect          | Design Choice       | Rationale                                |
| --------------- | ------------------- | ---------------------------------------- |
| **Consistency** | `ON DELETE CASCADE` | Ledger dies with customer (avoids drift) |
| **Audit Path**  | Type-based logic    | Easy debugging of balance mismatch       |
| **Storage**     | REAL (Rupees)       | Mathematical alignment                   |

**The customer ledger is the ultimate source of truth for "Udhaar" management!**
