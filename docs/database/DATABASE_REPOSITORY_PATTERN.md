# Database Access Layer (DAL) - Base Repository

## Overview

The Base Repository provides a type-safe abstraction over `better-sqlite3` with centralized error handling, logging, and common database operations.

---

## Architecture

```
IPC Handler
    ↓
Service Layer (future)
    ↓
Repository (extends BaseRepository)
    ↓
BaseRepository
    ↓
DatabaseManager
    ↓
better-sqlite3
    ↓
SQLite Database
```

---

## Base Repository Class

**File:** `src/main/repositories/base-repository.ts`

### Core Methods

| Method | Purpose | Returns | Throws |
|--------|---------|---------|--------|
| `execute(sql, params)` | INSERT, UPDATE, DELETE | `RunResult` | `DatabaseError` |
| `queryOne<T>(sql, params)` | SELECT single row | `T \| undefined` | `DatabaseError` |
| `queryAll<T>(sql, params)` | SELECT multiple rows | `T[]` | `DatabaseError` |
| `transaction<T>(fn)` | Atomic operations | `T` | `DatabaseError` |
| `exists(sql, params)` | Check if record exists | `boolean` | `DatabaseError` |
| `count(sql, params)` | Count records | `number` | `DatabaseError` |

---

## Usage Example: Product Repository

### 1. Define Entity Types

```typescript
export interface Product {
  id: number;
  name: string;
  barcode: string | null;
  price: number;
  stock: number;
  // ... other fields
}

export interface CreateProductRequest {
  name: string;
  price: number;
  stock?: number;
  // ... other fields
}
```

### 2. Extend BaseRepository

```typescript
import { BaseRepository } from './base-repository';

export class ProductRepository extends BaseRepository {
  // Repository methods here
}
```

### 3. Implement CRUD Operations

**Create:**
```typescript
public create(data: CreateProductRequest): Product {
  const sql = `
    INSERT INTO products (name, price, stock)
    VALUES (?, ?, ?)
  `;
  
  const result = this.execute(sql, [
    data.name,
    data.price,
    data.stock || 0
  ]);
  
  return this.findById(Number(result.lastInsertRowid))!;
}
```

**Read One:**
```typescript
public findById(id: number): Product | undefined {
  const sql = `SELECT * FROM products WHERE id = ?`;
  return this.queryOne<Product>(sql, [id]);
}
```

**Read All:**
```typescript
public findAll(): Product[] {
  const sql = `SELECT * FROM products WHERE is_active = 1`;
  return this.queryAll<Product>(sql);
}
```

**Update:**
```typescript
public update(id: number, data: UpdateProductRequest): Product {
  const sql = `
    UPDATE products
    SET name = ?, price = ?, updated_at = datetime('now')
    WHERE id = ?
  `;
  
  const result = this.execute(sql, [data.name, data.price, id]);
  
  if (result.changes === 0) {
    throw new DatabaseError('Product not found', 'NOT_FOUND');
  }
  
  return this.findById(id)!;
}
```

**Delete (Soft):**
```typescript
public delete(id: number): void {
  const sql = `
    UPDATE products
    SET is_active = 0
    WHERE id = ?
  `;
  
  this.execute(sql, [id]);
}
```

---

## Error Handling

### DatabaseError Class

```typescript
export class DatabaseError extends Error {
  public readonly code: string;
  public readonly originalError?: Error;
  
  constructor(message: string, code: string, originalError?: Error);
  
  public isCode(code: string): boolean;
  public getUserMessage(): string;
}
```

### Error Codes

| Code | Meaning | User Message |
|------|---------|--------------|
| `UNIQUE_VIOLATION` | Duplicate value | "This record already exists" |
| `FOREIGN_KEY_VIOLATION` | Invalid reference | "Referenced data does not exist" |
| `NOT_NULL_VIOLATION` | Missing required field | "Required information is missing" |
| `CHECK_VIOLATION` | Invalid data value | "Invalid data provided" |
| `DATABASE_LOCKED` | Database busy | "Database is busy, please try again" |
| `NOT_FOUND` | Record not found | Custom message |
| `DATABASE_ERROR` | Generic error | "A database error occurred" |

### Error Handling in IPC Handlers

```typescript
import { DatabaseError } from '@main/repositories/base-repository';

IPCHandler.handle('product:create', async (data) => {
  try {
    const product = productRepository.create(data);
    return { success: true, data: product };
  } catch (error) {
    if (error instanceof DatabaseError) {
      logger.error('Product creation failed', { code: error.code, error });
      
      return {
        success: false,
        error: error.getUserMessage()
      };
    }
    
    // Unknown error
    logger.error('Unexpected error', { error });
    return {
      success: false,
      error: 'An unexpected error occurred'
    };
  }
});
```

---

## Transaction Support

