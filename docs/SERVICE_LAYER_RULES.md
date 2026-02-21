# Service Layer Rules

## Overview

Services contain **business logic** and orchestrate multiple repositories. They are the single source of truth for business rules and keep both UI and repositories thin.

---

## Responsibilities

**Services are responsible for:**

- ✅ Business logic and validation
- ✅ Orchestrating multiple repositories
- ✅ Enforcing business rules
- ✅ Complex calculations and transformations
- ✅ Cross-entity operations
- ✅ Throwing typed business errors

---

## What Services MUST Do

1. **Contain all business logic**
   - Validation rules (e.g., discount limits, credit limits)
   - Calculations (e.g., totals, taxes, commissions)
   - Business workflows (e.g., sale process, returns)

2. **Orchestrate multiple repositories**
   - Call multiple repositories in sequence
   - Coordinate cross-entity operations
   - Use transactions for atomic operations

3. **Validate business rules**
   - Check constraints (e.g., stock availability, credit limits)
   - Enforce policies (e.g., maximum discount percentage)
   - Validate state transitions

4. **Throw typed business errors**
   - Use custom error classes
   - Provide meaningful error messages
   - Include error codes for UI handling

5. **Be framework-agnostic**
   - No UI dependencies
   - No IPC dependencies
   - Pure TypeScript/JavaScript

---

## What Services MUST NOT Do

1. **❌ Write SQL queries**
   - SQL belongs in repositories only
   - Services call repository methods

2. **❌ Access the database directly**
   - Always go through repositories
   - Never import database manager

3. **❌ Contain UI logic**
   - No alert(), confirm(), or DOM manipulation
   - No UI state management
   - No rendering logic

4. **❌ Handle IPC communication**
   - Services don't know about IPC
   - IPC handlers call services, not vice versa

5. **❌ Return raw database rows**
   - Always return domain objects
   - Let repositories handle mapping

---

## Service vs Repository

| Aspect       | Service                                 | Repository               |
| ------------ | --------------------------------------- | ------------------------ |
| **Purpose**  | Business logic                          | Data access              |
| **Contains** | Validation, calculations, workflows     | SQL queries              |
| **Calls**    | Multiple repositories                   | Database only            |
| **Returns**  | Domain objects, aggregates              | Domain objects           |
| **Throws**   | Business errors                         | Database errors          |
| **Example**  | `calculateDiscount()`, `validateSale()` | `findById()`, `create()` |

---

## IPC Interaction with Services

**IPC handlers should:**

- ✅ Call service methods
- ✅ Handle service errors
- ✅ Format responses for UI
- ❌ NOT call repositories directly
- ❌ NOT contain business logic

### Good Example: IPC → Service

```typescript
// ✅ GOOD: IPC handler calls service
IPCHandler.handle('sale:create', async (saleData) => {
  try {
    const saleService = new SaleService();
    const result = saleService.createSale(saleData);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: 'Failed to create sale',
    };
  }
});
```

### Bad Example: IPC → Repository

```typescript
// ❌ BAD: IPC handler calls repository directly
IPCHandler.handle('sale:create', async (saleData) => {
  const billRepo = new BillRepository();
  const productRepo = new ProductRepository();

  // Business logic in IPC handler (WRONG!)
  const total = saleData.items.reduce((sum, item) => {
    const product = productRepo.findById(item.productId);
    return sum + product.price * item.quantity;
  }, 0);

  const bill = billRepo.create({ ...saleData, total });
  return { success: true, data: bill };
});
```

---

## Naming Conventions

| Pattern             | Example                                            | Notes                         |
| ------------------- | -------------------------------------------------- | ----------------------------- |
| **Class Name**      | `ProductService`                                   | Singular, ends with `Service` |
| **File Name**       | `product-service.ts`                               | Kebab-case                    |
| **Method Names**    | `createProduct`, `validateStock`, `calculateTotal` | Descriptive, verb-first       |
| **Private Methods** | `_validateDiscount`                                | Prefix with underscore        |

---

## Folder Structure

```
src/main/services/
├── product-service.ts
├── customer-service.ts
├── billing-transaction-service.ts  # Already exists
├── inventory-service.ts
├── reporting-service.ts
├── settings-service.ts
└── license-service.ts
```

---

## Good Example: Service with Business Logic

