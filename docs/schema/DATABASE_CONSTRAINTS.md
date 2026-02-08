# Database Constraints & Integrity

## Overview

This document defines **data integrity enforcement** through a combination of database-level constraints and application-level logic.

---

## PRAGMA Settings

These settings must be applied **at connection time** (in `DatabaseManager.initialize()`):

```sql
-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- WAL mode for better concurrency
PRAGMA journal_mode = WAL;

-- Full synchronous mode for data safety
PRAGMA synchronous = FULL;

-- Busy timeout (5 seconds)
PRAGMA busy_timeout = 5000;
```

**Already Implemented:** These are configured in `src/main/database/index.ts`.

---

## Foreign Key Constraints

### Summary Table

| Child Table | Parent Table | Column | On Delete | Rationale |
|-------------|--------------|--------|-----------|-----------|
| `bills` | `customers` | `customer_id` | SET NULL | Bill remains valid if customer deleted |
| `bill_items` | `bills` | `bill_id` | CASCADE | Bill + items are atomic |
| `bill_items` | `products` | `product_id` | RESTRICT | Cannot delete sold products |
| `inventory_logs` | `products` | `product_id` | RESTRICT | Cannot delete products with history |

---

### 1. Bills → Customers

```sql
FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
```

**Behavior:**
- If customer deleted → `customer_id` becomes NULL
- Bill remains valid (walk-in customer)

**Rationale:**
- Customer deletion shouldn't invalidate historical bills
- NULL customer_id = walk-in customer (acceptable)

---

### 2. Bill Items → Bills

```sql
FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
```

**Behavior:**
- If bill deleted → all bill_items deleted

**Rationale:**
- Bill and its items are **atomic** (inseparable)
- No orphaned bill items

**Use Case:**
- Voiding a bill
- Testing/development cleanup

---

### 3. Bill Items → Products

```sql
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
```

**Behavior:**
- Cannot delete product if it has been sold

**Rationale:**
- Audit requirement (historical data must remain valid)
- Forces soft delete (`is_active = 0`)

**Example:**
```sql
-- This FAILS if product has been sold:
DELETE FROM products WHERE id = 101;
-- Error: FOREIGN KEY constraint failed

-- Correct approach:
UPDATE products SET is_active = 0 WHERE id = 101;
```

---

### 4. Inventory Logs → Products

```sql
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
```

**Behavior:**
- Cannot delete product if it has inventory history

**Rationale:**
- Same as bill_items (audit requirement)

---

## CHECK Constraints

### Products Table

```sql
CHECK(sale_price >= 0)
CHECK(purchase_price >= 0)
CHECK(gst_percent >= 0 AND gst_percent <= 10000)
CHECK(stock_qty >= 0)
CHECK(low_stock_alert >= 0)
CHECK(is_active IN (0, 1))
```

**Enforces:**
- No negative prices
- GST rate between 0% and 100%
- No negative stock (at database level)
- Boolean flags are 0 or 1

---

### Customers Table

```sql
CHECK(is_active IN (0, 1))
```

---

### Bills Table

```sql
CHECK(subtotal >= 0)
CHECK(gst_total >= 0)
CHECK(discount_amount >= 0)
CHECK(grand_total >= 0)
CHECK(payment_mode IN ('cash', 'upi', 'mixed'))
```

**Enforces:**
- No negative monetary values
- Payment mode is valid

---

### Bill Items Table

```sql
CHECK(quantity > 0)
CHECK(unit_price >= 0)
CHECK(gst_percent >= 0 AND gst_percent <= 10000)
CHECK(line_total >= 0)
```

**Enforces:**
- Quantity must be positive (cannot sell 0 or negative items)
- No negative prices

---

### Inventory Logs Table

```sql
CHECK(reason IN ('SALE', 'MANUAL', 'ADJUSTMENT'))
```

**Enforces:**
- Reason must be one of the allowed values

---

### License Table

```sql
CHECK(id = 1)
```

**Enforces:**
- Single row table (only id = 1 allowed)

---

## UNIQUE Constraints

| Table | Column | Constraint |
|-------|--------|------------|
| `products` | `sku` | UNIQUE |
| `products` | `barcode` | UNIQUE |
| `customers` | `phone` | UNIQUE |
| `bills` | `bill_number` | UNIQUE |
| `settings` | `key` | PRIMARY KEY (implicit UNIQUE) |
| `license` | `license_key` | UNIQUE |

