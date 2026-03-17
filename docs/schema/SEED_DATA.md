# Seed Data & Validation

## Overview

This document explains how to use seed data for **schema validation** and **testing** during development.

---

## Seed Data Files

### Location

```
src/main/database/seed/
├── quickstart.sql            # Robust 19-table "balanced" dataset (Recommended)
├── general.sql               # Robust 19-table general dataset (High volume)
├── medicine.sql              # Robust 19-table medical specialized dataset
└── audit_suite.sql           # Enterprise-grade database integrity & audit tool
```

---

### Quickstart Data Contents

**Products (15 items):**
- Mixed categories: Beverages, Dairy, Groceries, Snacks, Household.
- Standardized Rupee pricing.

**Procurement & Sales:**
- **Entities**: 5 Customers, 3 Suppliers.
- **Transactions**: 5 Bills, 2 Purchases, 1 Purchase Order.
- **Returns**: 1 Credit Note, 1 Debit Note.
- **Professional**: 1 Quotation, 3 Expenses.

**Audit & Ledger:**
- **Inventory Logs**: Full sale and receipt history.
- **Ledgers**: Proper initialization of Customer and Supplier ledgers.

---

## Running Seed Data

### Option 1: Manual SQL Execution

```bash
# Using SQLite CLI
sqlite3 smartkhata.db < src/main/database/seed/001_sample_data.sql
```

### Option 2: Using Seed Runner (TypeScript)

```typescript
import { DatabaseManager } from '@/database';
import { SeedRunner } from '@/database/seed-runner';

// Get database instance
const db = DatabaseManager.getInstance();

// Create seed runner
const seeder = new SeedRunner(db);

// Run specific seed
seeder.runSeed('001_sample_data.sql');

// Or run all seeds
seeder.runAllSeeds();
```

### Option 4: Settings UI (Recommended)

Navigate to **Settings > Support (Debug)** and look for the **Database Seeding** section.
- **Select Seed File**: Choose from automatically discovered `.sql` files.
- **Clear First**: Highly recommended to ensure relational integrity.
- **Atomic Run**: The entire process is wrapped in a single database transaction.

> [!WARNING]
> **No Nested Transactions**: Seed scripts MUST NOT contain `BEGIN`, `COMMIT`, or `ROLLBACK` commands. These are handled centrally by the `SeedRunner` to ensure raw SQL can be combined with centralized cleanup safely.

---

## Validation Queries

### Running Validation

```bash
# Execute validation queries
sqlite3 smartkhata.db < src/main/database/seed/validation_queries.sql
```

### Key Validations

**1. Product Count**

```sql
SELECT COUNT(*) as product_count FROM products;
-- Expected: 12
```

**2. Bill Total Validation**

```sql
SELECT
  bill_number,
  CASE
    WHEN subtotal + gst_total - discount_amount = grand_total
    THEN 'VALID'
    ELSE 'INVALID'
  END as validation
FROM bills;
-- Expected: All 'VALID'
```

**3. Foreign Key Relationships**

```sql
SELECT
  b.bill_number,
  COALESCE(c.name, 'Walk-in') as customer_name
FROM bills b
LEFT JOIN customers c ON b.customer_id = c.id;
-- Expected: 3 bills, first one shows 'Walk-in'
```

**4. Inventory Log Verification**

```sql
SELECT
  b.bill_number,
  bi.quantity as sold_qty,
  il.change_qty as logged_qty,
  CASE
    WHEN -bi.quantity = il.change_qty THEN 'MATCH'
    ELSE 'MISMATCH'
  END as validation
FROM bill_items bi
JOIN bills b ON bi.bill_id = b.id
JOIN inventory_logs il ON il.reference_id = b.id AND il.product_id = bi.product_id
WHERE il.reason = 'SALE';
-- Expected: All 'MATCH'
```

**5. Stock Calculation**

```sql
SELECT
  p.name,
  p.stock_qty as current_stock,
  COALESCE(SUM(il.change_qty), 0) as calculated_stock
FROM products p
LEFT JOIN inventory_logs il ON il.product_id = p.id
GROUP BY p.id
HAVING p.stock_qty != COALESCE(SUM(il.change_qty), 0);
-- Expected: Empty result (all stocks match)
```

---

## Expected Results

### Summary

| Aspect         | Expected Count | Notes                              |
| -------------- | -------------- | ---------------------------------- |
| Products       | 12             | All active                         |
| Customers      | 5              | 1 with debt, 1 with advance        |
| Bills          | 3              | All with valid totals              |
| Bill Items     | 8              | 2 + 2 + 4 items                    |
| Inventory Logs | 12             | 8 sales + 2 manual + 2 adjustments |
| App Config     | 1              | Centralized Singleton (Updated)    |
| License        | 1              | Valid for 30 days                  |

---

## Testing Constraints

### Test UNIQUE Constraints

```sql
-- Should FAIL (duplicate SKU)
INSERT INTO products (name, sku, sale_price, stock_qty)
VALUES ('Test', 'BEV-001', 10.0, 10);
-- Error: UNIQUE constraint failed: products.sku
```

### Test CHECK Constraints

```sql
-- Should FAIL (negative price)
INSERT INTO products (name, sale_price, stock_qty)
VALUES ('Test', -10.0, 10);
-- Error: CHECK constraint failed: sale_price >= 0
```

### Test FOREIGN KEY Constraints

```sql
-- Should FAIL (product has been sold)
DELETE FROM products WHERE id = 1;
-- Error: FOREIGN KEY constraint failed
```

### Test Single Row License

```sql
-- Should FAIL (id must be 1)
INSERT INTO license (id, license_key, expires_at, machine_fingerprint)
VALUES (2, 'TEST', '2027-01-01', 'TEST');
-- Error: CHECK constraint failed: id = 1
```

---

## Clearing Seed Data

```typescript
const seeder = new SeedRunner(db);
seeder.clearAllData();
```

**Warning:** This deletes ALL data. Use only in development.

---

## Integration with Tests

```typescript
// In test setup
beforeEach(() => {
  const seeder = new SeedRunner(db);
  seeder.clearAllData();
  seeder.runSeed('001_sample_data.sql');
});

// In tests
describe('Bill Creation', () => {
  it('should create bill with correct totals', () => {
    const bill = db.queryOne(`
      SELECT * FROM bills WHERE bill_number = 'BILL-20260208-0001'
    `);

    expect(bill.grand_total).toBe(118.0);
  });
});
```

---

## Summary

**Seed data provides:**

- ✅ Schema validation
- ✅ Foreign key testing
- ✅ Constraint verification
- ✅ Real-world data scenarios
- ✅ Integration test fixtures

**Use seed data for:**

- Development (manual testing)
- Automated tests (fixtures)
- Schema validation (after migrations)
- Demo/presentation (sample data)

**Do NOT use in production!**
