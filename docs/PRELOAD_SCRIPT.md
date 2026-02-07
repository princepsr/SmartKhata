# Preload Script Guide

## Overview

The preload script (`src/preload/index.ts`) is a secure bridge between the Electron main process and the React renderer. It uses `contextBridge` to expose a controlled API to the renderer without giving it direct access to Node.js.

---

## Architecture

```
┌─────────────────────────────────────────┐
│  Renderer Process (React)              │
│  - No Node.js access                    │
│  - Uses: window.electron.products.*    │
│  - Type-safe via TypeScript            │
└─────────────┬───────────────────────────┘
              │
              │ window.electron (exposed via contextBridge)
              │
┌─────────────▼───────────────────────────┐
│  Preload Script                         │
│  - Has Node.js access                   │
│  - Validates IPC channels               │
│  - Exposes controlled API               │
└─────────────┬───────────────────────────┘
              │
              │ ipcRenderer.invoke()
              │
┌─────────────▼───────────────────────────┐
│  Main Process                           │
│  - IPC handlers (ipcMain.handle)        │
│  - Business logic                       │
│  - Database access                      │
└─────────────────────────────────────────┘
```

---

## Preload Script Implementation

### Complete Code

```typescript
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_EVENTS } from '@shared/constants/app-constants';

const electronAPI = {
  // Generic IPC invoke (with channel validation)
  invoke: (channel: string, ...args: any[]) => {
    const validChannels = Object.values(IPC_EVENTS);
    if (!validChannels.includes(channel)) {
      throw new Error(`Invalid IPC channel: ${channel}`);
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  // Organized API methods
  products: {
    getAll: () => ipcRenderer.invoke(IPC_EVENTS.PRODUCTS_GET_ALL),
    getById: (id: number) => ipcRenderer.invoke(IPC_EVENTS.PRODUCTS_GET_BY_ID, id),
    // ... more methods
  },
  
  // ... sales, customers, print, app APIs
};

// Expose to renderer
contextBridge.exposeInMainWorld('electron', electronAPI);
```

---

## Key Responsibilities

### 1. **Secure API Exposure**

**What it does:**
- Exposes `window.electron` to renderer
- Renderer can ONLY access what's explicitly exposed
- No direct Node.js or Electron access

**Example:**
```typescript
// ✅ Renderer can do:
const products = await window.electron.products.getAll();

// ❌ Renderer CANNOT do:
const fs = require('fs');  // Error: require is not defined
```

---

### 2. **Channel Validation**

**What it does:**
- Validates IPC channel names before invoking
- Prevents arbitrary IPC calls

**Example:**
```typescript
invoke: (channel: string, ...args: any[]) => {
  const validChannels = Object.values(IPC_EVENTS);
  
  if (!validChannels.includes(channel)) {
    throw new Error(`Invalid IPC channel: ${channel}`);
  }
  
  return ipcRenderer.invoke(channel, ...args);
}
```

**Why it matters:**
```typescript
// ❌ Without validation:
window.electron.invoke('malicious:channel', 'rm -rf /');  // Dangerous!

// ✅ With validation:
window.electron.invoke('malicious:channel', ...);  // Error: Invalid IPC channel
```

---

### 3. **Type-Safe API**

**What it does:**
- Provides TypeScript types for `window.electron`
- Enables autocomplete and type checking in renderer

**Example:**
```typescript
// src/preload/types.ts
export interface ElectronAPI {
  products: {
    getAll: () => Promise<Product[]>;
    getById: (id: number) => Promise<Product | null>;
    // ...
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
```

**Usage in renderer:**
```typescript
// ✅ Type-safe
const products = await window.electron.products.getAll();
//    ^? Product[]

// ❌ TypeScript error
const product = await window.electron.products.getById('invalid');
//                                                      ^^^^^^^^^ 
// Error: Argument of type 'string' is not assignable to type 'number'
```

---

## API Organization

### Generic Invoke (Flexible)

```typescript
invoke: (channel: string, ...args: any[]) => Promise<any>
```

**Use case:** Dynamic IPC calls, future extensibility

**Example:**
```typescript
const result = await window.electron.invoke('products:getAll');
```

---

### Organized Methods (Recommended)

```typescript
products: {
  getAll: () => Promise<Product[]>,
  getById: (id: number) => Promise<Product | null>,
  create: (product: CreateProductDTO) => Promise<Product>,
  // ...
}
```

**Use case:** Type-safe, organized, autocomplete-friendly

**Example:**
```typescript
const products = await window.electron.products.getAll();
const product = await window.electron.products.getById(123);
```

---

## Type Definitions

### File: `src/preload/types.ts`

**Purpose:**
- Define TypeScript types for `window.electron`
- Extend `Window` interface
- Provide domain types (Product, Sale, etc.)

**Structure:**
```typescript
// 1. ElectronAPI interface
export interface ElectronAPI {
  products: { ... },
  sales: { ... },
  // ...
}

// 2. Extend Window
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

// 3. Domain types
export interface Product { ... }
export interface Sale { ... }
```

