# IPC to Service Mapping

## Overview

This document explains how **IPC handlers call services** instead of repositories, with proper error handling and user-friendly messages.

---

## Layered Architecture

```
┌─────────────────────────────────────────┐
│              UI (Renderer)              │
│         React Components + State        │
└─────────────────────────────────────────┘
                    ↓
            window.api.xxx()
                    ↓
┌─────────────────────────────────────────┐
│          IPC Layer (Main)               │
│      Handles IPC Communication          │
└─────────────────────────────────────────┘
                    ↓
          Service Method Call
                    ↓
┌─────────────────────────────────────────┐
│        Service Layer (Main)             │
│      Business Logic + Validation        │
└─────────────────────────────────────────┘
                    ↓
        Repository Method Calls
                    ↓
┌─────────────────────────────────────────┐
│      Repository Layer (Main)            │
│         SQL Queries + Mapping           │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         SQLite Database                 │
└─────────────────────────────────────────┘
```

---

## Data Flow Rules

### ✅ Correct Flow

```
UI → IPC → Service → Repository → Database
```

**Example:**
```typescript
// UI
const result = await window.api.product.create(productData);

// IPC Handler
const product = productService.addProduct(input);

// Service
const product = this.productRepo.create(productInput);

// Repository
this.execute(sql, params);
```

---

### ❌ Incorrect Flow

```
UI → IPC → Repository → Database  ❌ WRONG!
```

**Why wrong?**
- Business logic in IPC handler
- No validation
- No error mapping
- Violates separation of concerns

---

## IPC Handler Pattern

### Standard Handler Structure

```typescript
IPCHandler.handle<InputType, IPCResponse<OutputType>>(
  'channel:name',
  async (input) => {
    try {
      // 1. Call service method
      const result = service.methodName(input);

      // 2. Convert to plain object
      const plainResult = {
        id: result.id,
        name: result.name,
        // ... other fields
      };

      // 3. Return success response
      return {
        success: true,
        data: plainResult
      };
    } catch (error) {
      // 4. Handle service errors
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: error.getUserMessage(),
          errorCode: 'VALIDATION_ERROR'
        };
      }

      // 5. Generic error fallback
      return {
        success: false,
        error: getUserFriendlyMessage(error)
      };
    }
  }
);
```

---

## Error Handling Pattern

### Service Error → IPC Response Mapping

```typescript
try {
  const result = service.methodName(input);
  return { success: true, data: result };
} catch (error) {
  // Specific error handling
  if (error instanceof ValidationError) {
    return {
      success: false,
      error: error.getUserMessage(),
      errorCode: 'VALIDATION_ERROR'
    };
  }

  if (error instanceof NotFoundError) {
    return {
      success: false,
      error: 'Product not found',
      errorCode: 'NOT_FOUND'
    };
  }

  if (error instanceof DuplicateEntryError) {
    return {
      success: false,
      error: error.getUserMessage(),
      errorCode: 'DUPLICATE_ENTRY'
    };
  }

  if (error instanceof InsufficientStockError) {
    return {
      success: false,
      error: error.getUserMessage(),
      errorCode: 'INSUFFICIENT_STOCK',
      context: {
        available: error.available,
        required: error.required
      }
    };
  }

  // Generic fallback
  return {
    success: false,
    error: getUserFriendlyMessage(error)
  };
}
```

---

## Complete Examples

### Example 1: Product Creation

**UI → IPC → Service → Repository**

```typescript
// ============================================
// UI (Renderer)
// ============================================
const createProduct = async (productData) => {
  const result = await window.api.product.create({
    name: 'Coca Cola 500ml',
    sku: 'COKE-500',
    price: 40,
    gstPercent: 18,
    stock: 100
  });

  if (!result.success) {
    alert(result.error);
    return;
  }

  console.log('Product created:', result.data);
};

// ============================================
// IPC Handler
// ============================================
IPCHandler.handle('product:create', async (request) => {
  try {
    // Call service
    const product = productService.addProduct({
      name: request.name,
      sku: request.sku,
      salePrice: request.price,
      gstPercent: request.gstPercent,
      stockQty: request.stock
    });

    // Return success
    return {
      success: true,
      data: {
        id: product.id,
        name: product.name,
        // ... other fields
      }
    };
  } catch (error) {
    // Handle errors
    if (error instanceof DuplicateEntryError) {
      return {
        success: false,
        error: 'This SKU is already in use',
        errorCode: 'DUPLICATE_ENTRY'
      };
    }

    return {
      success: false,
      error: getUserFriendlyMessage(error)
    };
  }
});

// ============================================
// Service
// ============================================
public addProduct(input: AddProductInput): Product {
  // Validate
  this._validateProductInput(input);

  // Check duplicates
  if (input.sku) {
    const existing = this.productRepo.findBySku(input.sku);
    if (existing) {
      throw new DuplicateEntryError('Product', 'SKU', input.sku);
    }
  }

  // Create
  return this.productRepo.create(input);
}

// ============================================
// Repository
// ============================================
public create(data: CreateProductInput): Product {
  const sql = `INSERT INTO products (...) VALUES (...)`;
  const result = this.execute(sql, params);
  return this.findById(result.lastInsertRowid);
}
```

