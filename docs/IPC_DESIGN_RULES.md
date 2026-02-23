# IPC Design Rules

## Core Philosophy

**IPC is boring, predictable, and secure.**

SmartKhata uses a **strict request-response pattern** for all communication between the Electron main process and React renderer. No events, no pub/sub, no surprises.

---

## Fundamental Rules

### Rule 1: Request-Response Only

**✅ ALLOWED:**

- Renderer sends request → Main returns response
- Synchronous, predictable flow
- One request = One response

**❌ FORBIDDEN:**

- Event-based communication
- Pub/sub patterns
- Main process pushing unsolicited data to renderer
- Renderer listening for arbitrary events

---

### Rule 2: Communication Direction

```
┌──────────────┐                    ┌──────────────┐
│   Renderer   │  ──── Request ──→  │     Main     │
│   (React)    │  ←── Response ───  │  (Backend)   │
└──────────────┘                    └──────────────┘
```

**Renderer → Main:**

- Commands (create, update, delete)
- Queries (get, list, search)
- System operations (backup, export)

**Main → Renderer:**

- Success responses with data
- Error responses with message
- Never: Unsolicited events

---

### Rule 3: No Wildcards or Dynamic Channels

**✅ ALLOWED:**

```typescript
// Predefined, static channel names
const IPC_EVENTS = {
  PRODUCT_CREATE: 'product:create',
  PRODUCT_LIST: 'product:list',
} as const;
```

**❌ FORBIDDEN:**

```typescript
// Dynamic channel names
const channel = `product:${action}`; // NO!

// Wildcard listeners
ipcMain.on('product:*', ...); // NO!

// User-controlled channel names
window.electron.invoke(userInput); // NO!
```

---

## Naming Convention

### Format

```
module:action
```

**Components:**

- `module` - Lowercase, singular noun (product, sale, customer, system)
- `action` - Lowercase verb or noun (create, list, search, backup)
- Separator - Always colon (`:`)

---

### Standard Actions

| Action   | Meaning                   | Example          |
| -------- | ------------------------- | ---------------- |
| `create` | Create new resource       | `product:create` |
| `list`   | Get all resources         | `product:list`   |
| `get`    | Get single resource by ID | `product:get`    |
| `update` | Update existing resource  | `product:update` |
| `delete` | Delete resource           | `product:delete` |
| `search` | Search/filter resources   | `product:search` |
| `count`  | Get count of resources    | `product:count`  |
| `exists` | Check if resource exists  | `product:exists` |

---

### Module Examples

**Business Entities:**

```typescript
// Products
'product:create';
'product:list';
'product:get';
'product:update';
'product:delete';
'product:search';

// Sales
'sale:create';
'sale:list';
'sale:get';
'sale:void'; // Business-specific action

// Customers
'customer:create';
'customer:list';
'customer:get';
'customer:update';
```

**System Operations:**

```typescript
// System
'system:backup';
'system:restore';
'system:export';
'system:import';

// Settings
'settings:get';
'settings:update';
'settings:reset';

// Reports
'report:sales';
'report:inventory';
'report:profit';
```

**App Metadata:**

```typescript
// App
'app:version';
'app:config';
'app:logs';
```

---

## Good vs Bad Examples

### ✅ GOOD: Clear, Predictable

```typescript
// Clear module and action
'product:create';
'product:list';
'sale:create';
'customer:search';

// Specific, unambiguous
'report:sales-by-date';
'system:backup-database';
'settings:update-tax-rate';
```

---

### ❌ BAD: Ambiguous, Dynamic

```typescript
// Too generic
'data';
'fetch';
'update'
// Dynamic/computed
`${module}:${action}`; // Runtime construction
'product-' + id; // Variable channel

// Event-like names
('product-created'); // Sounds like an event
('on-sale-complete'); // Event listener pattern
('product:changed'); // Pub/sub pattern

// Wildcards
('product:*');
('*:create');

// Nested/complex
('product:category:subcategory:list'); // Too deep

// Camel case (inconsistent)
('productCreate'); // Use 'product:create'
('getProduct'); // Use 'product:get'
```

---

## Request-Response Pattern

### Standard Response Format

**All IPC handlers MUST return:**

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

### Request Types

**1. No Parameters (Query)**

```typescript
// Channel: 'product:list'
// Request: void
// Response: IPCResponse<Product[]>

await window.electron.products.list();
```

**2. Single Parameter (Get by ID)**

```typescript
// Channel: 'product:get'
// Request: number (ID)
// Response: IPCResponse<Product>

await window.electron.products.get(123);
```

**3. Object Parameter (Create/Update)**

```typescript
// Channel: 'product:create'
// Request: CreateProductRequest
// Response: IPCResponse<Product>

await window.electron.products.create({
  name: 'New Product',
  price: 100,
  stock: 50,
});
```

**4. Multiple Parameters (Search/Filter)**

```typescript
// Channel: 'sale:list-by-date'
// Request: { startDate: string, endDate: string }
// Response: IPCResponse<Sale[]>

await window.electron.sales.listByDate({
  startDate: '2026-01-01',
  endDate: '2026-01-31',
});
```

---

## Security Rules

### Rule 1: No Direct ipcRenderer Access

**❌ FORBIDDEN in Renderer:**

```typescript
import { ipcRenderer } from 'electron'; // NO!

ipcRenderer.invoke('any:channel'); // NO!
```

