# Repository Rules

## Overview

Repositories are the **only** layer that interacts with the database. They encapsulate all SQL queries and return domain objects.

---

## Responsibilities

**Repositories MUST:**

- ✅ Encapsulate all SQL queries for their table/aggregate
- ✅ Return domain objects (typed interfaces), not raw DB rows
- ✅ Use `BaseRepository` for common operations
- ✅ Be synchronous (no async/await)
- ✅ Use transactions for multi-step writes
- ✅ Handle database errors and throw meaningful errors
- ✅ Perform standard rounding for financial totals when appropriate
- ✅ Validate input parameters

**Repositories MUST NOT:**

- ❌ Contain business logic (that belongs in services)
- ❌ Call other repositories directly
- ❌ Access the UI or IPC layer
- ❌ Perform HTTP requests or external I/O
- ❌ Use async/await (SQLite is synchronous)
- ❌ Return raw database rows (always map to domain types)
- ❌ Expose SQL queries outside the repository

---

## Naming Conventions

| Pattern             | Example                                             | Notes                            |
| ------------------- | --------------------------------------------------- | -------------------------------- |
| **Class Name**      | `CustomerRepository`                                | Singular, ends with `Repository` |
| **File Name**       | `customer-repository.ts`                            | Kebab-case                       |
| **Method Names**    | `findById`, `findAll`, `create`, `update`, `delete` | Descriptive, verb-first          |
| **Private Methods** | `_mapToCustomer`                                    | Prefix with underscore           |

---

## Folder Structure

```
src/main/repositories/
├── base-repository.ts          # Base class (already exists)
├── product-repository.ts       # Example (already exists)
├── customer-repository.ts      # To implement
├── bill-repository.ts          # To implement
├── bill-item-repository.ts     # To implement
├── inventory-log-repository.ts # To implement
├── settings-repository.ts      # To implement
└── license-repository.ts       # To implement
```

---

## Method Patterns

### Standard CRUD Methods

Every repository should implement:

```typescript
class XxxRepository extends BaseRepository {
  // Read operations
  findById(id: number): Xxx | null;
  findAll(): Xxx[];
  findBy(criteria: Partial<Xxx>): Xxx[];

  // Write operations
  create(data: CreateXxxInput): Xxx;
  update(id: number, data: UpdateXxxInput): Xxx;
  deactivate(id: number): void; // Soft delete

  // Private mapping
  private _mapToXxx(row: any): Xxx;
}
```

---

## Data Mapping

**Always map database rows to domain objects:**

```typescript
// ✅ GOOD: Return domain object
findById(id: number): Customer | null {
  const row = this.queryOne(`SELECT * FROM customers WHERE id = ?`, [id]);
  return row ? this._mapToCustomer(row) : null;
}

private _mapToCustomer(row: any): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    balanceDue: row.balance_due, // Rupees
    isActive: row.is_active === 1,
    createdAt: this.parseDate(row.created_at),
    updatedAt: this.parseDate(row.updated_at)
  };
}

// ❌ BAD: Return raw database row
findById(id: number): any {
  return this.queryOne(`SELECT * FROM customers WHERE id = ?`, [id]);
}
```

---

## Transaction Usage

**Use transactions for multi-step writes:**

```typescript
// ✅ GOOD: Atomic transaction
createBillWithItems(billData: CreateBillInput, items: CreateBillItemInput[]): Bill {
  return this.transaction(() => {
    // 1. Create bill
    const billId = this.execute(`INSERT INTO bills (...) VALUES (...)`, [...]).lastInsertRowid;

    // 2. Create bill items
    items.forEach(item => {
      this.execute(`INSERT INTO bill_items (...) VALUES (...)`, [...]);
    });

    // 3. Return created bill
    return this.findById(billId)!;
  });
}

// ❌ BAD: No transaction (data inconsistency risk)
createBillWithItems(billData: CreateBillInput, items: CreateBillItemInput[]): Bill {
  const billId = this.execute(`INSERT INTO bills (...) VALUES (...)`, [...]).lastInsertRowid;
  items.forEach(item => {
    this.execute(`INSERT INTO bill_items (...) VALUES (...)`, [...]);
  });
  return this.findById(billId)!;
}
```

---

## Error Handling

**Throw meaningful errors:**

