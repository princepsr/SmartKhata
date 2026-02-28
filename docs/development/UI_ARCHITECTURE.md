# UI Architecture (React)

## Overview

SmartKhata's frontend is built with **React 18** and **Vite**, following a modular and high-performance architecture optimized for local-first Electron environments.

---

## Technical Stack

- **Framework:** React 18 (Functional Components)
- **State Management:** React Hooks (useState, useMemo, useEffect)
- **Styling:** Vanilla CSS Modules / Global CSS
- **Communication:** Electron IPC (typed wrappers)
- **Routing:** React Router v6

---

## Core Principles

1. **Service-Driven UI:** Components never touch the database or file system directly. All data flows through IPC services.
2. **Deterministic Layout:** Using fixed sidebars and flexible content areas to ensure stability on various screen sizes.
3. **Optimistic Rendering:** Calculations (like billing math) are performed in the renderer for 0-latency feedback, then validated on the "Main" side during commit.
4. **Keyboard-First:** Every major action has a keyboard shortcut, and focus management is prioritized.

---

## Component Taxonomy

### 1. Page Components (`src/renderer/pages/`)

Stateful containers that represent full routes (e.g., `BillingPage`). They handle data fetching, IPC orchestration, and form state.

### 2. Functional Components (`src/renderer/components/`)

Reusable UI elements like `Layout`, `Navbar`, or project-specific components like `BulkImportModal`.

### 3. IPC Service Wrappers (`src/renderer/services/`)

Typed JavaScript classes that wrap the `window.electron.ipc` calls, providing a clean API for components.

---

## State & Data Flow

### IPC Integration Pattern

```mermaid
graph LR
    Component[React Component] --> Hook[Custom Hook]
    Hook --> Service[IPC Service Wrapper]
    Service --> Preload[Preload API]
    Preload --> Main[Electron Main Process]
```

### Example Usage:

```typescript
// src/renderer/services/product-service.ts
export class ProductService {
  static async getAll() {
    return await window.electron.ipc.invoke('products:getAll');
  }
}

// In Component:
const [products, setProducts] = useState([]);
useEffect(() => {
  ProductService.getAll().then(setProducts);
}, []);
```

---

## Math & Business Logic

To ensure instant feedback in UI (e.g., as a user types into a bill), we extract pure business logic into **Renderer Utilities**.

### Pattern: Pure Math Utilities

**File:** `src/renderer/utils/billing-math.ts`

This allows us to:

1. Show previews instantly without an IPC roundtrip.
2. Unit test complex logic (like GST or discounts) without a database or Electron environment.
3. Keep the UI logic clean and declarative.

---

## Styling Architecture

- **Global Tokens:** Defined in `src/renderer/index.css` via CSS Variables.
- **High-Contrast POS Theme:** Prioritizes readability (18px base font) and clear interactive states.
- **Vertical Filter Pattern:** Management pages use vertical sidebars for filters to maximize list/table space.

---

## Performance Optimizations

1. **Minimal Re-renders:** Extensive use of `useMemo` for heavy calculations (like billing subtotals).
2. **Native Electron Menus:** Disabled for maximum window space; replaced with custom in-app shortcuts.
3. **No External Dependencies:** Zero heavy UI libraries (like MUI or Tailwind) to keep the bundle small and the UI snappy.
