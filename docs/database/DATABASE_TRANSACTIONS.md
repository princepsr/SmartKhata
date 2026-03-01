# Transaction Support

## Overview

Transaction support is **already fully implemented** in the SmartKhata database layer using `better-sqlite3`'s built-in transaction API.

---

## How It Works

### better-sqlite3 Transaction API

```typescript
// In DatabaseManager (src/main/database/index.ts)
public transaction<T>(fn: () => T): T {
  const db = this.getDatabase();
  const transaction = db.transaction(fn);
  return transaction();
}
```

**What happens:**

1. `db.transaction(fn)` creates a transaction wrapper
2. Calling `transaction()` executes the function
3. If function succeeds → **COMMIT**
4. If function throws → **ROLLBACK**

### In BaseRepository

```typescript
// In BaseRepository (src/main/repositories/base-repository.ts)
protected transaction<T>(fn: () => T): T {
  try {
    logger.debug('Starting transaction');
    const result = databaseManager.transaction(fn);
    logger.debug('Transaction committed');
    return result;
  } catch (error) {
    logger.error('Transaction failed (rolled back)', { error });
    throw this.handleError(error, 'transaction');
  }
}
```

**Benefits:**

- ✅ Automatic BEGIN/COMMIT/ROLLBACK
- ✅ Type-safe return values
- ✅ Automatic logging
- ✅ Error handling
- ✅ No manual transaction management

---

## Usage Examples

### Example 1: Simple Sale Transaction

