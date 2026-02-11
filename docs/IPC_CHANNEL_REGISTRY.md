# IPC Channel Registry

## Overview

The IPC channel registry (`src/shared/ipc/channels.ts`) is the **single source of truth** for all IPC channels in SmartKhata. It ensures type safety and prevents usage of unregistered channels.

---

## File Structure

```
src/shared/ipc/channels.ts
```

**Purpose:**

- Define all allowed IPC channels
- Provide TypeScript types for type safety
- Shared between main and renderer processes
- Prevent arbitrary channel usage

---

## Registry Structure

### 1. Channel Definitions

```typescript
export const IPC_CHANNELS = {
  // Product module
  PRODUCT_LIST: 'product:list',
  PRODUCT_GET: 'product:get',
  PRODUCT_CREATE: 'product:create',

  // Sale module
  SALE_CREATE: 'sale:create',
  SALE_LIST: 'sale:list',
  SALE_GET: 'sale:get',
  SALE_VOID: 'sale:void',

  // Bill module
  BILL_CREATE: 'bill:create',
  BILL_PRINT: 'bill:print',
  PRINTER_LIST: 'printer:list',

  // Report module
  REPORT_DAILY_SALES: 'report:sales',
  REPORT_PAYMENT_MODE: 'reports:payment-mode',
  REPORT_GST: 'report:gst',
  REPORT_STOCK: 'report:stock',
  REPORT_BILL_WISE: 'report:bills',
  REPORT_ANALYTICS: 'report:analytics',

  // Backup module
  BACKUP_CREATE: 'backup:create',
  BACKUP_RESTORE: 'backup:restore',
  BACKUP_INFO: 'backup:info',

  // System module
  SYSTEM_PING: 'system:ping',
  SYSTEM_GET_APP_INFO: 'system:get-app-info',
  SYSTEM_DB_STATUS: 'system:dbStatus',

  // Customer module
  CUSTOMER_SEARCH: 'customer:search',
} as const;
```

**Key Points:**

- `as const` makes it readonly and preserves literal types
- Grouped by module for organization
- Follows `module:action` naming convention

---

### 2. Type Definitions

```typescript
export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
```

**What this does:**

- Extracts all channel values as a union type
- TypeScript will only allow registered channel names
- Provides autocomplete in IDE

**Type resolves to:**

```typescript
type IPCChannel =
  | 'product:list'
  | 'product:get'
  | 'product:create'
  | 'sale:create'
  | 'sale:list'
  | ... // all other channels
```

---

### 3. Helper Functions

#### `getAllChannels()`

```typescript
export const getAllChannels = (): readonly IPCChannel[] => {
  return Object.values(IPC_CHANNELS);
};
```

**Usage:**

```typescript
const channels = getAllChannels();
// ['product:list', 'product:get', ...]
```

---

#### `isValidChannel()`

```typescript
export const isValidChannel = (channel: string): channel is IPCChannel => {
  return getAllChannels().includes(channel as IPCChannel);
};
```

**Usage:**

```typescript
if (isValidChannel(userInput)) {
  // TypeScript knows userInput is IPCChannel here
  ipcRenderer.invoke(userInput);
}
```

---

### 4. Channel Groups

```typescript
export const CHANNEL_GROUPS = {
  PRODUCT: [
    IPC_CHANNELS.PRODUCT_LIST,
    IPC_CHANNELS.PRODUCT_GET,
    // ...
  ],
  SALE: [
    IPC_CHANNELS.SALE_CREATE,
    // ...
  ],
} as const;
```

**Purpose:**

- Organize channels by module
- Useful for logging/debugging
- Documentation

---

## Usage Examples

### In Main Process (IPC Handlers)

```typescript
// src/main/ipc/handlers/product-handlers.ts
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { IPCHandler } from '../ipc-handler';

export function registerProductHandlers(): void {
  // ✅ GOOD: Use registry constant
  IPCHandler.handle(IPC_CHANNELS.PRODUCT_LIST, async () => {
    // handler logic
  });

  // ❌ BAD: String literal
  // IPCHandler.handle('product:list', ...); // NO!
}
```

**Benefits:**

- Autocomplete for channel names
- Compile-time error if channel doesn't exist
- Refactoring is safe (rename in one place)

---

### In Preload Script

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, isValidChannel } from '@shared/ipc/channels';

const electronAPI = {
  products: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_LIST),
    get: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_GET, id),
    create: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_CREATE, data),
  },
};

// Optional: Generic invoke with validation
const safeInvoke = (channel: string, ...args: any[]) => {
  if (!isValidChannel(channel)) {
    throw new Error(`Invalid IPC channel: ${channel}`);
  }
  return ipcRenderer.invoke(channel, ...args);
};

contextBridge.exposeInMainWorld('electron', electronAPI);
```

**Benefits:**

- Only registered channels can be invoked
- Type safety in preload script
- Runtime validation available

---

### In Renderer (TypeScript)

```typescript
// src/renderer/pages/ProductsPage.tsx

// ✅ GOOD: Use typed API
const products = await window.electron.products.list();

