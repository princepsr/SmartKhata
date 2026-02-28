# IPC Client Wrapper

## Overview

The IPC client wrapper provides a standardized way to call Electron IPC methods from the renderer process with automatic loading states, error handling, and success notifications.

---

## Architecture

```
React Component
    ↓
useIPCCall() hook
    ↓
ipcCall() function
    ↓
UI Store (loading/error/success)
    ↓
window.electron.* (preload API)
    ↓
Main Process (IPC handlers)
```

---

## Implementation

**File:** `src/renderer/utils/ipc.ts`

### Core Function

```typescript
export async function ipcCall<T>(
  method: () => Promise<T>,
  options: IPCOptions = {}
): Promise<T>
```

**Parameters:**
- `method` - Function that calls window.electron API
- `options` - Configuration for loading/success/error states

**Returns:** Promise with the result

---

### Options

```typescript
interface IPCOptions {
  showLoading?: boolean;      // Show loading overlay
  showSuccess?: boolean;       // Show success toast
  successMessage?: string;     // Custom success message
  showError?: boolean;         // Show error toast
  errorMessage?: string;       // Custom error message
}
```

**Defaults:**
```typescript
{
  showLoading: true,
  showSuccess: false,
  showError: true,
}
```

---

## Usage

### Basic Usage

```typescript
import { useIPCCall } from '@renderer/utils/ipc';

function ProductList() {
  const callIPC = useIPCCall();

  const fetchProducts = async () => {
    const products = await callIPC(
      () => window.electron.products.getAll()
    );
    
    setProducts(products);
  };
}
```

**Result:**
- ✅ Loading overlay shown automatically
- ✅ Errors shown in toast notification
- ✅ Loading hidden when complete

---

### With Custom Options

```typescript
const handleSave = async () => {
  try {
    await callIPC(
      () => window.electron.products.create(newProduct),
      {
        showLoading: true,
        showSuccess: true,
        successMessage: 'Product created successfully!',
        showError: true,
        errorMessage: 'Failed to create product',
      }
    );
    
    // Success - refresh list
    fetchProducts();
  } catch (error) {
    // Error already shown to user
    // Component-specific handling here if needed
  }
};
```

---

### Without Loading State

```typescript
// For quick operations that don't need loading indicator
const checkStock = async (productId: number) => {
  const stock = await callIPC(
    () => window.electron.products.getById(productId),
    { showLoading: false }
  );
  
  return stock;
};
```

---

## Error Handling Strategy

### Three Levels of Error Handling

#### 1. IPC Wrapper (Automatic)

```typescript
// In ipc.ts
try {
  const result = await method();
  return result;
} catch (error) {
  if (opts.showError) {
    setError(getErrorMessage(error));
  }
  throw error;  // Re-throw for component handling
}
```

**Handles:**
- Extracting error message
- Showing error toast
- Logging (future)

---

#### 2. Component Level (Optional)

```typescript
try {
  await callIPC(() => window.electron.products.create(product));
  // Success handling
} catch (error) {
  // Component-specific error handling
  console.error('Failed to create product:', error);
  // Maybe show a modal, redirect, etc.
}
```

**Handles:**
- Component-specific logic
- Navigation after error
- Cleanup

---

#### 3. Global Error Boundary (Future)

```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    // Log to error reporting service
    // Show fallback UI
  }
}
```

**Handles:**
- Uncaught errors
- Crash recovery
- Error reporting

---

## UI State Integration

### UI Store

**File:** `src/renderer/store/useUIStore.ts`

```typescript
interface UIState {
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
}
```

**Actions:**
- `setLoading(boolean)` - Show/hide loading
- `setError(string)` - Show error toast
- `setSuccess(string)` - Show success toast
- `clearMessages()` - Clear all messages

---

### Global Messages Component

**File:** `src/renderer/components/GlobalMessages.tsx`

Displays:
- **Loading overlay** - Full-screen with spinner
- **Error toast** - Top-right, red, dismissible
- **Success toast** - Top-right, green, dismissible

**Rendered in Layout:**
```tsx
<Layout>
  <GlobalMessages />
  {/* ... rest of layout */}
</Layout>
```

---

## Complete Example

### ProductsPage Component

