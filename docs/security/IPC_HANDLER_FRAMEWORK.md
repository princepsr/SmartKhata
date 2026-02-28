# IPC Handler Framework

## Overview

The IPC Handler Framework provides a robust, type-safe wrapper for all IPC communication in the main process. It automatically handles errors, validation, logging, and response formatting.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Renderer Process                        │
│                                                              │
│  window.electron.products.create({ name, price, stock })    │
└────────────────────────┬─────────────────────────────────────┘
                         │ IPC Invoke
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      Preload Script                          │
│                                                              │
│  ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_CREATE, request)   │
└────────────────────────┬─────────────────────────────────────┘
                         │ Context Bridge
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      Main Process                            │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           IPCHandler.handle()                         │  │
│  │                                                       │  │
│  │  1. Log Request                                       │  │
│  │  2. Validate Input (if validation provided)          │  │
│  │  3. Execute Handler Function                          │  │
│  │  4. Log Success/Error                                 │  │
│  │  5. Return Formatted Response                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │                                    │
│                         ▼                                    │
│              { success: true, data: product }                │
└────────────────────────┬─────────────────────────────────────┘
                         │ IPC Response
                         ▼
                    Renderer Process
```

---

## Execution Flow

### Step-by-Step Flow

**1. Request Initiated (Renderer)**
```typescript
const response = await window.electron.products.create({
  name: "New Product",
  price: 100,
  stock: 50
});
```

**2. Preload Bridge**
```typescript
ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_CREATE, request)
```

**3. Main Process - IPCHandler Receives Request**
```typescript
ipcMain.handle(channel, async (event, request) => {
  // IPCHandler wrapper starts here
})
```

**4. Generate Request ID & Start Timer**
```typescript
const requestId = "1707350400000-abc123def";
const startTime = Date.now();
```

**5. Log Request**
```typescript
logger.debug('IPC Request: product:create', {
  requestId: "1707350400000-abc123def",
  request: { name: "New Product", price: 100, stock: 50 }
});
```

**6. Validate Input (if provided)**
```typescript
if (options.validate) {
  await options.validate(request);
  // Throws error if validation fails
}
```

**7. Execute Handler Function**
```typescript
const data = await handler(request, event);
// Returns: { id: 3, name: "New Product", price: 100, stock: 50 }
```

**8. Log Success**
```typescript
logger.debug('IPC Response: product:create', {
  requestId: "1707350400000-abc123def",
  success: true,
  duration: "150ms"
});
```

**9. Return Success Response**
```typescript
return {
  success: true,
  data: { id: 3, name: "New Product", price: 100, stock: 50 }
};
```

**10. Renderer Receives Response**
```typescript
if (response.success) {
  console.log(response.data); // Product object
}
```

---

### Error Flow

**If validation fails or handler throws:**

**1. Catch Error**
```typescript
catch (error) {
  // Error caught by IPCHandler
}
```

**2. Log Error**
```typescript
logger.error('IPC Error: product:create', {
  requestId: "1707350400000-abc123def",
  error: "Product name is required",
  stack: "Error: Product name is required\n  at ...",
  duration: "5ms"
});
```

**3. Sanitize Error**
```typescript
const errorMessage = this.sanitizeError(error);
// Returns: "Product name is required"
// NOT: Full stack trace or internal paths
```

**4. Return Error Response**
```typescript
return {
  success: false,
  error: "Product name is required"
};
```

**5. Renderer Handles Error**
```typescript
if (!response.success) {
  console.error(response.error); // "Product name is required"
  alert(response.error);
}
```

---

## Core Components

### 1. IPCHandler Class

**File:** `src/main/ipc/ipc-handler.ts`

**Main Method:**
```typescript
IPCHandler.handle<TRequest, TResponse>(
  channel: IPCChannel,
  handler: (request: TRequest, event: IpcMainInvokeEvent) => Promise<TResponse>,
  options?: IPCHandlerOptions<TRequest>
)
```

**Features:**
- Automatic try/catch wrapper
- Request/response logging
- Input validation hook
- Error sanitization
- Response formatting
- Request ID generation
- Performance timing

---

### 2. Handler Options

```typescript
interface IPCHandlerOptions<TRequest> {
  validate?: (request: TRequest) => void | Promise<void>;
  transformError?: (error: Error) => string;
  skipLogging?: boolean;
}
```

**`validate`** - Validation function
- Called before handler executes
- Throw error to reject request
- Async validation supported

**`transformError`** - Custom error transformer
- Convert error codes to user-friendly messages
- Sanitize sensitive information

**`skipLogging`** - Skip logging
- For sensitive operations (auth, passwords)
- Still logs errors

---

### 3. Response Format

```typescript
interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

