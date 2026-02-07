# React Renderer Setup

## Overview

SmartKhata's renderer is a React + TypeScript + Vite application optimized for POS use. It runs in the Electron renderer process with no Node.js access, communicating with the main process via IPC.

---

## Folder Structure

```
src/renderer/
├── index.html          # HTML entry point
├── index.tsx           # React entry point
├── index.css           # Global styles (POS-optimized)
├── App.tsx             # Main App component
├── App.css             # App component styles
├── vite-env.d.ts       # Vite + Electron type definitions
├── components/         # Reusable components (future)
├── pages/              # Page components (future)
├── hooks/              # Custom React hooks (future)
├── store/              # Zustand stores (future)
└── utils/              # Utility functions (future)
```

---

## Running the Renderer

### Development Mode

**Option 1: Full app (recommended)**
```bash
pnpm dev
```
This starts:
- Vite dev server (port 5173)
- TypeScript compiler (main process)
- Electron app

**Option 2: Renderer only**
```bash
pnpm dev:renderer
```
This starts only the Vite dev server for UI development.

---

### Production Build

```bash
pnpm build:renderer
```

Output: `dist/renderer/`

---

## Vite Configuration

**File:** `vite.config.ts`

```typescript
export default defineConfig({
  plugins: [react()],
  
  // Renderer entry point
  root: path.resolve(__dirname, 'src/renderer'),
  
  // Build output
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  
  // Dev server
  server: {
    port: 5173,
    strictPort: true,
  },
  
  // Path aliases
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@preload': path.resolve(__dirname, 'src/preload'),
    },
  },
});
```

---

## Path Aliases

Use these aliases in imports:

```typescript
// ✅ Good
import { APP_CONSTANTS } from '@shared/constants/app-constants';
import type { ElectronAPI } from '@preload/types';
import { Button } from '@renderer/components/Button';

// ❌ Bad
import { APP_CONSTANTS } from '../../shared/constants/app-constants';
```

---

## IPC Communication

### Accessing Electron API

```typescript
// Type-safe access to window.electron
if (window.electron) {
  const version = await window.electron.app.getVersion();
  const products = await window.electron.products.getAll();
}
```

### Example: Fetching Data

```typescript
import { useEffect, useState } from 'react';
import type { Product } from '@preload/types';

function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    window.electron.products.getAll()
      .then(setProducts)
      .catch(console.error);
  }, []);

  return (
    <ul>
      {products.map(p => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  );
}
```

---

## POS Design Principles

### 1. Large Fonts

```css
:root {
  --font-size-base: 18px;   /* Base text */
  --font-size-lg: 22px;     /* Important text */
  --font-size-xl: 28px;     /* Headings */
  --font-size-2xl: 36px;    /* Page titles */
}
```

**Why:** Easy to read from a distance, reduces eye strain

---

### 2. High Contrast

```css
:root {
  --color-bg: #ffffff;
  --color-text: #111827;
  --color-border: #d1d5db;
}
```

**Why:** Visibility in bright shop environments

---

### 3. Keyboard-First Navigation

```css
*:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.5);
}
```

**Why:** Faster than mouse, essential for POS workflow

**Keyboard shortcuts:**
- `Tab` / `Shift+Tab` - Navigate
- `Enter` - Confirm
- `Esc` - Cancel
- `F1` - Help
- `F11` - Fullscreen

---

### 4. Performance Optimization

**Avoid:**
- Heavy animations
- Large images
- Complex state updates
- Unnecessary re-renders

**Prefer:**
- Simple CSS transitions
- SVG icons
- Memoization (`useMemo`, `useCallback`)
- Virtual scrolling for long lists

---

## Security Constraints

### ❌ DO NOT

```typescript
// ❌ Cannot access Node.js
const fs = require('fs');  // Error: require is not defined

// ❌ Cannot access Electron directly
const { app } = require('electron');  // Error

// ❌ Cannot use child_process
const { exec } = require('child_process');  // Error
```

### ✅ DO

```typescript
// ✅ Use IPC via window.electron
const data = await window.electron.products.getAll();

// ✅ Use Web APIs
localStorage.setItem('key', 'value');
fetch('http://localhost:3000/api');  // If needed

// ✅ Use React state
const [count, setCount] = useState(0);
```

---

## TypeScript Configuration

**File:** `tsconfig.renderer.json`

Renderer-specific TypeScript config:
- Target: ES2020
- JSX: react-jsx
- Strict mode enabled
- Path aliases configured

---

## Hot Module Replacement (HMR)

Vite provides HMR out of the box:

1. Edit a React component
2. Save the file
3. Browser auto-refreshes
4. State is preserved (React Fast Refresh)

**No Electron restart needed!**

---

## Content Security Policy (CSP)

**File:** `src/renderer/index.html`

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'">
```

**Why:**
- Prevents loading external scripts
- Blocks inline scripts (except styles for CSS-in-JS)
- Additional security layer

---

## Environment Variables

Access Vite environment variables:

```typescript
// Check if in development
if (import.meta.env.DEV) {
  console.log('Development mode');
}

// Check if in production
if (import.meta.env.PROD) {
  console.log('Production mode');
}

// Custom env vars (from .env file)
const apiUrl = import.meta.env.VITE_API_URL;
```

---

## Debugging

### React DevTools

1. Install React DevTools extension in Chrome
2. Open DevTools in Electron (F12 or Ctrl+Shift+I)
3. React tab appears

### Console Logging

```typescript
// Development only
if (import.meta.env.DEV) {
  console.log('Debug info:', data);
}
```

### Vite Inspector

```typescript
// In vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import inspect from 'vite-plugin-inspect';

export default defineConfig({
  plugins: [
    react(),
    inspect(), // http://localhost:5173/__inspect/
  ],
});
```

---

## Best Practices

### ✅ DO

```typescript
// Use TypeScript
const [count, setCount] = useState<number>(0);

// Use path aliases
import { Button } from '@renderer/components/Button';

// Handle errors
window.electron.products.getAll()
  .catch(error => {
    console.error('Failed to fetch products:', error);
  });

// Memoize expensive computations
const total = useMemo(() => {
  return items.reduce((sum, item) => sum + item.price, 0);
}, [items]);
```

### ❌ DON'T

```typescript
// Don't use Node.js APIs
const fs = require('fs');  // ❌

// Don't hardcode paths
import { Button } from '../../components/Button';  // ❌

// Don't ignore errors
window.electron.products.getAll();  // ❌ No error handling

// Don't re-compute on every render
const total = items.reduce((sum, item) => sum + item.price, 0);  // ❌
```

---

## Next Steps

1. **State Management:** Set up Zustand stores
2. **Routing:** Configure React Router
3. **Components:** Build reusable UI components
4. **Pages:** Create POS screens (billing, inventory, etc.)
5. **Hooks:** Create custom hooks for IPC calls

---

**Last updated:** 2026-02-08  
**Files:** `src/renderer/`, `vite.config.ts`
