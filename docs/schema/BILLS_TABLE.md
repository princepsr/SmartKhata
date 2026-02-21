# Bills Table Design

## Overview

The `bills` table stores billing transactions with **immutable final totals**. This is a critical design decision for audit compliance and data integrity in a POS system.

---

## Table Definition

```sql
CREATE TABLE bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER,
  subtotal REAL NOT NULL CHECK(subtotal >= 0),
  gst_total REAL NOT NULL DEFAULT 0 CHECK(gst_total >= 0),
  discount_amount REAL NOT NULL DEFAULT 0 CHECK(discount_amount >= 0),
  grand_total REAL NOT NULL CHECK(grand_total >= 0),
  payment_mode TEXT NOT NULL DEFAULT 'cash' CHECK(payment_mode IN ('cash', 'upi', 'mixed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);
```

---

## Column Specifications

### Primary Key

| Column | Type    | Constraints               | Description            |
| ------ | ------- | ------------------------- | ---------------------- |
| `id`   | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique bill identifier |

---

### Bill Identification

| Column        | Type | Constraints      | Description                |
| ------------- | ---- | ---------------- | -------------------------- |
| `bill_number` | TEXT | NOT NULL, UNIQUE | Human-readable bill number |

**Design Choices:**

**`bill_number` Format:**

```
BILL-YYYYMMDD-NNNN
```

**Examples:**

- `BILL-20260208-0001` (First bill on Feb 8, 2026)
- `BILL-20260208-0002` (Second bill on Feb 8, 2026)
- `BILL-20260209-0001` (First bill on Feb 9, 2026)

**Why this format:**

- ✅ **Human-readable:** Easy to read on receipts
- ✅ **Sortable:** Lexicographic sort = chronological sort
- ✅ **Sequential per day:** Easy to track daily bill count
- ✅ **Unique:** Date + sequence ensures uniqueness
- ✅ **Audit-friendly:** Clear date in bill number

**Generation Logic:**

```typescript
function generateBillNumber(date: Date): string {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

  // Get max sequence for today
  const maxBill = db.queryOne(
    `
    SELECT bill_number FROM bills 
    WHERE bill_number LIKE ? 
    ORDER BY bill_number DESC 
    LIMIT 1
  `,
    [`BILL-${dateStr}-%`]
  );

  const sequence = maxBill ? parseInt(maxBill.bill_number.split('-')[2]) + 1 : 1;

  return `BILL-${dateStr}-${sequence.toString().padStart(4, '0')}`;
}
```

**UNIQUE Constraint:**

- Prevents duplicate bill numbers
- Database-level enforcement (safer than app-level)

---

### Customer Reference

| Column        | Type    | Constraints               | Description                  |
| ------------- | ------- | ------------------------- | ---------------------------- |
| `customer_id` | INTEGER | FOREIGN KEY, NULL allowed | Reference to customers table |

**Design Choices:**

**NULL Allowed:**

- Walk-in customers don't need a customer record
- Simplifies checkout for quick sales
- Optional customer tracking

**Foreign Key with ON DELETE SET NULL:**

```sql
FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
```

**Why SET NULL (not CASCADE or RESTRICT):**

- If customer is deleted, bill remains valid
- Bill history is preserved (audit requirement)
- `customer_id` becomes NULL (indicates deleted customer)

**Alternative considered:**

- ON DELETE RESTRICT: ❌ Prevents customer deletion if they have bills
- ON DELETE CASCADE: ❌ Deletes bills when customer deleted (data loss)

---

### Monetary Totals (IMMUTABLE)

| Column            | Type    | Constraints    | Description                              |
| ----------------- | ------- | -------------- | ---------------------------------------- |
| `subtotal`        | INTEGER | NOT NULL, >= 0 | Sum of item prices (before GST/discount) |
| `gst_total`       | INTEGER | NOT NULL, >= 0 | Total GST amount                         |
| `discount_amount` | INTEGER | NOT NULL, >= 0 | Total discount applied                   |
| `grand_total`     | INTEGER | NOT NULL, >= 0 | Final amount (subtotal + GST - discount) |

**Design Choices:**

**REAL Storage (Rupees):**

- All monetary values in Rupees (same as products, customers)
- Direct mapping to UI and simple calculations

**IMMUTABLE Totals:**

> [!IMPORTANT]
> **Critical Design Decision: Immutable Totals**
>
> Once a bill is created, the totals **NEVER CHANGE**. This is a fundamental requirement for:
>
> - **Audit compliance:** Financial records must be tamper-proof
> - **Legal requirement:** Bills cannot be retroactively modified
> - **Data integrity:** Historical accuracy is paramount
>
> **Implication:** Totals are stored in the `bills` table, NOT recalculated from `bill_items`.