**Success Response:**
```typescript
{
  success: true,
  data: { id: 1, name: "Product" }
}
```

**Error Response:**
```typescript
{
  success: false,
  error: "Product not found"
}
```

---

## Usage Examples

### Example 1: Simple Handler

```typescript
IPCHandler.handle<void, Product[]>(
  IPC_CHANNELS.PRODUCT_LIST,
  async () => {
    const products = await db.products.findAll();
    return products;
  }
);
```

**Flow:**
1. No validation needed
2. Query database
3. Return products array
4. IPCHandler wraps in `{ success: true, data: [...] }`

---

### Example 2: Handler with Validation

```typescript
IPCHandler.handle<number, Product>(
  IPC_CHANNELS.PRODUCT_GET,
  async (productId) => {
    const product = await db.products.findById(productId);
    if (!product) throw new Error('Product not found');
    return product;
  },
  {
    validate: (productId) => {
      if (!productId || productId <= 0) {
        throw new Error('Invalid product ID');
      }
    }
  }
);
```

**Flow:**
1. Validate productId > 0
2. If invalid, throw error → return `{ success: false, error: "..." }`
3. If valid, query database
4. If not found, throw error → return `{ success: false, error: "Product not found" }`
5. If found, return `{ success: true, data: product }`

---

### Example 3: Complex Validation

```typescript
IPCHandler.handle<CreateProductRequest, Product>(
  IPC_CHANNELS.PRODUCT_CREATE,
  async (request) => {
    const product = await db.products.create(request);
    return product;
  },
  {
    validate: (request) => {
      if (!request.name || request.name.trim().length === 0) {
        throw new Error('Product name is required');
      }
      if (request.price <= 0) {
        throw new Error('Price must be greater than 0');
      }
      if (request.stock < 0) {
        throw new Error('Stock cannot be negative');
      }
    }
  }
);
```

**Flow:**
1. Validate name (required, not empty)
2. Validate price (> 0)
3. Validate stock (>= 0)
4. If any validation fails, return error immediately
5. If all valid, create product in database
6. Return created product

---

### Example 4: Custom Error Transform

```typescript
IPCHandler.handle<UpdateProductRequest, Product>(
  IPC_CHANNELS.PRODUCT_UPDATE,
  async (request) => {
    const product = await db.products.update(request.id, request.data);
    if (!product) throw new Error('PRODUCT_NOT_FOUND');
    return product;
  },
  {
    transformError: (error) => {
      const errorMap = {
        'PRODUCT_NOT_FOUND': 'Product not found',
        'VALIDATION_ERROR': 'Invalid product data',
      };
      return errorMap[error.message] || error.message;
    }
  }
);
```

**Flow:**
1. Execute handler
2. If error thrown with code (e.g., 'PRODUCT_NOT_FOUND')
3. Transform to user-friendly message
4. Return `{ success: false, error: "Product not found" }`

---

### Example 5: Skip Logging (Sensitive Data)

```typescript
IPCHandler.handle<LoginRequest, { token: string }>(
  IPC_CHANNELS.AUTH_LOGIN,
  async (request) => {
    const user = await authenticate(request.username, request.password);
    return { token: generateToken(user) };
  },
  {
    skipLogging: true, // Don't log password
    validate: (request) => {
      if (!request.username || !request.password) {
        throw new Error('Username and password required');
      }
    }
  }
);
```

**Flow:**
1. Request NOT logged (skipLogging: true)
2. Validate credentials present
3. Authenticate user
4. Return token
5. Success logged without request data
6. Errors still logged (without sensitive data)

---

## Adding New Handlers

### Step 1: Create Handler File

