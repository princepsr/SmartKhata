# ProductRepository - Stock Update Safety

## Overview

The `ProductRepository.updateStock()` method implements **negative stock prevention** to ensure data integrity during sales and inventory operations.

---

## Stock Update Method

```typescript
public updateStock(productId: number, deltaQty: number): void {
  // 1. Lock row and check current stock
  const sql = `
    SELECT stock_qty FROM products
    WHERE id = ?
    FOR UPDATE
  `;
  const product = this.queryOne<{ stock_qty: number }>(sql, [productId]);

  if (!product) {
    throw new DatabaseError('Product not found', 'NOT_FOUND');
  }

  // 2. Prevent negative stock
  const newStock = product.stock_qty + deltaQty;
  if (newStock < 0) {
    throw new Error(`Insufficient stock. Available: ${product.stock_qty}, Required: ${Math.abs(deltaQty)}`);
  }

  // 3. Update stock
  const updateSql = `
    UPDATE products
    SET stock_qty = stock_qty + ?, updated_at = datetime('now')
    WHERE id = ?
  `;
  this.execute(updateSql, [deltaQty, productId]);

  Logger.info('Product stock updated', { productId, deltaQty, newStock });
}
```

---

## Safety Mechanisms

### 1. Row Locking (FOR UPDATE)

**Purpose:** Prevent race conditions in concurrent transactions

**How it works:**

```sql
SELECT stock_qty FROM products WHERE id = ? FOR UPDATE
```

- Locks the row until transaction completes
- Other transactions wait for lock to be released
- Prevents two sales from deducting stock simultaneously

**Example Race Condition (WITHOUT FOR UPDATE):**

```
Time  Transaction A              Transaction B
----  -------------------------  -------------------------
T1    Read stock: 5 units
T2                               Read stock: 5 units
T3    Deduct 3 units (stock=2)
T4                               Deduct 3 units (stock=2) ❌ WRONG!
```

**With FOR UPDATE:**

```
Time  Transaction A              Transaction B
----  -------------------------  -------------------------
T1    Lock + Read stock: 5
T2                               Wait for lock...
T3    Deduct 3 units (stock=2)
T4    Commit + Release lock
T5                               Lock + Read stock: 2
T6                               Deduct 3 units → ERROR ✓ CORRECT!
```

---

### 2. Pre-Update Validation

**Check BEFORE updating:**

```typescript
const newStock = product.stock_qty + deltaQty;
if (newStock < 0) {
  throw new Error(
    `Insufficient stock. Available: ${product.stock_qty}, Required: ${Math.abs(deltaQty)}`
  );
}
```

**Why not rely on CHECK constraint?**

- CHECK constraint fails AFTER update attempt
- Pre-validation provides better error messages
- Allows transaction to rollback cleanly

---

### 3. Transaction Requirement

**CRITICAL:** `updateStock()` must be called within a transaction:

```typescript
// ✅ GOOD: Inside transaction
this.transaction(() => {
  // 1. Check stock
  productRepo.updateStock(productId, -quantity);

  // 2. Create bill item
  billItemRepo.create({...});

  // 3. Log inventory
  inventoryLogRepo.create({...});
});

// ❌ BAD: Outside transaction
productRepo.updateStock(productId, -quantity); // Race condition possible!
```

---

## Usage Examples

### Example 1: Sale (Deduct Stock)

```typescript
// Deduct 2 units
productRepo.updateStock(productId, -2);

// If stock is 1, this throws:
// Error: Insufficient stock. Available: 1, Required: 2
```

### Example 2: Purchase (Add Stock)

```typescript
// Add 50 units
productRepo.updateStock(productId, 50);
```

### Example 3: Adjustment (Damage)

```typescript
// Remove 5 damaged units
productRepo.updateStock(productId, -5);
```

### Example 4: Complete Sale Transaction

```typescript
createSale(billData: CreateBillInput, items: CreateBillItemInput[]): Bill {
  return this.transaction(() => {
    // 1. Validate and deduct stock for all items
    items.forEach(item => {
      // This will throw if insufficient stock
      this.productRepo.updateStock(item.productId, -item.quantity);
    });

    // 2. Create bill
    const bill = this.billRepo.create(billData);

    // 3. Create bill items
    items.forEach(item => {
      this.billItemRepo.create({ ...item, billId: bill.id });
    });

    // 4. Log inventory changes
    items.forEach(item => {
      this.inventoryLogRepo.create({
        productId: item.productId,
        changeQty: -item.quantity,
        reason: 'SALE',
        referenceId: bill.id
      });
    });

    return bill;
  });

  // If ANY step fails (including stock check), ALL changes are rolled back
}
```

---

## 5. Billing Configuration Impact

The system's behavior during a sale is governed by the shop's global configuration and individual product settings:

### Stock Update Logic

Stock is only deducted if **both** of these conditions are met:

1.  **Global Billing Mode**: The shop is NOT in `billingOnly` mode.
2.  **Product Setting**: The specific product has `trackInventory` enabled.

```typescript
// BillingTransactionService.ts logic
const shouldUpdateStock = !config.billingOnly && product.trackInventory;

if (shouldUpdateStock) {
  this.productRepo.updateStock(productId, -quantity);
}
```

### Auditability (Inventory Logs)

**Inventory logs are ALWAYS created** regardless of the billing mode. This ensures a permanent audit trail of all transactions, even if physical stock levels are not being tracked. This provides:

- Sales history by product.
- Transaction references for all bill items.
- A baseline for future inventory reconciliation if tracking is enabled later.

---

## 6. Summary

### Insufficient Stock Error

```typescript
try {
  productRepo.updateStock(productId, -10);
} catch (error) {
  if (error.message.includes('Insufficient stock')) {
    // Handle insufficient stock
    alert('Not enough stock available');
  } else {
    // Handle other errors
    alert('Failed to update stock');
  }
}
```

### Product Not Found Error

```typescript
try {
  productRepo.updateStock(999, -1);
} catch (error) {
  if (error instanceof DatabaseError && error.isCode('NOT_FOUND')) {
    alert('Product not found');
  }
}
```

---

## Why This Approach?

| Approach                   | Pros                              | Cons                                    | Decision      |
| -------------------------- | --------------------------------- | --------------------------------------- | ------------- |
| **Check constraint only**  | Simple                            | Poor error messages, fails after update | ❌ Not enough |
| **Application check only** | Good errors                       | Race conditions possible                | ❌ Unsafe     |
| **FOR UPDATE + Pre-check** | Safe, good errors, prevents races | Slightly more complex                   | ✅ **CHOSEN** |

---

## Summary

**Stock update safety is achieved through:**

1. ✅ **Row locking (FOR UPDATE)** - Prevents race conditions
2. ✅ **Pre-update validation** - Prevents negative stock
3. ✅ **Transaction requirement** - Ensures atomicity
4. ✅ **Descriptive errors** - Clear error messages

**This ensures:**

- No overselling (stock never goes negative)
- No race conditions (concurrent sales handled correctly)
- Atomic operations (all-or-nothing updates)
- Clear error messages (user-friendly feedback)

**The stock update mechanism is production-safe and POS-grade!**
