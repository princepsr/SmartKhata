# Database Schema Design Rules

## Overview

This document defines the **mandatory design rules** for all database schema changes in SmartKhata POS. These rules ensure consistency, data integrity, and future-proofing for a SQLite-based offline-first POS system.

**Last Updated:** 2026-02-22  
**Applies To:** All migrations, tables, and schema modifications

---

## Rule 1: Primary Keys

### Rule

**All tables MUST use INTEGER PRIMARY KEY AUTOINCREMENT.**

```sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- other columns
);
```

### Rationale

| Reason                     | Explanation                                                            |
| -------------------------- | ---------------------------------------------------------------------- |
| **SQLite optimization**    | INTEGER PRIMARY KEY is an alias for ROWID, the fastest index in SQLite |
| **Sequential IDs**         | AUTOINCREMENT ensures IDs are never reused, critical for audit trails  |
| **Foreign key simplicity** | Single-column integer foreign keys are simple and performant           |
| **No UUID overhead**       | UUIDs waste space (16 bytes vs 8 bytes) and slow down indexes          |
| **Offline-first safe**     | No risk of ID conflicts (single database, no distributed sync)         |

### ❌ Don't

```sql
-- Don't use UUIDs
id TEXT PRIMARY KEY DEFAULT (uuid())

-- Don't use composite primary keys
PRIMARY KEY (sale_id, product_id)

-- Don't use non-integer keys
id TEXT PRIMARY KEY
```

### ✅ Do

```sql
-- Always use INTEGER AUTOINCREMENT
id INTEGER PRIMARY KEY AUTOINCREMENT
```

---

## Rule 2: Timestamps

### Rule

**All tables MUST have `created_at` and `updated_at` columns in UTC.**

```sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- other columns
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Rationale

| Reason             | Explanation                                                    |
| ------------------ | -------------------------------------------------------------- |
| **Audit trail**    | Know when every record was created and last modified           |
| **Debugging**      | Troubleshoot data issues by checking timestamps                |
| **Reporting**      | Filter records by date ranges (e.g., "sales this month")       |
| **Sync readiness** | Future cloud sync will need timestamps for conflict resolution |
| **ISO 8601 UTC**   | SQLite's `datetime('now')` returns ISO 8601 in UTC             |

### Column Specifications

```sql
created_at TEXT NOT NULL DEFAULT (datetime('now'))
updated_at TEXT NOT NULL DEFAULT (datetime('now'))
```

**Type:** `TEXT` (not INTEGER or REAL)  
**Format:** ISO 8601 UTC (`2026-02-08 15:02:46`)  
**Default:** Current UTC time via `datetime('now')`  
**NOT NULL:** Always required

### Update Trigger (Optional)

For tables with frequent updates, consider a trigger:

```sql
CREATE TRIGGER update_products_timestamp
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
  UPDATE products SET updated_at = datetime('now') WHERE id = NEW.id;
END;
```

**Note:** Triggers add overhead. Only use for critical tables where manual updates might forget `updated_at`.

### ❌ Don't

```sql
-- Don't use local time (causes double-shifts and confusion)
created_at TEXT DEFAULT (datetime('now', 'localtime'))