```typescript
// src/main/ipc/handlers/sale-handlers.ts
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { IPCHandler } from '../ipc-handler';

export function registerSaleHandlers(): void {
  IPCHandler.handle<CreateSaleRequest, Sale>(
    IPC_CHANNELS.SALE_CREATE,
    async (request) => {
      // Handler logic
      const sale = await db.sales.create(request);
      return sale;
    },
    {
      validate: (request) => {
        if (!request.items || request.items.length === 0) {
          throw new Error('Sale must have at least one item');
        }
      }
    }
  );
}
```

---

### Step 2: Register in index.ts

```typescript
// src/main/ipc/index.ts
import { registerSaleHandlers } from './handlers/sale-handlers';

export function registerIPCHandlers(): void {
  registerProductHandlers();
  registerSaleHandlers(); // Add this
}
```

---

### Step 3: Call from Main Process

```typescript
// src/main/index.ts
import { registerIPCHandlers } from './ipc';

app.whenReady().then(() => {
  registerIPCHandlers(); // Register all IPC handlers
  createWindow();
});
```

---

## Logging Output

### Success Example

```
[2026-02-08 03:00:00] [DEBUG] IPC Request: product:create {
  requestId: "1707350400000-abc123def",
  request: { name: "New Product", price: 100, stock: 50 }
}

[2026-02-08 03:00:00] [DEBUG] IPC Response: product:create {
  requestId: "1707350400000-abc123def",
  success: true,
  duration: "150ms"
}
```

---

### Error Example

```
[2026-02-08 03:00:00] [DEBUG] IPC Request: product:create {
  requestId: "1707350400000-xyz789abc",
  request: { name: "", price: -10, stock: 50 }
}

[2026-02-08 03:00:00] [ERROR] IPC Error: product:create {
  requestId: "1707350400000-xyz789abc",
  error: "Product name is required",
  stack: "Error: Product name is required\n  at validate (...)",
  duration: "5ms"
}
```

---

## Security Features

### 1. Error Sanitization

**❌ NEVER exposed to renderer:**
- Stack traces
- Internal file paths
- Database errors
- System information

**✅ ONLY exposed to renderer:**
- User-friendly error messages
- Validation errors
- Business logic errors

---

### 2. Input Validation

**All inputs validated before processing:**
```typescript
validate: (request) => {
  // Type checking
  if (typeof request.price !== 'number') {
    throw new Error('Price must be a number');
  }
  
  // Range checking
  if (request.price < 0 || request.price > 999999) {
    throw new Error('Invalid price range');
  }
  
  // Format checking
  if (request.email && !isValidEmail(request.email)) {
    throw new Error('Invalid email format');
  }
}
```

---

### 3. Sensitive Data Protection

**Automatic redaction in logs:**
```typescript
// Request: { username: "admin", password: "secret123" }
// Logged as: { username: "admin", password: "***REDACTED***" }
```

**Fields automatically redacted:**
- `password`
- `token`
- `secret`
- `apiKey`

---

## Best Practices

### ✅ DO

```typescript
// Use type safety
IPCHandler.handle<CreateProductRequest, Product>(...)

// Validate all inputs
validate: (request) => {
  if (!request.name) throw new Error('Name required');
}

// Return meaningful errors
throw new Error('Product not found');

// Use async/await
async (request) => {
  const product = await db.products.create(request);
  return product;
}
```

---

### ❌ DON'T

```typescript
// Don't use any types
IPCHandler.handle<any, any>(...)

// Don't skip validation
// (no validate option)

// Don't expose internal errors
throw new Error(error.stack); // NO!

// Don't use callbacks
(request, callback) => {
  db.products.create(request, callback); // NO!
}
```

---

## Summary

**IPCHandler provides:**
- ✅ Automatic error handling (try/catch)
- ✅ Input validation hooks
- ✅ Request/response logging
- ✅ Error sanitization
- ✅ Performance timing
- ✅ Type safety
- ✅ Standard response format

**No handler can crash the app** - all errors are caught and logged

**Easy to add new handlers** - just call `IPCHandler.handle()`

---

**Files:**
- `src/main/ipc/ipc-handler.ts` - Base framework
- `src/main/ipc/handlers/*.ts` - Handler implementations
- `src/main/ipc/index.ts` - Registration
- `src/shared/types/ipc.ts` - Response types

---

**Last updated:** 2026-02-08  
**Version:** 1.0
