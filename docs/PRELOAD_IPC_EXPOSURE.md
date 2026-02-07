# Preload IPC Exposure

## Overview

The preload script provides a **secure bridge** between the renderer process (React) and the main process (Electron backend). It exposes a single, validated `invoke()` method via `contextBridge`.

---

## Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                      Renderer Process                        │
│                    (React Application)                       │
│                                                              │
│  - No Node.js access (nodeIntegration: false)               │
│  - No direct IPC access                                      │
│  - Only has window.api.invoke()                             │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ contextBridge
                         │ (secure boundary)
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                      Preload Script                          │
│                   (Privileged Context)                       │
│                                                              │
│  1. Validate channel against IPC_CHANNELS registry          │
│  2. Reject if channel not registered                         │
│  3. Forward to ipcRenderer if valid                          │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ ipcRenderer.invoke()
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                      Main Process                            │
│                   (Electron Backend)                         │
│                                                              │
│  - Full Node.js access                                       │
│  - Database, file system, etc.                               │
│  - IPC handlers registered                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Exposed API

### Single Method: `window.api.invoke()`

```typescript
window.api.invoke<T>(channel: string, payload?: unknown): Promise<IPCResponse<T>>
```

**Parameters:**
- `channel` - IPC channel name (must be in `IPC_CHANNELS` registry)
- `payload` - Request data (optional)

**Returns:**
- `Promise<IPCResponse<T>>` - Standard response format

**Throws:**
- Never throws - returns error response instead

---

## Security Guarantees

### 1. No Raw ipcRenderer Exposure

**❌ Renderer CANNOT do this:**
```typescript
// These are NOT available in renderer
import { ipcRenderer } from 'electron'; // Error: Module not found
ipcRenderer.invoke('any:channel'); // Not accessible
```

**✅ Renderer CAN ONLY do this:**
```typescript
// Only this is available
await window.api.invoke('product:list');
```

---

### 2. Channel Validation

**All channels validated against registry:**

```typescript
// ✅ VALID: Channel is registered
await window.api.invoke('product:list');
// Returns: { success: true, data: [...] }

// ❌ INVALID: Channel not registered
await window.api.invoke('hacker:exploit');
// Returns: { success: false, error: "Invalid IPC channel: hacker:exploit" }
// Logs error to console
// Does NOT crash the app
```

---

### 3. Context Isolation

**Renderer cannot access preload scope:**

```typescript
// In preload.ts
import { ipcRenderer } from 'electron';

// ❌ Renderer CANNOT access:
// - ipcRenderer
// - isValidChannel
// - IPC_CHANNELS
// - Any other preload variables

// ✅ Renderer CAN ONLY access:
// - window.api.invoke (exposed via contextBridge)
```

---

### 4. No Dynamic Channel Construction

**Prevents arbitrary channel access:**

```typescript
// ❌ This will be rejected
const userInput = "product:delete"; // From user
await window.api.invoke(userInput); // Validated against registry

// ❌ This will be rejected
const action = "delete";
await window.api.invoke(`product:${action}`); // Not in registry

// ✅ Only registered channels work
await window.api.invoke('product:list'); // In registry
```

---

## Usage Examples

### Example 1: Simple Query (No Payload)

```typescript
// List all products
const response = await window.api.invoke('product:list');

if (response.success) {
  const products = response.data; // Product[]
  console.log('Products:', products);
} else {
  console.error('Error:', response.error);
}
```

---

### Example 2: Query with Parameter

```typescript
// Get product by ID
const response = await window.api.invoke('product:get', 123);

if (response.success) {
  const product = response.data; // Product
  console.log('Product:', product);
} else {
  alert(response.error); // "Product not found"
}
```

---

### Example 3: Create with Object Payload

```typescript
// Create new product
const response = await window.api.invoke('product:create', {
  name: "New Product",
  price: 100,
  stock: 50
});

if (response.success) {
  const product = response.data; // Product with ID
  console.log('Created:', product);
} else {
  alert(response.error); // "Product name is required"
}
```

---

### Example 4: Type-Safe Usage

```typescript
// TypeScript knows the response type
interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
}

const response = await window.api.invoke<Product[]>('product:list');

if (response.success) {
  // TypeScript knows response.data is Product[]
  response.data.forEach(product => {
    console.log(product.name); // Autocomplete works!
  });
}
```

---

### Example 5: Error Handling

```typescript
try {
  const response = await window.api.invoke('product:create', {
    name: "",
    price: -10
  });

  if (!response.success) {
    // Validation error from main process
    console.error(response.error); // "Product name is required"
    return;
  }

  // Success
  console.log('Created:', response.data);
} catch (error) {
  // Network/IPC error (rare)
  console.error('IPC call failed:', error);
}
```

---

## Execution Flow

### Successful Request

**1. Renderer calls invoke()**
```typescript
await window.api.invoke('product:list');
```

**2. Preload validates channel**
```typescript
if (!isValidChannel('product:list')) {
  // Not reached - channel is valid
}
```

**3. Preload forwards to main**
```typescript
return ipcRenderer.invoke('product:list', undefined);
```

**4. Main process handles request**
```typescript
IPCHandler.handle('product:list', async () => {
  return await db.products.findAll();
});
```