-- Don't use UNIX timestamps (not human-readable)
created_at INTEGER DEFAULT (strftime('%s', 'now'))
```

### ✅ Do

```sql
-- Always use TEXT with datetime('now') for UTC storage
created_at TEXT NOT NULL DEFAULT (datetime('now'))
updated_at TEXT NOT NULL DEFAULT (datetime('now'))
```

---

## Rule 3: Soft Deletes (Deactivation)

### Rule

**Use `is_active` for deactivation on master data. Use `is_void` for transactional data.**

```sql
-- Master data (products, customers)
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Transactional data (sales)
CREATE TABLE sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  total REAL NOT NULL,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK(is_void IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Rationale

| Reason                    | Explanation                                                   |
| ------------------------- | ------------------------------------------------------------- |
| **Audit compliance**      | Never physically delete financial records (legal requirement) |
| **Historical accuracy**   | Voided sales still appear in reports with proper filtering    |
| **Referential integrity** | Foreign keys remain valid even after "deletion"               |
| **Undo capability**       | Can reactivate products or unvoid sales if needed             |
| **Performance**           | No need to cascade deletes through foreign keys               |

### Naming Convention

| Data Type              | Column Name | Meaning                                |
| ---------------------- | ----------- | -------------------------------------- |
| **Master data**        | `is_active` | 1 = active, 0 = inactive (deactivated) |
| **Transactional data** | `is_void`   | 1 = voided/cancelled, 0 = valid        |

**Why different names?**

- `is_active` implies the record can be reactivated
- `is_void` implies the transaction is permanently cancelled (but kept for audit)

### Column Specification

```sql
is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1))
is_void INTEGER NOT NULL DEFAULT 0 CHECK(is_void IN (0, 1))
```

**Type:** `INTEGER` (not BOOLEAN, SQLite doesn't have native boolean)  
**Values:** `1` = true, `0` = false  
**Default:** `1` for `is_active`, `0` for `is_void`  
**Constraint:** `CHECK(is_active IN (0, 1))` prevents invalid values

### Querying

```sql
-- Get active products
SELECT * FROM products WHERE is_active = 1;

-- Get valid (non-voided) sales
SELECT * FROM sales WHERE is_void = 0;

-- Get voided sales (for audit)
SELECT * FROM sales WHERE is_void = 1;
```

### Indexes

Always index soft delete columns:

```sql
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_sales_is_void ON sales(is_void);
```

### ❌ Don't

```sql
-- Don't use TEXT
is_active TEXT DEFAULT 'true'

-- Don't use NULL
is_active INTEGER

-- Don't use different values
is_active INTEGER DEFAULT 1 -- But allows 2, 3, etc.
```

### ✅ Do

```sql
-- Always use INTEGER with CHECK constraint
is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1))
is_void INTEGER NOT NULL DEFAULT 0 CHECK(is_void IN (0, 1))
```

---

## Rule 4: Monetary Values

### Rule

**All monetary values MUST be stored as REAL in Rupees (Decimal).**

```sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  price REAL NOT NULL CHECK(price >= 0), -- Rupees (Decimal)
  cost REAL CHECK(cost >= 0),             -- Rupees (Decimal)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Rationale

| Reason                 | Explanation                                              |
| ---------------------- | -------------------------------------------------------- |
| **No rounding errors** | Floating-point arithmetic is imprecise (0.1 + 0.2 ≠ 0.3) |
| **Exact calculations** | Integer math is exact and fast                           |
| **Exact values**       | REAL/Decimal storage avoids ambiguity                    |
| **GST compliance**     | Tax calculations are performed on decimal values         |
| **Ease of use**        | Direct mapping between UI and Database                   |

### Conversion

| Display (Rupees) | Storage (Rupees) | Calculation |
| ---------------- | ---------------- | ----------- |
| ₹99.50           | 99.5             | Direct      |
| ₹1,234.00        | 1234.0           | Direct      |
| ₹0.50            | 0.5              | Direct      |

### Column Specification

```sql
-- Product prices
price REAL NOT NULL CHECK(price >= 0)
cost REAL CHECK(cost >= 0)

-- Sale amounts
subtotal REAL NOT NULL CHECK(subtotal >= 0)
cgst REAL NOT NULL DEFAULT 0 CHECK(cgst >= 0)
sgst REAL NOT NULL DEFAULT 0 CHECK(sgst >= 0)
discount REAL NOT NULL DEFAULT 0 CHECK(discount >= 0)
total REAL NOT NULL CHECK(total >= 0)
```

**Type:** `REAL` (Decimal storage)  
**Unit:** Rupees  
**Constraint:** `CHECK(price >= 0)` prevents negative values  
**NOT NULL:** Required for critical amounts (price, total)

### Application Code

**Storing:**

```typescript
const priceInRupees = 99.5;
db.execute('INSERT INTO products (price) VALUES (?)', [priceInRupees]);
```

**Retrieving:**

```typescript
const product = db.queryOne('SELECT price FROM products WHERE id = ?', [1]);
const priceSorted = product.price; // 99.50
console.log(`₹${priceSorted.toFixed(2)}`); // ₹99.50
```

### GST Calculation Example

```typescript
// Product: ₹100.00, GST: 18%
const subtotal = 100.0;
const gstRate = 18.0;

// Calculate CGST (9%) and SGST (9%)
const cgst = (subtotal * gstRate) / (2 * 100); // 9.00
const sgst = cgst; // 9.00
const total = subtotal + cgst + sgst; // 118.00
```

### ❌ Don't

```sql
-- Don't use INTEGER for prices (Paise is deprecated)
price INTEGER NOT NULL
```

### ✅ Do

```sql
-- Always use REAL for rupees
price REAL NOT NULL CHECK(price >= 0)

-- Document in comments if needed
price REAL NOT NULL CHECK(price >= 0) -- Stored in Rupees
```

---

## Rule 5: Naming Conventions

### Rule

**Use snake_case for all table and column names. Use descriptive, unambiguous names.**

### Table Names

```sql
-- ✅ Good: Plural, snake_case
CREATE TABLE products (...);
CREATE TABLE sale_items (...);
CREATE TABLE inventory_adjustments (...);

-- ❌ Bad: Singular, PascalCase, abbreviations
CREATE TABLE Product (...);
CREATE TABLE SaleItem (...);
CREATE TABLE inv_adj (...);
```

**Rules:**

- **Plural:** `products`, not `product`
- **snake_case:** `sale_items`, not `SaleItems` or `saleitems`
- **Descriptive:** `inventory_adjustments`, not `inv_adj`

### Column Names

```sql
-- ✅ Good: snake_case, descriptive
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_name TEXT NOT NULL,
  unit_price REAL NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ❌ Bad: camelCase, abbreviations, unclear
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prodName TEXT NOT NULL,
  unitPrc INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
```

**Rules:**

- **snake_case:** `product_name`, not `productName` or `ProductName`
- **Descriptive:** `unit_price`, not `price` or `prc`
- **Unambiguous:** `is_active`, not `active` (boolean flag)
- **Consistent suffixes:** `_at` for timestamps, `_id` for foreign keys

### Foreign Keys

```sql
-- ✅ Good: Singular table name + _id
customer_id INTEGER
product_id INTEGER
sale_id INTEGER

-- ❌ Bad: Plural, no suffix, ambiguous
customers_id INTEGER
product INTEGER
sale_fk INTEGER
```

**Pattern:** `{singular_table_name}_id`

### Boolean Flags

```sql
-- ✅ Good: is_ prefix
is_active INTEGER
is_void INTEGER
is_taxable INTEGER

-- ❌ Bad: No prefix, ambiguous
active INTEGER
void INTEGER
taxable INTEGER
```

**Pattern:** `is_{adjective}`

### Monetary Columns

```sql
-- ✅ Good: Clear unit (paise implied by INTEGER)
price INTEGER
subtotal INTEGER
cgst INTEGER

-- ❌ Bad: Ambiguous unit
price_paise INTEGER  -- Redundant if all monetary values are paise
amount REAL          -- Unclear: rupees or paise?
```

**Note:** Since ALL monetary values are REAL (Rupees), no need for `_rupees` suffix.

### Rationale

| Reason              | Explanation                                        |
| ------------------- | -------------------------------------------------- |
| **Consistency**     | Same naming style across entire schema             |
| **Readability**     | snake_case is easier to read than camelCase in SQL |
| **SQL convention**  | Most SQL databases use snake_case                  |
| **Avoid conflicts** | Lowercase avoids case-sensitivity issues           |
| **Future-proof**    | Descriptive names reduce need for comments         |

---

## Rule 6: Constraints

### Rule

**Use CHECK constraints to enforce data integrity at the database level.**

```sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  price REAL NOT NULL CHECK(price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  gst_rate REAL NOT NULL DEFAULT 0 CHECK(gst_rate >= 0 AND gst_rate <= 100)
);
```

### Common Constraints

| Constraint       | Example                                        | Purpose                 |
| ---------------- | ---------------------------------------------- | ----------------------- |
| **Non-negative** | `CHECK(price >= 0)`                            | Prevent negative prices |
| **Boolean**      | `CHECK(is_active IN (0, 1))`                   | Enforce 0 or 1 only     |
| **Range**        | `CHECK(gst_rate >= 0 AND gst_rate <= 100)`     | GST rate 0-100%         |
| **Enum**         | `CHECK(status IN ('pending', 'paid', 'void'))` | Limit to valid values   |
| **Positive**     | `CHECK(quantity > 0)`                          | Quantity must be > 0    |

### Rationale

| Reason               | Explanation                                       |
| -------------------- | ------------------------------------------------- |
| **Data integrity**   | Invalid data cannot be inserted                   |
| **Fail fast**        | Errors caught at insert time, not later           |
| **Self-documenting** | Constraints show valid values                     |
| **Defense in depth** | Even if application has bugs, DB rejects bad data |

### ❌ Don't

```sql
-- Don't rely only on application validation
price INTEGER NOT NULL -- No constraint, allows negative values
```

### ✅ Do

```sql
-- Always add CHECK constraints
price INTEGER NOT NULL CHECK(price >= 0)
```

---

## Rule 7: Indexes

### Rule

**Create indexes on all foreign keys and frequently queried columns.**

```sql
-- Foreign keys
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product_id ON sale_items(product_id);

-- Frequently queried columns
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_customers_phone ON customers(phone);

-- Soft delete flags
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_sales_is_void ON sales(is_void);
```

### Naming Convention

**Pattern:** `idx_{table}_{column1}_{column2}`

```sql
-- Single column
CREATE INDEX idx_products_barcode ON products(barcode);

-- Multiple columns (composite)
CREATE INDEX idx_sales_customer_date ON sales(customer_id, created_at);
```

### When to Index

| Column Type             | Index? | Reason                     |
| ----------------------- | ------ | -------------------------- |
| **Primary key**         | ❌ No  | Automatically indexed      |
| **Foreign key**         | ✅ Yes | Speeds up joins            |
| **Unique constraint**   | ❌ No  | Automatically indexed      |
| **Frequently filtered** | ✅ Yes | WHERE clauses              |
| **Frequently sorted**   | ✅ Yes | ORDER BY clauses           |
| **Soft delete flags**   | ✅ Yes | Almost always filtered     |
| **Rarely queried**      | ❌ No  | Wastes space, slows writes |

### Rationale

| Reason                      | Explanation                                  |
| --------------------------- | -------------------------------------------- |
| **Query performance**       | Indexes make lookups fast (O(log n) vs O(n)) |
| **Foreign key performance** | Joins are slow without indexes               |
| **POS responsiveness**      | Fast product search, customer lookup         |

### ❌ Don't

```sql
-- Don't over-index (slows down writes)
CREATE INDEX idx_products_description ON products(description);

-- Don't index low-cardinality columns (except soft deletes)
CREATE INDEX idx_products_unit ON products(unit); -- Only a few values
```

### ✅ Do

```sql
-- Index foreign keys
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);

-- Index frequently queried columns
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_sales_created_at ON sales(created_at);
```

---

## Summary Table

| Rule                | Specification                                   | Rationale                                |
| ------------------- | ----------------------------------------------- | ---------------------------------------- |
| **Primary Keys**    | `INTEGER PRIMARY KEY AUTOINCREMENT`             | SQLite optimization, sequential IDs      |
| **Timestamps**      | `created_at`, `updated_at` (TEXT, ISO 8601)     | Audit trail, debugging, reporting        |
| **Soft Deletes**    | `is_active` (master), `is_void` (transactional) | Audit compliance, historical accuracy    |
| **Monetary Values** | `REAL` (Rupees, not paise)                      | Simple calculations, direct UI mapping   |
| **Naming**          | snake_case, descriptive, unambiguous            | Consistency, readability, SQL convention |
| **Constraints**     | `CHECK` for validation                          | Data integrity, fail fast                |
| **Indexes**         | Foreign keys, frequent queries, soft deletes    | Query performance, POS responsiveness    |

---

## Enforcement

**These rules are MANDATORY for all schema changes.**

**Migration Checklist:**

- [ ] All tables have `INTEGER PRIMARY KEY AUTOINCREMENT`
- [ ] All tables have `created_at` and `updated_at`
- [ ] Master data has `is_active`, transactional data has `is_void`
- [ ] All monetary values are `REAL` (Rupees)
- [ ] All names use snake_case
- [ ] All constraints use `CHECK` where applicable
- [ ] All foreign keys and frequent queries have indexes

**Code Review:**

- Reject PRs that violate these rules
- Update this document if rules change (with rationale)

---

**Last Updated:** 2026-02-08  
**Status:** ✅ Approved and Enforced