```typescript
// ✅ GOOD: Service contains business logic
export class ProductService {
  private productRepo: ProductRepository;
  private inventoryRepo: InventoryRepository;

  constructor() {
    this.productRepo = new ProductRepository();
    this.inventoryRepo = new InventoryRepository();
  }

  /**
   * Add stock with business validation
   */
  public addStock(productId: number, quantity: number, notes: string): void {
    // 1. Business validation
    if (quantity <= 0) {
      throw new InvalidQuantityError('Quantity must be positive');
    }

    if (quantity > 10000) {
      throw new InvalidQuantityError('Cannot add more than 10,000 units at once');
    }

    // 2. Check product exists and is active
    const product = this.productRepo.findById(productId);
    if (!product) {
      throw new ProductNotFoundError(`Product ${productId} not found`);
    }

    if (!product.isActive) {
      throw new InactiveEntityError('Cannot add stock to inactive product');
    }

    // 3. Update stock and log (orchestrate repositories)
    this.productRepo.updateStock(productId, quantity);
    this.inventoryRepo.logChange({
      productId,
      changeQty: quantity,
      reason: 'MANUAL',
      notes,
    });

    Logger.info('Stock added', { productId, quantity });
  }

  /**
   * Calculate product margin
   */
  public calculateMargin(productId: number): number {
    const product = this.productRepo.findById(productId);
    if (!product) {
      throw new ProductNotFoundError(`Product ${productId} not found`);
    }

    if (!product.purchasePrice) {
      return 0;
    }

    // Business calculation
    const margin = ((product.salePrice - product.purchasePrice) / product.salePrice) * 100;
    return Math.round(margin * 100) / 100; // Round to 2 decimals
  }
}
```

---

## Bad Example: Repository with Business Logic

```typescript
// ❌ BAD: Business logic in repository
export class ProductRepository extends BaseRepository {
  public addStock(productId: number, quantity: number): void {
    // Business validation in repository (WRONG!)
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    if (quantity > 10000) {
      throw new Error('Too much stock');
    }

    // SQL query (OK in repository)
    this.execute(`UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?`, [
      quantity,
      productId,
    ]);

    // Calling another repository (WRONG! Should be in service)
    const inventoryRepo = new InventoryRepository();
    inventoryRepo.logChange({ productId, changeQty: quantity, reason: 'MANUAL' });
  }
}
```

---

## Typed Business Errors

**Services should throw custom error classes:**

```typescript
// Define custom errors
export class ProductNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductNotFoundError';
  }
}

export class InsufficientStockError extends Error {
  public readonly productId: number;
  public readonly available: number;
  public readonly required: number;

  constructor(productId: number, available: number, required: number) {
    super(`Insufficient stock. Available: ${available}, Required: ${required}`);
    this.name = 'InsufficientStockError';
    this.productId = productId;
    this.available = available;
    this.required = required;
  }
}

export class InvalidQuantityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidQuantityError';
  }
}

// Use in service
public deductStock(productId: number, quantity: number): void {
  const product = this.productRepo.findById(productId);

  if (!product) {
    throw new ProductNotFoundError(`Product ${productId} not found`);
  }

  if (product.stockQty < quantity) {
    throw new InsufficientStockError(productId, product.stockQty, quantity);
  }

  this.productRepo.updateStock(productId, -quantity);
}
```

---

## Method Patterns

### Standard Service Methods

```typescript
class XxxService {
  // Business operations
  public createXxx(data: CreateXxxInput): Xxx;
  public updateXxx(id: number, data: UpdateXxxInput): Xxx;
  public deactivateXxx(id: number): void;

  // Business queries (with logic)
  public getActiveXxx(): Xxx[];
  public searchXxx(criteria: SearchCriteria): Xxx[];

  // Business validations
  public validateXxx(data: XxxData): void;

  // Business calculations
  public calculateXxx(params: XxxParams): number;

  // Complex workflows
  public processXxx(data: ProcessInput): ProcessResult;

  // Private helpers
  private _validateBusinessRule(data: any): void;
  private _calculateInternal(params: any): number;
}
```

---

## Summary

| Rule                           | Reason                        |
| ------------------------------ | ----------------------------- |
| **Business logic in services** | Single source of truth        |
| **No SQL in services**         | Separation of concerns        |
| **Orchestrate repositories**   | Coordinate complex operations |
| **Throw typed errors**         | Better error handling         |
| **Framework-agnostic**         | Testable, reusable            |
| **IPC calls services**         | Proper layering               |

**Services are the brain of the application - they contain all business intelligence!**
