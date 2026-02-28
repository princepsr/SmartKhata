# React Router Setup

## Overview

SmartKhata uses React Router for client-side routing. All navigation happens without page reloads, providing a smooth desktop app experience.

---

## Router Configuration

**File:** `src/renderer/Router.tsx`

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
// ... Page Imports ...
import { useAppSettingsStore } from './store/useAppSettingsStore';

function AppRouter() {
  const { settings, fetchSettings, isLoading } = useAppSettingsStore();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    fetchSettings().finally(() => setIsInitialized(true));
  }, [fetchSettings]);

  if (!isInitialized) return <LoadingScreen message="Initializing SmartKhata..." />;

  return (
    <ErrorBoundary>
      <BrowserRouter>
        {isLoading && <LoadingScreen message="Saving changes..." />}
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route
            path="/"
            element={settings.privacyPolicyAccepted ? <Layout /> : <Navigate to="/onboarding" replace />}
          >
            <Route index element={<Navigate to="/billing" replace />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="purchases" element={<PurchasesPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="quotations" element={<QuotationsPage />} />
            <Route path="barcode-gen" element={<BarcodeGenPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/billing" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
```

---

| Route          | Component        | Shortcut | Purpose                                    |
| -------------- | ---------------- | -------- | ------------------------------------------ |
| `/`            | → `/billing`     | -        | Default redirect                           |
| `/onboarding`  | `OnboardingPage` | -        | First-time business setup & privacy policy |
| `/billing`     | `BillingPage`    | `F2`     | Core POS billing interface                 |
| `/products`    | `ProductsPage`   | `F3`     | Inventory and product management           |
| `/customers`   | `CustomersPage`  | `F4`     | Customer ledgers & profiles                |
| `/reports`     | `ReportsPage`    | `F5`     | Analytics, GST, and P&L statements         |
| `/purchases`   | `PurchasesPage`  | `F7`     | Supplier POs & Purchase Inward             |
| `/expenses`    | `ExpensesPage`   | `F8`     | Store operating expenses                   |
| `/quotations`  | `QuotationsPage` | `F9`     | Draft estimates & proforma invoices        |
| `/barcode-gen` | `BarcodeGenPage` | `F10`    | Sticker/label printing                     |
| `/settings`    | `SettingsPage`   | `F6`     | Global app configuration                   |
| `*`            | → `/billing`     | -        | 404 fallback                               |

## Routing Strategy

### BrowserRouter vs HashRouter

**We use `BrowserRouter`:**

```typescript
<BrowserRouter>
  {/* routes */}
</BrowserRouter>
```

**Why not `HashRouter`?**

| Aspect   | BrowserRouter | HashRouter   |
| -------- | ------------- | ------------ |
| URLs     | `/billing`    | `/#/billing` |
| Electron | ✅ Works      | ✅ Works     |
| Cleaner  | ✅ Yes        | ❌ No        |
| Dev/Prod | ✅ Same       | ✅ Same      |

**Both work in Electron**, but `BrowserRouter` provides cleaner URLs.

---

## Layout Component

**File:** `src/renderer/components/Layout.tsx`

The Layout component wraps all routes and provides:

- Sidebar navigation
- Keyboard shortcuts
- Consistent structure

```typescript
function Layout() {
  return (
    <div className="layout">
      <aside className="layout-sidebar">
        {/* Navigation */}
      </aside>

      <main className="layout-main">
        <Outlet />  {/* Child routes render here */}
      </main>
    </div>
  );
}
```

**`<Outlet />`** is where child routes render.

---

## Navigation

### NavLink Component

```typescript
<NavLink to="/billing" className="nav-item">
  <span className="nav-icon">💳</span>
  <span className="nav-label">Billing</span>
  <kbd className="nav-shortcut">F2</kbd>
</NavLink>
```

**Features:**

- Automatically adds `.active` class when route matches
- Keyboard accessible
- Shows keyboard shortcuts

**Active styling:**

```css
.nav-item.active {
  background-color: rgba(255, 255, 255, 0.2);
  border-left: 4px solid white;
}
```

---

## Keyboard Shortcuts

### Implementation

**Step 1: Add global keyboard listener**

Create `src/renderer/hooks/useKeyboardShortcuts.ts`:

```typescript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // F2 - Billing
      if (e.key === 'F2') {
        e.preventDefault();
        navigate('/billing');
      }

      // F3 - Products
      if (e.key === 'F3') {
        e.preventDefault();
        navigate('/products');
      }

      // F4 - Customers
      if (e.key === 'F4') {
        e.preventDefault();
        navigate('/customers');
      }

      // F5 - Reports
      if (e.key === 'F5') {
        e.preventDefault();
        navigate('/reports');
      }

      // F6 - Settings
      if (e.key === 'F6') {
        e.preventDefault();
        navigate('/settings');
      }

      // F7 - Purchases
      if (e.key === 'F7') {
        e.preventDefault();
        navigate('/purchases');
      }

      // F8 - Expenses
      if (e.key === 'F8') {
        e.preventDefault();
        navigate('/expenses');
      }

      // F9 - Quotations
      if (e.key === 'F9') {
        e.preventDefault();
        navigate('/quotations');
      }

      // F10 - Barcode Generator
      if (e.key === 'F10') {
        e.preventDefault();
        navigate('/barcode-gen');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
}
```

**Step 2: Use in Layout**

```typescript
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

function Layout() {
  useKeyboardShortcuts();  // Enable shortcuts

  return (
    // ... layout JSX
  );
}
```

---

## Programmatic Navigation

### Using `useNavigate` Hook

```typescript
import { useNavigate } from 'react-router-dom';

function SomeComponent() {
  const navigate = useNavigate();

  function handleClick() {
    navigate('/billing');
  }

  return <button onClick={handleClick}>Go to Billing</button>;
}
```

### With State

```typescript
navigate('/products', { state: { productId: 123 } });

// In ProductsPage:
const location = useLocation();
const productId = location.state?.productId;
```

---

## Dev vs Prod Behavior

### Development

**Vite dev server:**

```
http://localhost:5173/
http://localhost:5173/billing
http://localhost:5173/products
```

**Electron loads:**

```typescript
mainWindow.loadURL('http://localhost:5173');
```

**Navigation:**

- Click link → URL changes → React Router updates view
- No page reload
- HMR works

---

### Production

**Built files:**

```
dist/renderer/index.html
```

**Electron loads:**

```typescript
mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
```

**URL in browser:**

```
file:///C:/path/to/dist/renderer/index.html
```

**Navigation:**

- Click link → URL changes (in memory)
- React Router updates view
- No page reload
- **No actual URL change in address bar** (file:// protocol limitation)

**This is normal and expected for Electron apps!**

---

## Startup & Initialization

### 1. Initialization Phase

Upon application start, the Router remains in an uninitialized state until `isInitialized` is true. During this time, the **Premium Loading Screen** is displayed.

### 2. Mandatory Onboarding

If `privacyPolicyAccepted` is false in the app settings, the user is restricted to the `/onboarding` route. This ensures legal compliance before any POS operations can begin.

### 3. Background Persistence

Once initialized, the Main Layout remains mounted. Background actions (like saving settings) use the `LoadingScreen` as an overlay rather than unmounting the application tree, ensuring a smooth user experience.

---

## Folder Structure

```
src/renderer/
├── Router.tsx              # Route definitions
├── components/
│   ├── Layout.tsx          # Main layout wrapper
│   └── Layout.css
├── pages/
│   ├── BillingPage.tsx     # /billing
│   ├── ProductsPage.tsx    # /products
│   ├── CustomersPage.tsx   # /customers
│   ├── ReportsPage.tsx     # /reports
│   ├── PurchasesPage.tsx   # /purchases
│   ├── ExpensesPage.tsx    # /expenses
│   ├── QuotationsPage.tsx  # /quotations
│   ├── BarcodeGenPage.tsx  # /barcode-gen
│   └── SettingsPage.tsx    # /settings
└── hooks/
    └── useKeyboardShortcuts.ts  # Keyboard navigation
```

---

## Best Practices

### ✅ DO

```typescript
// Use NavLink for navigation
<NavLink to="/billing">Billing</NavLink>

// Use useNavigate for programmatic navigation
const navigate = useNavigate();
navigate('/products');

// Use relative paths
<Route path="billing" element={<BillingPage />} />

// Provide keyboard shortcuts
useKeyboardShortcuts();
```

### ❌ DON'T

```typescript
// Don't use <a> tags
<a href="/billing">Billing</a>  // ❌ Causes page reload

// Don't use window.location
window.location.href = '/billing';  // ❌ Reloads app

// Don't use absolute paths in routes
<Route path="/billing" element={<BillingPage />} />  // ❌ Use relative

// Don't forget keyboard navigation
// ❌ Mouse-only navigation is slow for POS
```

---

## Troubleshooting

### Issue 1: Routes not working in production

**Symptom:** Blank page or 404 in built app

**Cause:** Missing `base: './'` in vite.config.ts

**Fix:** Already configured in `vite.config.ts`

---

### Issue 2: Active link not highlighting

**Symptom:** `.active` class not applied

**Cause:** Using `<Link>` instead of `<NavLink>`

**Fix:**

```typescript
// ❌ Wrong
<Link to="/billing">Billing</Link>

// ✅ Correct
<NavLink to="/billing">Billing</NavLink>
```

---

### Issue 3: Keyboard shortcuts not working

**Symptom:** F2-F6 don't navigate

**Cause:** Hook not called

**Fix:** Call `useKeyboardShortcuts()` in Layout component

---

## Summary

| Aspect         | Implementation            |
| -------------- | ------------------------- |
| **Router**     | BrowserRouter             |
| **Routes**     | 5 main routes + redirects |
| **Navigation** | NavLink components        |
| **Shortcuts**  | F2-F6 for pages           |
| **Layout**     | Sidebar + Outlet          |
| **Dev/Prod**   | Works in both             |

**Key principle:** Client-side routing, no page reloads, keyboard-first navigation

---

**Last updated:** 2026-02-08  
**Files:** `src/renderer/Router.tsx`, `src/renderer/components/Layout.tsx`