**Behavior:**
- Prevents duplicate values
- NULL values allowed (multiple NULLs don't violate UNIQUE)

---

## NOT NULL Constraints

**Applied to:**
- All primary keys (`id`)
- Required business fields (`name`, `sale_price`, etc.)
- Audit timestamps (`created_at`, `updated_at`)

**Example:**
```sql
name TEXT NOT NULL
sale_price INTEGER NOT NULL
created_at TEXT NOT NULL
```

---

## Application-Level Constraints

> [!IMPORTANT]
> **Database vs Application Constraints**
> 
> SQLite has limitations. Some constraints **cannot** be enforced at database level and must be handled in application logic.

### 1. Prevent Negative Stock

**Problem:**
- Database CHECK constraint: `stock_qty >= 0`
- But this only prevents negative values **after** update
- Doesn't prevent overselling

**Example:**
```sql
-- Current stock: 5 units
-- User tries to sell 10 units

UPDATE products SET stock_qty = stock_qty - 10 WHERE id = 101;
-- Result: stock_qty = -5
-- CHECK constraint FAILS, transaction ROLLBACK
```

**Solution: Application-Level Check**
```typescript
db.transaction(() => {
  // 1. Check stock availability FIRST
  const product = db.queryOne(`
    SELECT stock_qty FROM products WHERE id = ? FOR UPDATE
  `, [productId]);
  
  if (product.stock_qty < quantity) {
    throw new Error('Insufficient stock');
  }
  
  // 2. Deduct stock
  db.execute(`
    UPDATE products 
    SET stock_qty = stock_qty - ?, updated_at = datetime('now')
    WHERE id = ?
  `, [quantity, productId]);
  
  // 3. Log inventory change
  db.execute(`
    INSERT INTO inventory_logs (product_id, change_qty, reason, reference_id)
    VALUES (?, ?, 'SALE', ?)
  `, [productId, -quantity, billId]);
});
```

**Key Points:**
- ✅ Check before update
- ✅ Use `FOR UPDATE` to lock row (prevent race conditions)
- ✅ Atomic transaction (all or nothing)

---

### 2. Bill Total Validation

**Problem:**
- Cannot enforce: `grand_total = subtotal + gst_total - discount_amount`
- SQLite doesn't support computed column constraints

**Solution: Application-Level Validation**
```typescript
function createBill(billData: BillData): void {
  // Validate calculation
  const expectedTotal = billData.subtotal + billData.gst_total - billData.discount_amount;
  
  if (billData.grand_total !== expectedTotal) {
    throw new Error('Bill total calculation mismatch');
  }
  
  // Insert bill
  db.execute(`
    INSERT INTO bills (bill_number, subtotal, gst_total, discount_amount, grand_total, payment_mode)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [billData.bill_number, billData.subtotal, billData.gst_total, billData.discount_amount, billData.grand_total, billData.payment_mode]);
}
```

---

### 3. License Validation

**Problem:**
- Cannot validate encrypted license key at database level
- Cannot check expiry date against current time

**Solution: Application-Level Validation**
```typescript
function validateLicense(): boolean {
  const license = db.queryOne(`SELECT * FROM license WHERE id = 1`);
  
  if (!license) return false;
  
  // Check expiry
  if (new Date(license.expires_at) < new Date()) {
    return false;
  }
  
  // Verify machine fingerprint
  const currentFingerprint = generateMachineFingerprint();
  if (license.machine_fingerprint !== currentFingerprint) {
    return false;
  }
  
  // Validate license key signature
  if (!validateLicenseKey(license.license_key, currentFingerprint)) {
    return false;
  }
  
  return true;
}
```

---

### 4. Business Rules

**Examples:**
- Maximum discount percentage
- Minimum order amount
- Customer credit limit
- Low stock alerts

**Implementation:**
```typescript
// Maximum discount
const MAX_DISCOUNT_PERCENT = parseInt(getSetting('max_discount_percent')); // 2000 = 20%

if (discountPercent > MAX_DISCOUNT_PERCENT) {
  throw new Error(`Discount cannot exceed ${MAX_DISCOUNT_PERCENT / 100}%`);
}

// Customer credit limit
const customer = db.queryOne(`SELECT balance_due FROM customers WHERE id = ?`, [customerId]);
const creditLimit = 100000; // ₹1000.00

