# Renderer IPC Client Wrapper

## Overview

The IPC Client Wrapper provides a reusable, type-safe way to make IPC calls from React components with automatic loading states, error handling, and timeout management.

---

## Components

### 1. IPC Client (`src/renderer/utils/ipc.ts`)

Low-level client for making IPC calls:

```typescript
import { ipcClient } from '@renderer/utils/ipc';

// Simple call
const result = await ipcClient.call('product:list');

// With payload
const result = await ipcClient.call('product:create', {
  name: "Product",
  price: 100
});

// With options
const result = await ipcClient.call('product:get', 123, {
  timeout: 5000,
  errorMessage: 'Failed to load product'
});
```

---

### 2. React Hooks (`src/renderer/hooks/useIPC.ts`)

High-level hooks for React components:

```typescript
import { useIPC, useIPCMutation } from '@renderer/hooks/useIPC';

// For queries (GET operations)
const { data, loading, error, execute } = useIPC('product:list');

// For mutations (CREATE/UPDATE/DELETE operations)
const { loading, error, execute } = useIPCMutation('product:create');
```

---

## Features

### ✅ Automatic Loading State

```typescript
const { data, loading, error, execute } = useIPC('product:list');

if (loading) return <div>Loading...</div>;
```

---

### ✅ Error Handling

```typescript
const result = await ipcClient.call('product:get', 123);

if (!result.success) {
  console.error(result.error); // User-friendly error message
}
```

---

### ✅ Timeout Handling

```typescript
const result = await ipcClient.call('product:list', undefined, {
  timeout: 5000 // 5 seconds
});

// If timeout exceeded:
// result.error = "IPC call timed out after 5000ms"
```

---

### ✅ Type Safety

```typescript
interface Product {
  id: number;
  name: string;
  price: number;
}

const { data } = useIPC<Product[]>('product:list');
// data is typed as Product[] | null
```

---

### ✅ UI-Friendly Error Messages

```typescript
const result = await ipcClient.call('product:create', data, {
  errorMessage: 'Failed to create product. Please try again.'
});

// Custom error message shown instead of technical error
```

---

## Usage Patterns

### Pattern 1: Query Data (useIPC)

**Use for:** Fetching data (GET operations)

```typescript
function ProductList() {
  const { data, loading, error, execute } = useIPC<Product[]>('product:list');

  useEffect(() => {
    execute();
  }, []);

  if (loading) return <div>Loading products...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!data) return null;

  return (
    <ul>
      {data.map(product => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  );
}
```

---

### Pattern 2: Mutation (useIPCMutation)

**Use for:** Creating/updating/deleting data

```typescript
function CreateProduct() {
  const { loading, error, execute } = useIPCMutation<CreateProductRequest, Product>(
    'product:create'
  );
  
  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    stock: 0
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await execute(formData);
    
    if (result) {
      // Success!
      alert('Product created!');
      setFormData({ name: '', price: 0, stock: 0 });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      
      <input
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
      
      <button disabled={loading}>
        {loading ? 'Creating...' : 'Create Product'}
      </button>
    </form>
  );
}
```

---

### Pattern 3: Direct Client (Advanced)

**Use for:** Custom logic, multiple calls, or non-React code

```typescript
async function loadDashboardData() {
  // Parallel calls
  const [productsResult, salesResult] = await Promise.all([
    ipcClient.call('product:list'),
    ipcClient.call('sale:list'),
  ]);

  if (!productsResult.success || !salesResult.success) {
    throw new Error('Failed to load dashboard data');
  }

  return {
    products: productsResult.data,
    sales: salesResult.data,
  };
}
```

---

## Error Handling Strategy

### Level 1: IPC Client (Automatic)

**Handles:**
- Network errors
- Timeouts
- IPC failures

**Returns:**
```typescript
{
  success: false,
  data: null,
  error: "IPC call timed out after 30000ms"
}
```

---

### Level 2: Main Process (Validation)

**Handles:**
- Input validation errors
- Business logic errors
- Database errors

**Returns:**
```typescript
{
  success: false,
  error: "Product name is required"
}
```

---

### Level 3: React Component (UI)

**Handles:**
- Displaying errors to user
- Retry logic
- Fallback UI

```typescript
if (error) {
  return (
    <div className="error-container">
      <p>{error}</p>
      <button onClick={() => execute()}>Retry</button>
    </div>
  );
}
```

---

## API Reference

### ipcClient.call()

```typescript
ipcClient.call<T>(
  channel: IPCChannel,
  payload?: unknown,
  options?: IPCCallOptions
): Promise<IPCCallResult<T>>
```

**Options:**
- `timeout` - Timeout in ms (default: 30000)
- `errorMessage` - Custom error message
- `throwOnError` - Throw instead of returning error (default: false)
- `log` - Enable logging (default: true in dev)

**Returns:**
```typescript
{
  data: T | null,
  error: string | null,
  success: boolean
}
```

---

### ipcClient.callOrThrow()

```typescript
ipcClient.callOrThrow<T>(
  channel: IPCChannel,
  payload?: unknown,
  options?: Omit<IPCCallOptions, 'throwOnError'>
): Promise<T>
```

**Throws:** Error if call fails

**Use with try/catch:**
```typescript
try {
  const data = await ipcClient.callOrThrow('product:list');
  console.log(data);
} catch (error) {
  console.error(error);
}
```

---

### useIPC()

```typescript
useIPC<T>(
  channel: IPCChannel,
  options?: IPCCallOptions
): UseIPCState<T>
```

**Returns:**
```typescript
{
  data: T | null,
  loading: boolean,
  error: string | null,
  execute: (payload?: unknown) => Promise<void>,
  reset: () => void
}
```

---

### useIPCMutation()

```typescript
useIPCMutation<TRequest, TResponse>(
  channel: IPCChannel,
  options?: IPCCallOptions
)
```

**Returns:**
```typescript
{
  loading: boolean,
  error: string | null,
  execute: (payload: TRequest) => Promise<TResponse | null>,
  reset: () => void
}
```

---

## Best Practices

### ✅ DO

```typescript
// Use hooks for React components
const { data, loading, error, execute } = useIPC('product:list');

// Handle loading state
if (loading) return <Spinner />;

// Handle error state
if (error) return <ErrorMessage message={error} />;

// Provide custom error messages
const result = await ipcClient.call('product:create', data, {
  errorMessage: 'Failed to create product. Please check your input.'
});

// Use type parameters
const { data } = useIPC<Product[]>('product:list');
```

---

### ❌ DON'T

```typescript
// Don't call window.api.invoke directly
await window.api.invoke('product:list'); // NO!

// Don't ignore loading state
const { data } = useIPC('product:list');
return <div>{data.map(...)}</div>; // NO! data might be null

// Don't ignore errors
const { data } = useIPC('product:list');
// No error handling! // NO!

// Don't use generic types
const { data } = useIPC('product:list'); // data is unknown
```

---

## Summary

**IPC Client provides:**
- ✅ Automatic loading state management
- ✅ Error handling with user-friendly messages
- ✅ Timeout handling (default: 30s)
- ✅ Type safety with TypeScript
- ✅ React hooks for easy integration
- ✅ Logging in development mode

**No React component should call `window.api.invoke` directly** - always use `ipcClient` or hooks.

---

**Files:**
- `src/renderer/utils/ipc.ts` - IPC client
- `src/renderer/hooks/useIPC.ts` - React hooks
- `src/renderer/examples/ipc-client-usage.example.tsx` - Examples

---

**Last updated:** 2026-02-08  
**Version:** 1.0