**Why store totals (not calculate from items):**

| Approach                 | Pros                                             | Cons                                               | Decision      |
| ------------------------ | ------------------------------------------------ | -------------------------------------------------- | ------------- |
| **Store totals**         | ✅ Immutable<br>✅ Fast queries<br>✅ Audit-safe | ⚠️ Redundant data                                  | ✅ **CHOSEN** |
| **Calculate from items** | ✅ No redundancy                                 | ❌ Mutable<br>❌ Slow queries<br>❌ Not audit-safe | ❌ Rejected   |

**Calculation Formula:**

```
grand_total = subtotal + gst_total - discount_amount
```

**Example:**

```typescript
const subtotal = 100.0;
const gstTotal = 18.0; // 18% GST
const discountAmount = 5.0;
const grandTotal = subtotal + gstTotal - discountAmount; // 113.00
```

**Validation:**

```typescript
// Ensure grand_total matches calculation
if (grandTotal !== subtotal + gstTotal - discountAmount) {
  throw new Error('Bill total calculation mismatch');
}
```

**NOT NULL with DEFAULT 0:**

- `gst_total` and `discount_amount` default to 0 (bills without GST/discount)
- `subtotal` and `grand_total` are always required

---

### Payment Information

| Column         | Type | Constraints                | Description    |
| -------------- | ---- | -------------------------- | -------------- |
| `payment_mode` | TEXT | NOT NULL, CHECK constraint | Payment method |

**Design Choices:**

**Allowed Values:**

```sql
CHECK(payment_mode IN ('cash', 'upi', 'mixed'))
```

| Value   | Meaning                   | Use Case                           |
| ------- | ------------------------- | ---------------------------------- |
| `cash`  | Full payment in cash      | Most common in kirana shops        |
| `upi`   | Full payment via UPI      | Growing trend                      |
| `mixed` | Combination of cash + UPI | Customer pays ₹500 cash + ₹500 UPI |

**Why 'mixed' mode:**

- Common scenario: Customer pays partial cash, partial UPI
- Simplifies checkout (no need to split bill)
- Details tracked in separate `payments` table (future enhancement)

**Alternative considered:**

- Store only one payment method: ❌ Doesn't handle mixed payments
- Store payment details in bills table: ❌ Clutters schema

**Future Enhancement (Payments Table):**

```sql
CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL CHECK(method IN ('cash', 'upi')),
  FOREIGN KEY (bill_id) REFERENCES bills(id)
);
```

---

### Audit Timestamp

| Column       | Type | Constraints | Description                        |
| ------------ | ---- | ----------- | ---------------------------------- |
| `created_at` | TEXT | NOT NULL    | Bill creation timestamp (ISO 8601) |

**Design Choices:**

**No `updated_at` field:**

- Bills are **immutable** once created
- No updates allowed (audit requirement)
- Only `created_at` is needed

**If bill needs to be cancelled:**

- Don't delete or update the bill
- Create a separate `is_void` flag (future enhancement)
- Or create a reverse bill (credit note)

---

## Indexes

### Performance Indexes

```sql
-- Bill number lookup (unique, automatic index)
CREATE UNIQUE INDEX idx_bills_bill_number ON bills(bill_number);

-- Date-based queries (daily/monthly reports)
CREATE INDEX idx_bills_created_at ON bills(created_at);

-- Customer bills lookup
CREATE INDEX idx_bills_customer_id ON bills(customer_id);

-- Payment mode reports
CREATE INDEX idx_bills_payment_mode ON bills(payment_mode);
```

**Why these indexes:**

| Index          | Use Case                          | Frequency |
| -------------- | --------------------------------- | --------- |
| `bill_number`  | Receipt reprint, search           | High      |
| `created_at`   | Daily reports, date range filters | Very High |
| `customer_id`  | Customer purchase history         | Medium    |
| `payment_mode` | Payment method reports            | Low       |

---

## Billing Integrity Decisions

### 1. Immutable Totals

**Decision:** Store final totals in `bills` table, never recalculate from `bill_items`.

**Rationale:**

| Reason                | Explanation                                  |
| --------------------- | -------------------------------------------- |
| **Audit compliance**  | Financial records must be tamper-proof       |
| **Legal requirement** | Bills cannot be retroactively modified       |
| **Performance**       | Fast queries (no JOIN + SUM needed)          |
| **Data integrity**    | Historical accuracy guaranteed               |
| **Price changes**     | Product price changes don't affect old bills |

**Example Scenario:**

```
Day 1: Sell product for ₹100 (stored in bill: subtotal = 10000)
Day 2: Product price changes to ₹120
Day 3: Query old bill → Still shows ₹100 (correct!)

If we recalculated from items:
Day 3: Query old bill → Would show ₹120 (WRONG!)
```