### Simple Transaction

```typescript
public createSale(saleData: CreateSaleRequest): Sale {
  return this.transaction(() => {
    // 1. Insert sale
    const saleResult = this.execute(
      'INSERT INTO sales (...) VALUES (...)',
      [...]
    );
    const saleId = saleResult.lastInsertRowid;
    
    // 2. Insert sale items
    for (const item of saleData.items) {
      this.execute(
        'INSERT INTO sale_items (...) VALUES (...)',
        [saleId, ...]
      );
    }
    
    // 3. Update product stock
    for (const item of saleData.items) {
      this.execute(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.productId]
      );
    }
    
    // All succeed or all rollback
    return this.findById(saleId)!;
  });
}
```

**Benefits:**
- ✅ All operations succeed or all rollback
- ✅ No partial data
- ✅ Automatic error handling

---

## Logging

### Automatic Logging

All repository methods automatically log:

**DEBUG Level (Development):**
```
[DEBUG] Executing SQL { sql: 'INSERT INTO ...', params: [...] }
[DEBUG] SQL executed { changes: 1, lastId: 42 }
```

**ERROR Level (Always):**
```
[ERROR] SQL execution failed { sql: '...', params: [...], error: ... }
```

### Custom Logging

```typescript
public create(data: CreateProductRequest): Product {
  const result = this.execute(...);
  
  // Custom log
  logger.info('Product created', {
    id: result.lastInsertRowid,
    name: data.name
  });
  
  return this.findById(result.lastInsertRowid)!;
}
```

---

## Type Safety

### Generic Type Parameters

```typescript
// Type-safe query result
const product = this.queryOne<Product>(sql, params);
// product is Product | undefined

const products = this.queryAll<Product>(sql, params);
// products is Product[]

const count = this.count(sql, params);
// count is number
```

### Type Inference

```typescript
interface ProductRow {
  id: number;
  name: string;
  price: number;
}

const products = this.queryAll<ProductRow>(`
  SELECT id, name, price FROM products
`);
// TypeScript knows products is ProductRow[]
```

---

## Best Practices

### DO ✅

**1. Use Prepared Statements:**
```typescript
// Good - prevents SQL injection
const sql = 'SELECT * FROM products WHERE id = ?';
this.queryOne<Product>(sql, [id]);
```

**2. Handle Errors Gracefully:**
```typescript
try {
  return productRepository.create(data);
} catch (error) {
  if (error instanceof DatabaseError && error.isCode('UNIQUE_VIOLATION')) {
    // Handle duplicate barcode
  }
  throw error;
}
```

**3. Use Transactions for Multi-Step Operations:**
```typescript
return this.transaction(() => {
  // Multiple related operations
});
```

**4. Return Typed Results:**
```typescript
public findById(id: number): Product | undefined {
  return this.queryOne<Product>(sql, [id]);
}
```

### DON'T ❌

**1. Don't Concatenate SQL:**
```typescript
// Bad - SQL injection risk
const sql = `SELECT * FROM products WHERE name = '${name}'`;

// Good
const sql = 'SELECT * FROM products WHERE name = ?';
this.queryOne<Product>(sql, [name]);
```

**2. Don't Ignore Errors:**
```typescript
// Bad
try {
  this.execute(sql, params);
} catch (error) {
  // Silent failure
}

// Good
try {
  this.execute(sql, params);
} catch (error) {
  logger.error('Operation failed', { error });
  throw error;
}
```

**3. Don't Expose Raw Database Objects:**
```typescript
// Bad
public getDb(): Database {
  return this.db;
}

// Good - expose specific methods
public findById(id: number): Product | undefined {
  return this.queryOne<Product>(...);
}
```

---

## Testing Strategy

### Unit Tests (Future)

```typescript
describe('ProductRepository', () => {
  beforeEach(() => {
    // Setup test database
  });
  
  it('should create product', () => {
    const product = productRepository.create({
      name: 'Test Product',
      price: 100
    });
    
    expect(product.id).toBeDefined();
    expect(product.name).toBe('Test Product');
  });
  
  it('should throw on duplicate barcode', () => {
    productRepository.create({ name: 'A', barcode: '123' });
    
    expect(() => {
      productRepository.create({ name: 'B', barcode: '123' });
    }).toThrow(DatabaseError);
  });
});
```

---

## Summary

| Feature | Status | Benefit |
|---------|--------|---------|
| Type-safe queries | ✅ | Compile-time error checking |
| Centralized errors | ✅ | Consistent error handling |
| Automatic logging | ✅ | Easy debugging |
| Transaction support | ✅ | Data integrity |
| Prepared statements | ✅ | SQL injection prevention |
| Generic methods | ✅ | Code reuse |

---

**The base repository is production-ready and provides a solid foundation for all database access!**