// ❌ BAD: Direct channel access (not possible with our setup)
// await window.electron.invoke('product:list'); // Doesn't exist!
```

**Benefits:**

- Full TypeScript autocomplete
- Impossible to use unregistered channels
- Compile-time safety

---

## Adding New Channels

### Step 1: Add to Registry

```typescript
// src/shared/ipc/channels.ts
export const IPC_CHANNELS = {
  // ... existing channels

  // New channel
  INVENTORY_ADJUST: 'inventory:adjust',
} as const;
```

---

### Step 2: Add to Channel Group (Optional)

```typescript
export const CHANNEL_GROUPS = {
  // ... existing groups

  INVENTORY: [IPC_CHANNELS.INVENTORY_ADJUST],
} as const;
```

---

### Step 3: Use in Main Handler

```typescript
// src/main/ipc/handlers/inventory-handlers.ts
import { IPC_CHANNELS } from '@shared/ipc/channels';

IPCHandler.handle(IPC_CHANNELS.INVENTORY_ADJUST, async (request) => {
  // handler logic
});
```

---

### Step 4: Expose in Preload

```typescript
// src/preload/index.ts
const electronAPI = {
  // ... existing APIs

  inventory: {
    adjust: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_ADJUST, data),
  },
};
```

---

## Type Safety Guarantees

### 1. Compile-Time Checking

```typescript
// ✅ GOOD: TypeScript allows
IPCHandler.handle(IPC_CHANNELS.PRODUCT_LIST, ...);

// ❌ BAD: TypeScript error
IPCHandler.handle('random:channel', ...);
//                 ^^^^^^^^^^^^^^^^
// Argument of type '"random:channel"' is not assignable to parameter of type 'IPCChannel'
```

---

### 2. Autocomplete

When typing `IPC_CHANNELS.`, your IDE will show:

```
IPC_CHANNELS.
  ├─ PRODUCT_LIST
  ├─ PRODUCT_GET
  ├─ PRODUCT_CREATE
  ├─ SALE_CREATE
  └─ ... (all registered channels)
```

---

### 3. Refactoring Safety

**Scenario:** Rename `product:list` to `product:get-all`

**Before:**

```typescript
// Multiple files with string literals
ipcMain.handle('product:list', ...);
ipcRenderer.invoke('product:list');
// Easy to miss one!
```

**After (with registry):**

```typescript
// Change in ONE place
export const IPC_CHANNELS = {
  PRODUCT_LIST: 'product:get-all', // Changed here
} as const;

// All usages automatically updated
IPCHandler.handle(IPC_CHANNELS.PRODUCT_LIST, ...); // ✅
ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_LIST);     // ✅
```

---

## Validation Example

### Runtime Channel Validation

```typescript
// src/preload/index.ts
import { isValidChannel } from '@shared/ipc/channels';

// If you need a generic invoke (not recommended)
const safeInvoke = (channel: string, ...args: any[]) => {
  if (!isValidChannel(channel)) {
    console.error(`Attempted to invoke invalid channel: ${channel}`);
    throw new Error(`Invalid IPC channel: ${channel}`);
  }

  return ipcRenderer.invoke(channel, ...args);
};
```

**Use case:** Debugging, logging, or extra safety layer

---

## Best Practices

### ✅ DO

```typescript
// Import the registry
import { IPC_CHANNELS } from '@shared/ipc/channels';

// Use constants
ipcMain.handle(IPC_CHANNELS.PRODUCT_LIST, ...);
ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_GET, id);

// Add new channels to registry first
// Then use them everywhere
```

---

### ❌ DON'T

```typescript
// String literals
ipcMain.handle('product:list', ...); // NO!

// Dynamic channel names
const channel = `product:${action}`; // NO!
ipcRenderer.invoke(channel);

// Bypassing the registry
ipcRenderer.invoke('unregistered:channel'); // NO!
```

---

## Migration from Old Code

If you have existing code using `IPC_EVENTS` from `app-constants.ts`:

### Old Code

```typescript
// src/shared/constants/app-constants.ts
export const IPC_EVENTS = {
  PRODUCTS_GET_ALL: 'products:getAll',
};

// Usage
ipcMain.handle(IPC_EVENTS.PRODUCTS_GET_ALL, ...);
```

---

### New Code

```typescript
// src/shared/ipc/channels.ts
export const IPC_CHANNELS = {
  PRODUCT_LIST: 'product:list',
};

// Usage
ipcMain.handle(IPC_CHANNELS.PRODUCT_LIST, ...);
```

**Migration steps:**

1. Add channels to new registry
2. Update all imports
3. Update all usages
4. Remove old `IPC_EVENTS` from app-constants.ts

---

## Summary

**Registry provides:**

- ✅ Single source of truth
- ✅ TypeScript type safety
- ✅ Compile-time checking
- ✅ IDE autocomplete
- ✅ Refactoring safety
- ✅ Runtime validation (optional)
- ✅ Prevention of arbitrary channels

**File:** `src/shared/ipc/channels.ts`

**Import in:**

- Main process handlers
- Preload script
- (Indirectly) Renderer via typed API

---

**Last updated:** 2026-02-08  
**Version:** 1.0