```typescript
import { BaseRepository } from './base-repository';

export class SaleRepository extends BaseRepository {
  /**
   * Create a sale with items (atomic operation)
   */
  public createSale(saleData: CreateSaleRequest): Sale {
    return this.transaction(() => {
      // Step 1: Insert sale header
      const saleResult = this.execute(
        `
        INSERT INTO sales (customer_id, subtotal, tax, discount, total, payment_method)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        [
          saleData.customerId || null,
          saleData.subtotal,
          saleData.tax,
          saleData.discount,
          saleData.total,
          saleData.paymentMethod,
        ]
      );

      const saleId = Number(saleResult.lastInsertRowid);

      // Step 2: Insert sale items
      for (const item of saleData.items) {
        this.execute(
          `
          INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
          [saleId, item.productId, item.productName, item.quantity, item.unitPrice, item.subtotal]
        );
      }

      // Step 3: Update product stock
      for (const item of saleData.items) {
        this.execute(
          `
          UPDATE products
          SET stock = stock - ?, updated_at = datetime('now')
          WHERE id = ?
        `,
          [item.quantity, item.productId]
        );
      }

      // All operations succeed or all rollback
      return this.findById(saleId)!;
    });
  }
}
```

**What happens:**

- ✅ If all operations succeed → Sale created, items inserted, stock updated
- ❌ If any operation fails → Everything rolls back, database unchanged

---

### Example 2: Inventory Adjustment

```typescript
export class InventoryRepository extends BaseRepository {
  /**
   * Adjust stock for multiple products (atomic)
   */
  public bulkAdjustStock(adjustments: StockAdjustment[]): void {
    return this.transaction(() => {
      for (const adj of adjustments) {
        // Validate stock won't go negative
        const product = this.queryOne<{ stock: number }>(
          `
          SELECT stock FROM products WHERE id = ?
        `,
          [adj.productId]
        );

        if (!product) {
          throw new Error(`Product ${adj.productId} not found`);
        }

        if (product.stock + adj.quantity < 0) {
          throw new Error(`Insufficient stock for product ${adj.productId}`);
        }

        // Update stock
        this.execute(
          `
          UPDATE products
          SET stock = stock + ?, updated_at = datetime('now')
          WHERE id = ?
        `,
          [adj.quantity, adj.productId]
        );

        // Log adjustment
        this.execute(
          `
          INSERT INTO inventory_adjustments (product_id, quantity_change, reason)
          VALUES (?, ?, ?)
        `,
          [adj.productId, adj.quantity, adj.reason]
        );
      }
    });
  }
}
```

---

### Example 3: Void Sale (Reverse Transaction)

```typescript
export class SaleRepository extends BaseRepository {
  /**
   * Void a sale and restore stock (atomic)
   */
  public voidSale(saleId: number): void {
    return this.transaction(() => {
      // Get sale items
      const items = this.queryAll<SaleItem>(
        `
        SELECT product_id, quantity FROM sale_items WHERE sale_id = ?
      `,
        [saleId]
      );

      // Restore stock for each item
      for (const item of items) {
        this.execute(
          `
          UPDATE products
          SET stock = stock + ?, updated_at = datetime('now')
          WHERE id = ?
        `,
          [item.quantity, item.product_id]
        );
      }

      // Mark sale as void
      this.execute(
        `
        UPDATE sales
        SET is_void = 1, updated_at = datetime('now')
        WHERE id = ?
      `,
        [saleId]
      );
    });
  }
}
```

---

### Example 4: Customer Payment with Credit Update

```typescript
export class PaymentRepository extends BaseRepository {
  /**
   * Record payment and update customer balance (atomic)
   */
  public recordPayment(paymentData: PaymentRequest): Payment {
    return this.transaction(() => {
      // Insert payment record
      const paymentResult = this.execute(
        `
        INSERT INTO payments (sale_id, customer_id, amount, payment_method)
        VALUES (?, ?, ?, ?)
      `,
        [paymentData.saleId, paymentData.customerId, paymentData.amount, paymentData.paymentMethod]
      );

      // Update customer outstanding balance
      this.execute(
        `
        UPDATE customers
        SET outstanding_balance = outstanding_balance - ?,
            updated_at = datetime('now')
        WHERE id = ?
      `,
        [paymentData.amount, paymentData.customerId]
      );

      // Update sale payment status
      const sale = this.queryOne<{ total: number; paid_amount: number }>(
        `
        SELECT total,
               COALESCE((SELECT SUM(amount) FROM payments WHERE sale_id = ?), 0) as paid_amount
        FROM sales
        WHERE id = ?
      `,
        [paymentData.saleId, paymentData.saleId]
      );

      const newStatus = sale!.paid_amount >= sale!.total ? 'paid' : 'partial';

      this.execute(
        `
        UPDATE sales
        SET payment_status = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
        [newStatus, paymentData.saleId]
      );

      return this.findPaymentById(Number(paymentResult.lastInsertRowid))!;
    });
  }
}
```

---

## Nested Transactions

### better-sqlite3 Behavior

**Important:** `better-sqlite3` does **NOT** support true nested transactions.

```typescript
// This will NOT create nested transactions
this.transaction(() => {
  this.execute('INSERT INTO table1 ...');

  this.transaction(() => {
    // This is NOT a nested transaction
    // It's just a function call within the outer transaction
    this.execute('INSERT INTO table2 ...');
  });
});
```

**What actually happens:**

- Only the outermost `transaction()` creates a transaction
- Inner `transaction()` calls are no-ops (just execute the function)
- All operations are part of the same transaction

### Workaround: Savepoints (Manual)

If you need nested transactions, use SQLite savepoints manually:

```typescript
public complexOperation(): void {
  return this.transaction(() => {
    this.execute('INSERT INTO table1 ...');

    // Create savepoint
    this.db.exec('SAVEPOINT sp1');

    try {
      this.execute('INSERT INTO table2 ...');
      this.db.exec('RELEASE sp1');
    } catch (error) {
      this.db.exec('ROLLBACK TO sp1');
      // Continue with outer transaction
    }

    this.execute('INSERT INTO table3 ...');
  });
}
```

**Recommendation:** Avoid nested transactions. Keep transactions simple and flat.

---

## Rules for Using Transactions Correctly

### ✅ DO

**1. Use transactions for multi-step operations:**

```typescript
// Good - atomic sale creation
this.transaction(() => {
  insertSale();
  insertSaleItems();
  updateStock();
});
```

**2. Keep transactions short:**

```typescript
// Good - fast operations only
this.transaction(() => {
  this.execute('INSERT ...');
  this.execute('UPDATE ...');
});
```

**3. Throw errors to trigger rollback:**

```typescript
this.transaction(() => {
  if (stock < 0) {
    throw new Error('Insufficient stock'); // Triggers rollback
  }
  this.execute('UPDATE ...');
});
```

**4. Use for billing operations:**

```typescript
// Mandatory for sales
createSale() { return this.transaction(() => { ... }); }
voidSale() { return this.transaction(() => { ... }); }
recordPayment() { return this.transaction(() => { ... }); }
```

**5. Use for inventory operations:**

```typescript
// Mandatory for stock changes
adjustStock() { return this.transaction(() => { ... }); }
transferStock() { return this.transaction(() => { ... }); }
```

### ❌ DON'T

**1. Don't use transactions for single operations:**

```typescript
// Bad - unnecessary transaction
this.transaction(() => {
  return this.execute('INSERT INTO products ...');
});

// Good - single operation doesn't need transaction
return this.execute('INSERT INTO products ...');
```

**2. Don't perform I/O inside transactions:**

```typescript
// Bad - slow I/O in transaction
this.transaction(() => {
  this.execute('INSERT ...');
  await fetch('https://api.example.com'); // ❌ Async I/O
  this.execute('UPDATE ...');
});

// Good - I/O outside transaction
const apiData = await fetch('https://api.example.com');
this.transaction(() => {
  this.execute('INSERT ...', [apiData]);
});
```

**3. Don't use async/await inside transactions:**

```typescript
// Bad - better-sqlite3 is synchronous
this.transaction(async () => { // ❌ Don't use async
  await this.execute(...); // ❌ Don't use await
});