**Usage in renderer:**
```typescript
// Import types
import type { Product } from '@preload/types';

// Use with autocomplete
const products: Product[] = await window.electron.products.getAll();
```

---

## Security Features

### 1. **No Direct ipcRenderer Exposure**

```typescript
// ❌ NEVER do this (dangerous!)
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: ipcRenderer,  // Exposes everything!
});

// ✅ Do this (controlled)
contextBridge.exposeInMainWorld('electron', {
  products: {
    getAll: () => ipcRenderer.invoke('products:getAll'),
  },
});
```

---

### 2. **Channel Whitelist**

```typescript
const validChannels = Object.values(IPC_EVENTS);

if (!validChannels.includes(channel)) {
  throw new Error(`Invalid IPC channel: ${channel}`);
}
```

**Why it matters:**
- Prevents arbitrary IPC calls
- Centralized channel management
- Easy to audit

---

### 3. **No Node.js APIs Exposed**

```typescript
// ❌ NEVER expose Node.js APIs
contextBridge.exposeInMainWorld('electron', {
  fs: require('fs'),          // DANGEROUS!
  child_process: require('child_process'),  // DANGEROUS!
});

// ✅ Only expose controlled IPC
contextBridge.exposeInMainWorld('electron', {
  products: { ... },  // Safe, controlled
});
```

---

## Usage in Renderer

### React Component Example

```typescript
import { useEffect, useState } from 'react';
import type { Product } from '@preload/types';

function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    // ✅ Type-safe IPC call
    window.electron.products.getAll()
      .then(setProducts)
      .catch(console.error);
  }, []);

  return (
    <ul>
      {products.map(p => (
        <li key={p.id}>{p.name} - ₹{p.price}</li>
      ))}
    </ul>
  );
}
```

---

### Custom Hook Example

```typescript
// src/renderer/hooks/useProducts.ts
import { useEffect, useState } from 'react';
import type { Product } from '@preload/types';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.electron.products.getAll()
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  const createProduct = async (product: CreateProductDTO) => {
    const newProduct = await window.electron.products.create(product);
    setProducts([...products, newProduct]);
  };

  return { products, loading, createProduct };
}
```

---

## IPC Flow Example

### Complete Flow: Get All Products

```
1. Renderer (React)
   ↓
   window.electron.products.getAll()

2. Preload Script
   ↓
   ipcRenderer.invoke('products:getAll')

3. Main Process (IPC Handler)
   ↓
   ipcMain.handle('products:getAll', async () => {
     return productService.getAll();
   })

4. Service Layer
   ↓
   productService.getAll()

5. Repository Layer
   ↓
   productRepository.findAll()

6. SQLite Database
   ↓
   SELECT * FROM products

7. Response flows back up the chain
   ↓
   Renderer receives Product[]
```

---

## Best Practices

### ✅ DO

```typescript
// Use organized API methods
window.electron.products.getAll();

// Validate channels
if (!validChannels.includes(channel)) {
  throw new Error('Invalid channel');
}

// Provide TypeScript types
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
```

### ❌ DON'T

```typescript
// Don't expose raw ipcRenderer
ipcRenderer: ipcRenderer,  // ❌

// Don't expose Node.js APIs
fs: require('fs'),  // ❌

// Don't skip channel validation
ipcRenderer.invoke(channel, ...args);  // ❌ No validation
```

---

## Troubleshooting

### `window.electron is undefined`

**Cause:** Preload script not loaded

**Fix:**
```typescript
// Check BrowserWindow config
webPreferences: {
  preload: path.join(__dirname, '../preload/index.js'),  // ✅
}
```

---

### TypeScript errors in renderer

**Cause:** Type definitions not imported

**Fix:**
```typescript
// Add to tsconfig.renderer.json
"include": [
  "src/renderer/**/*",
  "src/preload/types.ts"  // ✅ Include preload types
]
```

---

### IPC call fails silently

**Cause:** Channel name mismatch

**Fix:**
```typescript
// Use constants
import { IPC_EVENTS } from '@shared/constants/app-constants';

// ✅ Correct
ipcRenderer.invoke(IPC_EVENTS.PRODUCTS_GET_ALL);

// ❌ Wrong (typo)
ipcRenderer.invoke('product:getAll');  // Missing 's'
```

---

## Summary

| Aspect | Implementation |
|--------|---------------|
| **Exposure** | `contextBridge.exposeInMainWorld()` |
| **Security** | Channel validation, no Node.js APIs |
| **Type Safety** | TypeScript interfaces, `Window` extension |
| **Organization** | Grouped by domain (products, sales, etc.) |
| **Validation** | Whitelist of allowed IPC channels |

**Status:** ✅ Production-ready secure IPC bridge

---

**Last updated:** 2026-02-08  
**Files:** `src/preload/index.ts`, `src/preload/types.ts`
