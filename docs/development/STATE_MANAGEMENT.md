# Zustand State Management

## Overview

SmartKhata uses Zustand for global state management. It's simple, lightweight, and doesn't require boilerplate like Redux.

---

## Installation

```bash
pnpm add zustand
```

---

## Store Structure

We use **separate stores** for different concerns (slices):

```
src/renderer/store/
├── index.ts                    # Re-exports all stores
├── useAppSettingsStore.ts      # App configuration & Theme
├── useCurrentBillStore.ts      # Active POS bill cart
├── useUpdateStore.ts           # OTA Updates & Network Connectivity
└── useUIStore.ts               # Global Loading/Error toasts
```

---

## Store 1: App Settings

**File:** `src/renderer/store/useAppSettingsStore.ts`

**Purpose:** Manage shop configuration and app settings.

### State

```typescript
interface AppSettings {
  shopName: string;
  shopAddress: string;
  taxRate: number;
  currency: string;
  receiptFooter: string;
}
```

### Actions

- `updateSettings(settings)` - Update one or more settings
- `resetSettings()` - Reset to defaults

### Usage

```typescript
import { useAppSettingsStore } from '@renderer/store';

function SettingsPage() {
  const { settings, updateSettings } = useAppSettingsStore();

  return (
    <input
      value={settings.shopName}
      onChange={(e) => updateSettings({ shopName: e.target.value })}
    />
  );
}
```

---

## Store 2: Current Bill

**File:** `src/renderer/store/useCurrentBillStore.ts`

**Purpose:** Manage the active POS bill/cart.

### State

```typescript
interface BillItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

interface CurrentBill {
  items: BillItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  customerId?: number;
}
```

### Actions

- `addItem(item)` - Add product to cart
- `removeItem(productId)` - Remove product from cart
- `updateQuantity(productId, quantity)` - Change quantity
- `setDiscount(discount)` - Apply discount
- `setCustomer(customerId)` - Link customer
- `clearBill()` - Clear cart after checkout
- `calculateTotals()` - Recalculate totals (called automatically)

### Usage

```typescript
import { useCurrentBillStore } from '@renderer/store';

function BillingPage() {
  const { bill, addItem, clearBill } = useCurrentBillStore();

  const handleAddProduct = () => {
    addItem({
      productId: 1,
      name: 'Product A',
      price: 100,
      quantity: 1,
    });
  };

  return (
    <div>
      <p>Total: ₹{bill.total}</p>
      <button onClick={handleAddProduct}>Add Item</button>
      <button onClick={clearBill}>Clear Cart</button>
    </div>
  );
}
```

---

## Store 3: UI State

**File:** `src/renderer/store/useUIStore.ts`

**Purpose:** Manage loading indicators and error/success messages.

### State

```typescript
interface UIState {
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
}
```

### Actions

- `setLoading(isLoading)` - Show/hide loading indicator
- `setError(error)` - Show error message
- `setSuccess(message)` - Show success message
- `clearMessages()` - Clear all messages

### Usage

```typescript
import { useUIStore } from '@renderer/store';

function ProductsPage() {
  const { isLoading, error, setLoading, setError } = useUIStore();

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const products = await window.electron.products.getAll();
      // Use products...
    } catch (err) {
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

---

## Store 4: OTA Updates & Connectivity

**File:** `src/renderer/store/useUpdateStore.ts`

**Purpose:** Manages the background Auto-Updater state machine and real-time offline/online internet connectivity tracking.

### State

```typescript
interface UpdateState {
  status: UpdateStatus; // IDLE, CHECKING, UPDATE_AVAILABLE, DOWNLOADING, DOWNLOADED, ERROR
  updateInfo: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: string | null;
  isOnline: boolean; // True if internet is active
  showDismissedBanner: boolean;
}
```

### Actions (Bridge to Main Process)

- `checkConnectivity()` - Pings main process for DNS resolution Check.
- `checkForUpdates()` - Triggers github release lookup.
- `downloadUpdate()` - Initiates the binary package download.
- `installUpdate()` - Triggers electron app restart and update installation.

### Usage

```typescript
import { useUpdateStore } from '@renderer/store';

function SettingsPage() {
  const { status, progress, checkForUpdates } = useUpdateStore();

  return (
    <div>
      <button onClick={checkForUpdates} disabled={status === 'CHECKING'}>
        Check for Updates
      </button>
      {status === 'DOWNLOADING' && <p>Downloading: {progress.percent}%</p>}
    </div>
  );
}
```

---

## Zustand Basics

### Creating a Store

```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface CounterState {
  count: number;
  increment: () => void;
  decrement: () => void;
}