// Good - synchronous only
this.transaction(() => {
  this.execute(...);
  this.queryOne(...);
});
```

**4. Don't catch errors without re-throwing:**

```typescript
// Bad - swallows error, transaction commits
this.transaction(() => {
  try {
    this.execute('INSERT ...');
  } catch (error) {
    console.log(error); // ❌ Error swallowed
  }
});

// Good - re-throw to trigger rollback
this.transaction(() => {
  try {
    this.execute('INSERT ...');
  } catch (error) {
    logger.error('Failed', { error });
    throw error; // ✅ Re-throw
  }
});
```

**5. Don't nest transactions:**

```typescript
// Bad - confusing, no benefit
this.transaction(() => {
  this.execute('INSERT ...');
  this.transaction(() => {
    // ❌ Unnecessary nesting
    this.execute('UPDATE ...');
  });
});

// Good - flat transaction
this.transaction(() => {
  this.execute('INSERT ...');
  this.execute('UPDATE ...');
});
```

---

## Mandatory Transaction Use Cases

### Billing Operations

**All billing operations MUST use transactions:**

```typescript
✅ createSale()      - Insert sale + items + update stock
✅ voidSale()        - Mark void + restore stock
✅ recordPayment()   - Insert payment + update balance + update sale status
✅ applyDiscount()   - Update sale + recalculate totals
✅ refundSale()      - Create refund + restore stock + update balance
```

### Inventory Operations

**All inventory operations MUST use transactions:**

```typescript
✅ adjustStock()       - Update stock + log adjustment
✅ transferStock()     - Decrease source + increase destination
✅ receiveStock()      - Update stock + create receipt
✅ bulkAdjustStock()   - Multiple stock updates
```

### Why Mandatory?

**Data Integrity:**

- Prevents partial updates (e.g., sale created but stock not updated)
- Ensures consistency (e.g., customer balance matches payments)

**Example of what can go wrong without transactions:**

```typescript
// ❌ BAD - No transaction
public createSale(data: CreateSaleRequest): Sale {
  const saleId = this.insertSale(data);      // ✅ Succeeds
  this.insertSaleItems(saleId, data.items);  // ✅ Succeeds
  this.updateStock(data.items);              // ❌ FAILS (power outage)

  // Result: Sale exists, but stock not updated! 💥
}

// ✅ GOOD - With transaction
public createSale(data: CreateSaleRequest): Sale {
  return this.transaction(() => {
    const saleId = this.insertSale(data);      // ✅ Succeeds
    this.insertSaleItems(saleId, data.items);  // ✅ Succeeds
    this.updateStock(data.items);              // ❌ FAILS

    // Result: Everything rolled back, database unchanged ✅
  });
}
```

---

## Performance Considerations

### Transaction Overhead

**Minimal overhead for better-sqlite3:**

- Transactions are very fast (microseconds)
- WAL mode allows concurrent reads during write transactions
- No network latency (local database)

### When to Batch

```typescript
// Good - batch inserts in one transaction
this.transaction(() => {
  for (const product of products) {
    this.execute('INSERT INTO products ...', [product]);
  }
});

// Better - use prepared statement
this.transaction(() => {
  const stmt = this.db.prepare('INSERT INTO products ...');
  for (const product of products) {
    stmt.run(product);
  }
});
```

---

## Error Handling

### Automatic Rollback

```typescript
try {
  const sale = saleRepository.createSale(data);
  // Transaction committed
} catch (error) {
  // Transaction rolled back automatically
  if (error instanceof DatabaseError) {
    if (error.isCode('CHECK_VIOLATION')) {
      // Handle insufficient stock
    }
  }
}
```

### Custom Error Messages

```typescript
this.transaction(() => {
  const product = this.queryOne<Product>('SELECT * FROM products WHERE id = ?', [id]);

  if (!product) {
    throw new DatabaseError('Product not found', 'NOT_FOUND');
  }

  if (product.stock < quantity) {
    throw new DatabaseError('Insufficient stock', 'INSUFFICIENT_STOCK');
  }

  this.execute('UPDATE products SET stock = stock - ? WHERE id = ?', [quantity, id]);
});
```

---

## Summary

| Feature                | Status | Implementation           |
| ---------------------- | ------ | ------------------------ |
| Automatic BEGIN/COMMIT | ✅     | `better-sqlite3`         |
| Automatic ROLLBACK     | ✅     | On error/exception       |
| Type-safe              | ✅     | Generic `<T>`            |
| Logging                | ✅     | Auto-logged              |
| Error handling         | ✅     | `DatabaseError`          |
| **Testing Support**    | ✅     | `SqlJsDatabase` (sql.js) |
| Nested transactions    | ❌     | Not supported            |
| Savepoints             | ⚠️     | Manual only              |

---

**Transaction support is production-ready and mandatory for all billing and inventory operations!**