**✅ REQUIRED:**

```typescript
// Only use window.electron API
await window.electron.products.list();
```

---

### Rule 2: Whitelist All Channels

**In Preload Script:**

```typescript
// ❌ BAD: Generic invoke
const api = {
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
};

// ✅ GOOD: Explicit methods only
const api = {
  products: {
    list: () => ipcRenderer.invoke('product:list'),
    get: (id: number) => ipcRenderer.invoke('product:get', id),
  },
};
```

---

### Rule 3: Validate All Inputs in Main

**Every IPC handler MUST validate:**

```typescript
IPCHandler.handle<CreateProductRequest, Product>('product:create', async (request) => {
  // ✅ REQUIRED: Validate inputs
  if (!request.name || request.name.trim().length === 0) {
    throw new Error('Product name is required');
  }
  if (request.price <= 0) {
    throw new Error('Price must be greater than 0');
  }
  if (request.stock < 0) {
    throw new Error('Stock cannot be negative');
  }

  // Process request...
});
```

**Note:** All IPC requests should use a corresponding Zod schema for validation. See **[SECURITY_AND_VALIDATION.md](SECURITY_AND_VALIDATION.md)** for patterns.

````

---

### Rule 4: Sanitize All Errors

**❌ FORBIDDEN:**
```typescript
// Never expose stack traces
return {
  success: false,
  error: error.stack  // NO!
};

// Never expose internal paths
return {
  success: false,
  error: `File not found: ${internalPath}`  // NO!
};
````

**✅ REQUIRED:**

```typescript
// User-friendly error messages only
return {
  success: false,
  error: 'Product not found',
};

// Log full error internally
logger.error('Product creation failed', {
  error: error.stack,
  request,
});
```

---

## Implementation Checklist

When adding a new IPC endpoint:

- [ ] **1. Define channel name** in `src/shared/constants/app-constants.ts`

  ```typescript
  export const IPC_EVENTS = {
    PRODUCT_CREATE: 'product:create',
  } as const;
  ```

- [ ] **2. Define types** in `src/shared/types/ipc.ts`

  ```typescript
  export interface CreateProductRequest {
    name: string;
    price: number;
    stock: number;
  }
  ```

- [ ] **3. Create handler** in `src/main/ipc/handlers/`

  ```typescript
  IPCHandler.handle<CreateProductRequest, Product>(IPC_EVENTS.PRODUCT_CREATE, async (request) => {
    // Validate
    // Process
    // Return
  });
  ```

- [ ] **4. Register handler** in `src/main/ipc/index.ts`

  ```typescript
  registerProductHandlers();
  ```

- [ ] **5. Expose in preload** in `src/preload/index.ts`

  ```typescript
  const api = {
    products: {
      create: (req: CreateProductRequest) => ipcRenderer.invoke(IPC_EVENTS.PRODUCT_CREATE, req),
    },
  };
  ```

- [ ] **6. Add TypeScript types** to `ElectronAPI` type

- [ ] **7. Test** in renderer
  ```typescript
  const result = await window.electron.products.create({
    name: 'Test',
    price: 100,
    stock: 50,
  });
  ```

---

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Event Emitters

```typescript
// DON'T DO THIS
ipcMain.on('product-created', (event, product) => {
  // Broadcast to all windows
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('product-updated', product);
  });
});
```

**Why:** Unpredictable, hard to debug, breaks request-response model

---

### ❌ Anti-Pattern 2: Bidirectional Events

```typescript
// DON'T DO THIS
// Renderer
ipcRenderer.on('data-changed', (event, data) => {
  updateUI(data);
});

// Main
webContents.send('data-changed', newData);
```

**Why:** Creates tight coupling, race conditions, memory leaks

---

### ❌ Anti-Pattern 3: Polling

```typescript
// DON'T DO THIS
setInterval(async () => {
  const products = await window.electron.products.list();
  updateProducts(products);
}, 1000);
```

**Why:** Wasteful, creates unnecessary load

**Instead:** Fetch data when user action requires it

---

### ❌ Anti-Pattern 4: Passing Functions

```typescript
// DON'T DO THIS
window.electron.products.create({
  name: 'Product',
  onSuccess: () => console.log('Created!'), // NO!
});
```

**Why:** Functions cannot be serialized over IPC

**Instead:** Use async/await and handle response

---

## Logging Requirements

**Every IPC call MUST be logged:**

```typescript
// In main process
logger.debug('IPC Request: product:create', { request });
logger.debug('IPC Response: product:create', { success: true });
logger.error('IPC Error: product:create', { error });
```

**Log Format:**

- `IPC Request: <channel>` - When request received
- `IPC Response: <channel>` - When response sent
- `IPC Error: <channel>` - When error occurs

---

## Summary

**DO:**

- ✅ Use `module:action` naming
- ✅ Request-response only
- ✅ Validate all inputs
- ✅ Sanitize all errors
- ✅ Log everything
- ✅ Type everything

**DON'T:**

- ❌ Use events or pub/sub
- ❌ Use dynamic channel names
- ❌ Expose ipcRenderer directly
- ❌ Return stack traces
- ❌ Allow arbitrary channels
- ❌ Use wildcards

---

**IPC is boring, predictable, and secure. Keep it that way.**

---

**Last updated:** 2026-02-23  
**Version:** 1.0