```typescript
import { useState, useEffect } from 'react';
import { useIPCCall } from '@renderer/utils/ipc';

function ProductsPage() {
  const [products, setProducts] = useState([]);
  const callIPC = useIPCCall();

  // Fetch products on mount
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const result = await callIPC(
        () => window.electron.products.getAll(),
        {
          showLoading: true,
          showError: true,
          errorMessage: 'Failed to load products',
        }
      );
      
      setProducts(result);
    } catch (error) {
      // Error already shown to user
    }
  };

  const handleAddProduct = async () => {
    try {
      await callIPC(
        () => window.electron.products.create({
          name: 'New Product',
          price: 100,
        }),
        {
          showLoading: true,
          showSuccess: true,
          successMessage: 'Product added!',
          showError: true,
        }
      );
      
      // Refresh list
      fetchProducts();
    } catch (error) {
      // Error already handled
    }
  };

  return (
    <div>
      <button onClick={handleAddProduct}>Add Product</button>
      
      {products.map(p => (
        <div key={p.id}>{p.name}</div>
      ))}
    </div>
  );
}
```

---

## Type Safety

### Typed IPC Calls

```typescript
// IPC wrapper is generic
async function ipcCall<T>(
  method: () => Promise<T>,
  options?: IPCOptions
): Promise<T>

// Usage with type inference
const products: Product[] = await callIPC(
  () => window.electron.products.getAll()
);
// TypeScript knows products is Product[]

const product: Product = await callIPC(
  () => window.electron.products.getById(1)
);
// TypeScript knows product is Product
```

**Benefits:**
- ✅ Type checking at compile time
- ✅ Autocomplete in IDE
- ✅ Catch errors early

---

## Error Message Extraction

```typescript
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}
```

**Handles:**
- Error objects
- String errors
- Unknown error types

---

## Best Practices

### ✅ DO

```typescript
// Use the wrapper for all IPC calls
const data = await callIPC(() => window.electron.products.getAll());

// Provide custom error messages
await callIPC(
  () => window.electron.products.delete(id),
  { errorMessage: 'Failed to delete product' }
);

// Show success for user actions
await callIPC(
  () => window.electron.settings.save(settings),
  { 
    showSuccess: true,
    successMessage: 'Settings saved!' 
  }
);

// Handle errors when needed
try {
  await callIPC(() => window.electron.products.create(product));
} catch (error) {
  // Component-specific handling
}
```

---

### ❌ DON'T

```typescript
// Don't call window.electron directly
const products = await window.electron.products.getAll();  // ❌

// Don't manage loading state manually
setLoading(true);
const products = await window.electron.products.getAll();
setLoading(false);  // ❌

// Don't ignore errors
await callIPC(() => window.electron.products.create(product));
// No try/catch, no error handling  // ❌

// Don't show loading for instant operations
await callIPC(
  () => window.electron.app.getVersion(),
  { showLoading: true }  // ❌ Too fast, loading flickers
);
```

---

## Future Enhancements

### 1. Request Cancellation

```typescript
const controller = new AbortController();

await callIPC(
  () => window.electron.products.getAll({ signal: controller.signal }),
  { showLoading: true }
);

// Cancel if component unmounts
controller.abort();
```

---

### 2. Retry Logic

```typescript
await callIPC(
  () => window.electron.products.getAll(),
  { 
    retry: 3,
    retryDelay: 1000,
  }
);
```

---

### 3. Caching

```typescript
await callIPC(
  () => window.electron.products.getAll(),
  { 
    cache: true,
    cacheKey: 'products',
    cacheDuration: 60000,  // 1 minute
  }
);
```

---

## Summary

| Feature | Implementation |
|---------|---------------|
| **Loading State** | Automatic via UI store |
| **Error Handling** | Toast notifications |
| **Success Messages** | Optional toast |
| **Type Safety** | Generic TypeScript |
| **Error Extraction** | Handles Error/string/unknown |
| **Integration** | GlobalMessages component |

**Key principle:** **Standardize IPC calls. Handle errors gracefully. Keep components clean.**

---

**Last updated:** 2026-02-08  
**Files:** `src/renderer/utils/ipc.ts`, `src/renderer/components/GlobalMessages.tsx`
