# UI Patterns & Performance

SmartKhata POS is designed for "Instant Response" even on low-spec hardware. This document outlines the recurring UI patterns used to maintain high performance.

---

## ⚡ High-Density Data Handling

To handle thousands of products or customers without lag, management pages use a 3-tier performance strategy:

### 1. Debounced Search

Search inputs wait for **300ms** of user silence before triggering an IPC request. This prevents "search-storms" that can overwhelm the SQLite database during rapid typing.

### 2. Server-side Pagination

Lists are never fetched in their entirety. Instead, the backend returns data in chunks (default: **100 items per page**).

- **Request**: `{ query: '...', page: 2, pageSize: 100 }`
- **Response**: `{ items: [...], hasMore: true, totalCount: 1250 }`

### 3. Infinite Scrolling

Management tables use the **Intersection Observer API** to detect when the user reaches the bottom of the list, triggering an automatic fetch of the next "page" without a full reload.

---

## 🎣 The `useIPC` Hook

A custom React hook (`src/renderer/hooks/useIPC.ts`) is used for all data fetching. It provides:

- **Loading States**: Native skeleton loaders during fetches.
- **Error Handling**: Graceful error updates without crashing the page.
- **Execution Lifecycle**: Clean cancellation of pending requests on component unmount.

---

## 🛡️ Global UI Resilience

### Error Boundaries

The entire application is wrapped in a **React Error Boundary**. If a component fails to render (e.g., due to a null reference):

1.  The specific page crashes, but the **Sidebar remains active**.
2.  The user sees a "Something went wrong" message with a **Restore** button.
3.  The crash is logged to the system logs for developer debugging.

### Contextual Dispatching (Command Center)

To jump straight to an action (like "Add Product"), the Command Center passes flags via URL parameters (e.g., `/products?action=add`).

- This allows for deep-linking between different modules of the application.

---

**Last updated:** 2026-02-23  
**Key Files:** `src/renderer/pages/ProductsPage.tsx`, `src/renderer/hooks/useIPC.ts`, `src/renderer/components/ErrorBoundary.tsx`