```typescript
// ✅ GOOD: Descriptive error
findById(id: number): Customer {
  const customer = this.queryOne(`SELECT * FROM customers WHERE id = ?`, [id]);

  if (!customer) {
    throw new Error(`Customer not found: ${id}`);
  }

  return this._mapToCustomer(customer);
}

// ❌ BAD: Generic error or silent failure
findById(id: number): Customer | null {
  return this.queryOne(`SELECT * FROM customers WHERE id = ?`, [id]);
}
```

---

## IPC Handler Usage

**IPC handlers should:**

- ✅ Call repository methods
- ✅ Handle repository errors
- ✅ Return data to renderer

**IPC handlers should NOT:**

- ❌ Write SQL queries
- ❌ Access database directly
- ❌ Contain business logic

### Example: Good IPC Handler

```typescript
// ✅ GOOD: IPC handler uses repository
ipcMain.handle('customer:getById', async (event, customerId: number) => {
  try {
    const customerRepo = new CustomerRepository(DatabaseManager.getInstance());
    const customer = customerRepo.findById(customerId);

    if (!customer) {
      return { success: false, error: 'Customer not found' };
    }

    return { success: true, data: customer };
  } catch (error) {
    Logger.error('Failed to get customer', error);
    return { success: false, error: 'Failed to get customer' };
  }
});

// ❌ BAD: IPC handler writes SQL
ipcMain.handle('customer:getById', async (event, customerId: number) => {
  const db = DatabaseManager.getInstance();
  const customer = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(customerId);
  return customer;
});
```

---

## Business Logic Separation

**Repositories handle data access, services handle business logic:**

```typescript
// ✅ GOOD: Repository only handles data access
class CustomerRepository {
  findById(id: number): Customer | null {
    /* ... */
  }
  updateBalance(id: number, amount: number): void {
    /* ... */
  }
}

// ✅ GOOD: Service handles business logic
class BillingService {
  createSale(billData: CreateBillInput, items: CreateBillItemInput[]): Bill {
    // Business logic: validate, calculate totals, check stock
    this.validateBillData(billData);
    this.checkStockAvailability(items);

    // Use repositories for data access
    const bill = this.billRepo.create(billData);
    items.forEach((item) => this.billItemRepo.create(item));
    this.customerRepo.updateBalance(billData.customerId, billData.grandTotal);

    return bill;
  }
}

// ❌ BAD: Repository contains business logic
class CustomerRepository {
  createSaleAndUpdateBalance(billData: any, items: any[]): void {
    // Business logic in repository (WRONG!)
    const total = items.reduce((sum, item) => sum + item.price, 0);
    if (total > 10000) throw new Error('Sale too large');
    // ...
  }
}
```

---

## Type Conversion

**Convert database types to domain types:**

```typescript
// Database and domain both use REAL (rupees)

// ✅ GOOD: Simple mapping
private _mapToProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    salePrice: row.sale_price,            // Rupees
    purchasePrice: row.purchase_price,
    gstPercent: row.gst_percent,          // Percent (e.g., 18.0)
    stockQty: row.stock_qty,
    isActive: row.is_active === 1,        // INTEGER → boolean
    createdAt: this.parseDate(row.created_at) // TEXT → Date (Local/IST)
  };
}

// When saving, use direct values
create(data: CreateProductInput): Product {
  const result = this.execute(`
    INSERT INTO products (name, sale_price, purchase_price, gst_percent, stock_qty)
    VALUES (?, ?, ?, ?, ?)
  `, [
    data.name,
    data.salePrice,      // Rupees
    data.purchasePrice,
    data.gstPercent,     // Percent
    data.stockQty,
    this.formatDateForSql(new Date()) // Optional: for manual created_at if needed
  ]);

  return this.findById(result.lastInsertRowid)!;
}
```

---

## Summary

| Rule                         | Reason                       |
| ---------------------------- | ---------------------------- |
| **One repository per table** | Clear separation of concerns |
| **Extend BaseRepository**    | Reuse common functionality   |
| **Return domain objects**    | Type safety, abstraction     |
| **Use transactions**         | Data consistency             |
| **No business logic**        | Single responsibility        |
| **Synchronous only**         | SQLite is synchronous        |
| **Map database types**       | Clean domain model           |

**Follow these rules strictly to maintain a clean, maintainable codebase!**