**Implication:**

- `bill_items` table stores snapshot of product details at time of sale
- Changing product prices doesn't affect historical bills

---

### 2. No Bill Updates

**Decision:** Bills cannot be updated after creation.

**Rationale:**

- Audit trail requirement
- Legal compliance
- Data integrity

**How to handle mistakes:**

| Scenario            | Solution                          |
| ------------------- | --------------------------------- |
| **Wrong amount**    | Void bill + create new bill       |
| **Wrong items**     | Void bill + create new bill       |
| **Customer return** | Create credit note (reverse bill) |

**Future Enhancement (Void Flag):**

```sql
ALTER TABLE bills ADD COLUMN is_void INTEGER NOT NULL DEFAULT 0 CHECK(is_void IN (0, 1));
CREATE INDEX idx_bills_is_void ON bills(is_void);
```

---

### 3. Customer Reference is Optional

**Decision:** `customer_id` is nullable.

**Rationale:**

- Walk-in customers are common in kirana shops
- Forcing customer creation slows down checkout
- Customer tracking is optional

**Workflow:**

```
1. Scan items
2. Calculate total
3. Ask: "Customer phone number?"
   - If provided → Link to customer (or create new)
   - If not → customer_id = NULL (walk-in)
4. Complete payment
5. Print receipt
```

---

### 4. Single Payment Mode Field

**Decision:** Store single `payment_mode` field (not separate cash/UPI amounts).

**Rationale:**

- Simple for most cases (90% are single payment method)
- 'mixed' mode handles edge cases
- Detailed payment breakdown in separate `payments` table (future)

**Current Limitation:**

- Cannot see exact cash vs UPI split for 'mixed' payments
- Acceptable for MVP (can enhance later)

**Future Enhancement:**

```sql
CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL,
  FOREIGN KEY (bill_id) REFERENCES bills(id)
);

-- Example: ₹1000 bill, ₹600 cash + ₹400 UPI
INSERT INTO payments (bill_id, amount, method) VALUES (1, 60000, 'cash');
INSERT INTO payments (bill_id, amount, method) VALUES (1, 40000, 'upi');
```

---

## Usage Examples

### Create Bill

```typescript
const bill = {
  bill_number: 'BILL-20260208-0001',
  customer_id: null, // Walk-in customer
  subtotal: 100.0,
  gst_total: 18.0,
  discount_amount: 0,
  grand_total: 118.0,
  payment_mode: 'cash',
};

db.execute(
  `
  INSERT INTO bills (bill_number, customer_id, subtotal, gst_total, discount_amount, grand_total, payment_mode)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`,
  [
    bill.bill_number,
    bill.customer_id,
    bill.subtotal,
    bill.gst_total,
    bill.discount_amount,
    bill.grand_total,
    bill.payment_mode,
  ]
);
```

### Daily Sales Report

```typescript
const today = '2026-02-08';

const dailySales = db.queryOne(
  `
  SELECT 
    COUNT(*) as bill_count,
    SUM(grand_total) as total_sales_rupees
  FROM bills
  WHERE DATE(created_at) = ?
`,
  [today]
);

console.log(`Bills: ${dailySales.bill_count}, Total: ₹${dailySales.total_sales_rupees}`);
```

### Customer Purchase History

```typescript
const customerBills = db.queryAll(
  `
  SELECT 
    bill_number,
    grand_total,
    payment_mode,
    created_at
  FROM bills
  WHERE customer_id = ?
  ORDER BY created_at DESC
`,
  [customerId]
);
```

### Payment Mode Breakdown

```typescript
const paymentBreakdown = db.queryAll(
  `
  SELECT 
    payment_mode,
    COUNT(*) as count,
    SUM(grand_total) as total_rupees
  FROM bills
  WHERE DATE(created_at) = ?
  GROUP BY payment_mode
`,
  [today]
);
```

---

## Summary

| Aspect              | Design Choice                 | Rationale                                |
| ------------------- | ----------------------------- | ---------------------------------------- |
| **Totals**          | Stored, immutable             | Audit compliance, performance, integrity |
| **Bill number**     | BILL-YYYYMMDD-NNNN            | Human-readable, sortable, unique         |
| **Customer**        | Optional (nullable)           | Walk-in customers common                 |
| **Payment mode**    | Single field (cash/upi/mixed) | Simple, covers most cases                |
| **Updates**         | Not allowed                   | Audit requirement, use void flag         |
| **Monetary values** | REAL (Rupees)                 | Precision and simplicity                 |

**The bills table is designed for audit compliance, data integrity, and immutability!**