---

### Example 2: Bill Creation

**UI → IPC → Service → Repository**

```typescript
// ============================================
// UI (Renderer)
// ============================================
const createBill = async (billData) => {
  const result = await window.api.bill.create({
    billNumber: 'BILL-20260208-0001',
    items: [
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1 }
    ],
    paymentMode: 'cash'
  });

  if (!result.success) {
    if (result.errorCode === 'INSUFFICIENT_STOCK') {
      alert(`Not enough stock: ${result.context.productName}`);
    } else {
      alert(result.error);
    }
    return;
  }

  console.log('Bill created:', result.data);
};

// ============================================
// IPC Handler
// ============================================
IPCHandler.handle('bill:create', async (billInput) => {
  try {
    // Call service
    const result = billingService.finalizeBill(billInput);

    // Return success
    return {
      success: true,
      data: {
        bill: { /* ... */ },
        items: [ /* ... */ ]
      }
    };
  } catch (error) {
    // Handle errors
    if (error instanceof InsufficientStockError) {
      return {
        success: false,
        error: error.getUserMessage(),
        errorCode: 'INSUFFICIENT_STOCK',
        context: {
          productName: error.productName,
          available: error.available,
          required: error.required
        }
      };
    }

    if (error instanceof DuplicateEntryError) {
      return {
        success: false,
        error: 'Bill number already exists',
        errorCode: 'DUPLICATE_ENTRY'
      };
    }

    return {
      success: false,
      error: getUserFriendlyMessage(error)
    };
  }
});

// ============================================
// Service
// ============================================
public finalizeBill(input: FinalizeBillInput): BillWithItems {
  // Validate all inputs
  this._validateBillNumber(input.billNumber);
  this._validatePaymentMode(input.paymentMode);

  // Check stock availability
  input.items.forEach(item => {
    const product = this.productRepo.findById(item.productId);
    if (product.stockQty < item.quantity) {
      throw new InsufficientStockError(
        product.id,
        product.name,
        product.stockQty,
        item.quantity
      );
    }
  });

  // Execute atomic transaction
  return this.transactionService.createSale(saleInput);
}

// ============================================
// Repository (via Transaction Service)
// ============================================
public createSale(saleData: CreateSaleInput): BillWithItems {
  return this.transaction(() => {
    // Create bill
    // Deduct stock
    // Log inventory
    // Update customer balance
  });
}
```

---

## Response Format

### Success Response

```typescript
{
  success: true,
  data: {
    // Result data
  }
}
```

### Error Response

```typescript
{
  success: false,
  error: "User-friendly error message",
  errorCode: "ERROR_CODE",  // Optional
  context: {                 // Optional
    // Additional error context
  }
}
```

---

## Error Code Examples

| Error Code | Meaning | Example |
|------------|---------|---------|
| `VALIDATION_ERROR` | Input validation failed | "Product name is required" |
| `NOT_FOUND` | Entity not found | "Product not found" |
| `DUPLICATE_ENTRY` | Duplicate entry | "This SKU is already in use" |
| `INSUFFICIENT_STOCK` | Not enough stock | "Not enough stock for Coca Cola" |
| `INACTIVE_ENTITY` | Entity is inactive | "This product is inactive" |
| `CREDIT_LIMIT_EXCEEDED` | Credit limit exceeded | "Customer credit limit exceeded" |

---

## Benefits of Service Layer

| Benefit | Description |
|---------|-------------|
| **Separation of Concerns** | IPC handles communication, services handle logic |
| **Reusability** | Services can be called from multiple IPC handlers |
| **Testability** | Services can be tested independently |
| **Error Handling** | Centralized error handling in services |
| **Validation** | Business validation in one place |
| **Consistency** | Same logic for all entry points |

---

## Summary

**IPC Handler Responsibilities:**
- ✅ Call service methods
- ✅ Handle service errors
- ✅ Map errors to user-friendly messages
- ✅ Convert domain objects to plain objects
- ❌ NO business logic
- ❌ NO validation
- ❌ NO repository calls

**This ensures clean layered architecture with proper separation of concerns!**