if (customer.balance_due + saleTotal > creditLimit) {
  throw new Error('Customer credit limit exceeded');
}
```

---

## Integrity Boundaries

### Database-Level Enforcement

**What SQLite CAN enforce:**
- ✅ Foreign key relationships
- ✅ NOT NULL constraints
- ✅ UNIQUE constraints
- ✅ CHECK constraints (simple comparisons)
- ✅ PRIMARY KEY uniqueness

**Limitations:**
- ❌ Cannot check values before update (only after)
- ❌ Cannot enforce computed column constraints
- ❌ Cannot validate against current time
- ❌ Cannot enforce complex business rules

---

### Application-Level Enforcement

**What Application MUST enforce:**
- ✅ Prevent negative stock (check before update)
- ✅ Bill total validation (calculated fields)
- ✅ License expiry checks
- ✅ Business rules (discount limits, credit limits)
- ✅ Complex validations (multi-table checks)

**Best Practices:**
- Use transactions for atomic operations
- Lock rows with `FOR UPDATE` to prevent race conditions
- Validate before insert/update
- Throw errors early (fail fast)

---

## Transaction Example

**Complete Sale Transaction with All Constraints:**

```typescript
function createSale(billData: BillData, items: BillItemData[]): void {
  db.transaction(() => {
    // 1. Validate license (application-level)
    if (!validateLicense()) {
      throw new Error('Invalid or expired license');
    }
    
    // 2. Check stock availability for all items (application-level)
    for (const item of items) {
      const product = db.queryOne(`
        SELECT stock_qty FROM products WHERE id = ? FOR UPDATE
      `, [item.product_id]);
      
      if (product.stock_qty < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.product_id}`);
      }
    }
    
    // 3. Validate bill total (application-level)
    const expectedTotal = billData.subtotal + billData.gst_total - billData.discount_amount;
    if (billData.grand_total !== expectedTotal) {
      throw new Error('Bill total calculation mismatch');
    }
    
    // 4. Create bill (DB-level constraints: CHECK, NOT NULL, UNIQUE)
    const billId = db.execute(`
      INSERT INTO bills (bill_number, customer_id, subtotal, gst_total, discount_amount, grand_total, payment_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [billData.bill_number, billData.customer_id, billData.subtotal, billData.gst_total, billData.discount_amount, billData.grand_total, billData.payment_mode]).lastInsertRowid;
    
    // 5. Insert bill items and update stock
    for (const item of items) {
      // Insert bill item (DB-level constraints: CHECK, FOREIGN KEY)
      db.execute(`
        INSERT INTO bill_items (bill_id, product_id, product_name_snapshot, quantity, unit_price, gst_percent, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [billId, item.product_id, item.product_name_snapshot, item.quantity, item.unit_price, item.gst_percent, item.line_total]);
      
      // Deduct stock (DB-level constraint: CHECK stock_qty >= 0)
      db.execute(`
        UPDATE products 
        SET stock_qty = stock_qty - ?, updated_at = datetime('now')
        WHERE id = ?
      `, [item.quantity, item.product_id]);
      
      // Log inventory change (DB-level constraints: CHECK, FOREIGN KEY)
      db.execute(`
        INSERT INTO inventory_logs (product_id, change_qty, reason, reference_id, notes)
        VALUES (?, ?, 'SALE', ?, ?)
      `, [item.product_id, -item.quantity, billId, `Bill #${billData.bill_number}`]);
    }
    
    // 6. Update customer balance if applicable
    if (billData.customer_id) {
      const paymentReceived = billData.payment_received || 0;
      const balanceChange = billData.grand_total - paymentReceived;
      
      db.execute(`
        UPDATE customers 
        SET balance_due = balance_due + ?, updated_at = datetime('now')
        WHERE id = ?
      `, [balanceChange, billData.customer_id]);
    }
  });
}
```

---

## Summary

| Constraint Type | Enforced By | Examples |
|-----------------|-------------|----------|
| **Foreign Keys** | Database | bills → customers, bill_items → bills |
| **CHECK** | Database | price >= 0, payment_mode IN (...) |
| **UNIQUE** | Database | bill_number, phone, sku |
| **NOT NULL** | Database | name, price, created_at |
| **Prevent Negative Stock** | Application | Check before update |
| **Bill Total Validation** | Application | Calculate and validate |
| **Business Rules** | Application | Discount limits, credit limits |
| **License Validation** | Application | Expiry, fingerprint, signature |

**The combination of database constraints and application logic provides robust data integrity!**