export const useCounterStore = create<CounterState>()(
  devtools(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
    }),
    { name: 'Counter' } // DevTools name
  )
);
```

---

### Using a Store

```typescript
import { useCounterStore } from './store';

function Counter() {
  // Subscribe to entire store
  const { count, increment } = useCounterStore();

  // Or subscribe to specific values (better performance)
  const count = useCounterStore((state) => state.count);
  const increment = useCounterStore((state) => state.increment);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>+</button>
    </div>
  );
}
```

---

### Accessing Store Outside Components

```typescript
import { useCounterStore } from './store';

// Get current state
const count = useCounterStore.getState().count;

// Call actions
useCounterStore.getState().increment();

// Subscribe to changes
const unsubscribe = useCounterStore.subscribe((state) => {
  console.log('Count changed:', state.count);
});

// Unsubscribe when done
unsubscribe();
```

---

## DevTools Integration

Zustand integrates with Redux DevTools for debugging.

**Setup:**

```typescript
import { devtools } from 'zustand/middleware';

export const useStore = create<State>()(
  devtools(
    (set) => ({
      // ... state and actions
    }),
    { name: 'StoreName' } // Shows in DevTools
  )
);
```

**Usage:**

1. Install Redux DevTools extension in Chrome
2. Open DevTools (F12)
3. Go to Redux tab
4. See all state changes in real-time

---

## Best Practices

### ✅ DO

```typescript
// Separate stores by concern
useAppSettingsStore();
useCurrentBillStore();
useUIStore();

// Use TypeScript interfaces
interface State {
  count: number;
}

// Subscribe to specific values
const count = useStore((state) => state.count);

// Use devtools middleware
devtools((set) => ({ ... }), { name: 'MyStore' });

// Keep actions simple
increment: () => set((state) => ({ count: state.count + 1 }))
```

### ❌ DON'T

```typescript
// Don't create one giant store
const useStore = create(() => ({
  settings: {},
  bill: {},
  ui: {},
  products: {},
  // ... too much!
}));

// Don't mutate state directly
set((state) => {
  state.count++;  // ❌ Mutation
  return state;
});

// Don't subscribe to entire store unnecessarily
const store = useStore();  // ❌ Re-renders on any change

// Don't put derived state in store
total: state.items.reduce(...)  // ❌ Calculate in component instead
```

---

## Persistence (Future)

To persist state to localStorage:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }),
    {
      name: 'counter-storage', // localStorage key
    }
  )
);
```

---

## Async Actions

```typescript
interface ProductsState {
  products: Product[];
  fetchProducts: () => Promise<void>;
}

export const useProductsStore = create<ProductsState>()(
  devtools((set) => ({
    products: [],

    fetchProducts: async () => {
      const products = await window.electron.products.getAll();
      set({ products });
    },
  }))
);

// Usage
function ProductList() {
  const { products, fetchProducts } = useProductsStore();

  useEffect(() => {
    fetchProducts();
  }, []);

  return <ul>{products.map(p => <li>{p.name}</li>)}</ul>;
}
```

---

## Computed Values

Don't store computed values in state. Calculate them in components:

```typescript
// ❌ Bad: Storing computed value
interface State {
  items: Item[];
  total: number;  // Computed from items
}

// ✅ Good: Calculate in component
function Cart() {
  const items = useCartStore((state) => state.items);
  const total = items.reduce((sum, item) => sum + item.price, 0);

  return <p>Total: {total}</p>;
}

// ✅ Or use useMemo for expensive calculations
const total = useMemo(
  () => items.reduce((sum, item) => sum + item.price, 0),
  [items]
);
```

---

## Testing Stores

```typescript
import { renderHook, act } from '@testing-library/react';
import { useCounterStore } from './useCounterStore';

test('increments count', () => {
  const { result } = renderHook(() => useCounterStore());

  expect(result.current.count).toBe(0);

  act(() => {
    result.current.increment();
  });

  expect(result.current.count).toBe(1);
});
```

---

## Summary

| Store           | Purpose                | Key Actions                        |
| --------------- | ---------------------- | ---------------------------------- |
| **AppSettings** | Shop config            | updateSettings, resetSettings      |
| **CurrentBill** | POS cart               | addItem, removeItem, clearBill     |
| **UI**          | Loading/errors         | setLoading, setError, setSuccess   |
| **Update**      | Network & Auto-Updates | checkForUpdates, checkConnectivity |

**Key principles:**

- Separate stores by concern
- Keep actions simple
- Use TypeScript
- Enable DevTools
- Don't store computed values

---

**Last updated:** 2026-02-08  
**Files:** `src/renderer/store/`