**5. Main returns response**
```typescript
return {
  success: true,
  data: [{ id: 1, name: "Product" }]
};
```

**6. Renderer receives response**
```typescript
// response = { success: true, data: [...] }
```

---

### Invalid Channel Request

**1. Renderer calls invoke() with invalid channel**
```typescript
await window.api.invoke('hacker:exploit');
```

**2. Preload validates channel**
```typescript
if (!isValidChannel('hacker:exploit')) {
  // Channel not in registry!
  console.error('[Preload] Invalid IPC channel: hacker:exploit');
}
```

**3. Preload returns error (does NOT forward to main)**
```typescript
return Promise.resolve({
  success: false,
  error: 'Invalid IPC channel: hacker:exploit'
});
```

**4. Renderer receives error response**
```typescript
// response = { success: false, error: "Invalid IPC channel: ..." }
```

**5. Main process never called**
- Request blocked at preload level
- No handler executed
- No database access
- No security risk

---

## Type Safety

### Window API Type Definition

**File:** `src/renderer/vite-env.d.ts`

```typescript
declare global {
  interface Window {
    api: {
      invoke: <T = unknown>(
        channel: string,
        payload?: unknown
      ) => Promise<IPCResponse<T>>;
    };
  }
}
```

**Benefits:**
- TypeScript autocomplete for `window.api.invoke`
- Type checking for response
- IDE shows method signature

---

### Usage with Types

```typescript
// Define response type
interface Product {
  id: number;
  name: string;
  price: number;
}

// TypeScript infers response.data type
const response = await window.api.invoke<Product[]>('product:list');

if (response.success) {
  // response.data is Product[]
  const firstProduct = response.data[0];
  console.log(firstProduct.name); // ✅ Autocomplete works
}
```

---

## Security Checklist

When using the preload IPC bridge:

- [x] **No raw ipcRenderer** - Not exposed to renderer
- [x] **Channel validation** - All channels validated against registry
- [x] **Context isolation** - Renderer cannot access preload scope
- [x] **No arbitrary channels** - Only registered channels allowed
- [x] **Error handling** - Invalid channels return error, don't crash
- [x] **Type safety** - TypeScript types for window.api
- [x] **Logging** - Invalid channel attempts logged to console
- [x] **Single method** - Only `invoke()` exposed, no other methods

---

## Comparison: Old vs New

### Old Approach (INSECURE)

```typescript
// ❌ Multiple methods exposed
window.electron.products.getAll();
window.electron.products.create();
window.electron.sales.create();

// ❌ Generic invoke with any channel
window.electron.invoke('any:channel');

// ❌ More surface area for attacks
```

---

### New Approach (SECURE)

```typescript
// ✅ Single method
window.api.invoke('product:list');
window.api.invoke('product:create', data);
window.api.invoke('sale:create', data);

// ✅ All channels validated
// ✅ Minimal surface area
// ✅ Consistent interface
```

---

## Adding New Channels

### Step 1: Add to Registry

```typescript
// src/shared/ipc/channels.ts
export const IPC_CHANNELS = {
  // ... existing channels
  INVENTORY_ADJUST: 'inventory:adjust',
} as const;
```

---

### Step 2: Create Handler

```typescript
// src/main/ipc/handlers/inventory-handlers.ts
IPCHandler.handle('inventory:adjust', async (request) => {
  // Handler logic
});
```

---

### Step 3: Use in Renderer

```typescript
// Automatically available - no preload changes needed!
const response = await window.api.invoke('inventory:adjust', {
  productId: 123,
  quantity: 10
});
```

**No preload changes required!** The channel is automatically validated because it's in the registry.

---

## Debugging

### Enable Verbose Logging

```typescript
// In preload/index.ts
console.log('[Preload] IPC bridge initialized');
console.log('[Preload] Registered channels:', Object.keys(IPC_CHANNELS).length);

// On invalid channel
console.error('[Preload] Invalid IPC channel:', channel);
console.error('[Preload] Allowed channels:', Object.values(IPC_CHANNELS));
```

---

### Check Available Channels

```typescript
// In renderer console (F12)
await window.api.invoke('invalid:channel');

// Console output:
// [Preload] Invalid IPC channel: invalid:channel
// [Preload] Allowed channels: ['product:list', 'product:get', ...]
```

---

## Summary

**Preload exposes:**
- ✅ Single method: `window.api.invoke(channel, payload)`
- ✅ Channel validation against IPC registry
- ✅ No raw ipcRenderer exposure
- ✅ Type-safe via TypeScript
- ✅ Error responses instead of crashes

**Security guarantees:**
- ✅ Context isolation (renderer cannot access preload scope)
- ✅ Channel whitelist (only registered channels allowed)
- ✅ No arbitrary channel access
- ✅ Minimal attack surface

**Developer experience:**
- ✅ Simple API (`window.api.invoke`)
- ✅ TypeScript autocomplete
- ✅ Consistent error handling
- ✅ Easy to add new channels

---

**Files:**
- `src/preload/index.ts` - Preload bridge implementation
- `src/renderer/vite-env.d.ts` - TypeScript definitions
- `src/shared/ipc/channels.ts` - Channel registry

---

**Last updated:** 2026-02-08  
**Version:** 1.0
