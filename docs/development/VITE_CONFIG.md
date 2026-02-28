# Vite Configuration for Electron

## Overview

SmartKhata uses Vite to build the React renderer for Electron. The configuration handles both development (hot reload) and production (bundled files) modes.

---

## Complete Configuration

**File:** `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  // Renderer entry point (index.html location)
  root: path.resolve(__dirname, 'src/renderer'),
  publicDir: path.resolve(__dirname, 'public'),
  
  // Development server
  server: {
    port: 5173,
    strictPort: true,
  },

  // Build output
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,  // No code splitting
      },
    },
  },

  // Path aliases
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@preload': path.resolve(__dirname, 'src/preload'),
    },
  },

  // Electron-specific: Use relative paths
  base: './',
});
```

---

## Key Configuration Options

### 1. `root`

```typescript
root: path.resolve(__dirname, 'src/renderer'),
```

**Purpose:** Tells Vite where to find `index.html`

**Location:** `src/renderer/index.html`

**Why:** Keeps renderer code organized in its own directory

---

### 2. `base`

```typescript
base: './',
```

**Purpose:** Use relative paths for all assets

**Why it matters:**

**❌ Without `base: './'`:**
```html
<!-- Built HTML -->
<script type="module" src="/assets/index-abc123.js"></script>
```

Electron's `loadFile()` tries to load:
```
file:///assets/index-abc123.js  ❌ Not found!
```

**✅ With `base: './'`:**
```html
<!-- Built HTML -->
<script type="module" src="./assets/index-abc123.js"></script>
```

Electron's `loadFile()` loads:
```
file:///C:/path/to/dist/renderer/assets/index-abc123.js  ✅ Works!
```

---

### 3. `build.outDir`

```typescript
build: {
  outDir: path.resolve(__dirname, 'dist/renderer'),
}
```

**Output structure:**
```
dist/
└── renderer/
    ├── index.html
    ├── assets/
    │   ├── index-abc123.js
    │   └── index-xyz789.css
    └── ...
```

**Electron loads from:**
```typescript
// src/main/index.ts
const indexPath = path.join(__dirname, '../renderer/index.html');
mainWindow.loadFile(indexPath);
```

**Path resolution:**
```
dist/main/index.js
  → __dirname = dist/main
  → ../renderer/index.html = dist/renderer/index.html ✅
```

---

### 4. `build.rollupOptions.output.manualChunks`

```typescript
rollupOptions: {
  output: {
    manualChunks: undefined,  // Disable code splitting
  },
}
```

**Why disable code splitting?**

**With code splitting (default):**
```
dist/renderer/assets/
├── index-abc123.js       (main bundle)
├── vendor-def456.js      (React, etc.)
└── components-ghi789.js  (lazy-loaded)
```

**Without code splitting:**
```
dist/renderer/assets/
└── index-abc123.js  (everything in one file)
```

**Benefits for Electron:**
- ✅ Faster startup (no network requests)
- ✅ Simpler deployment (fewer files)
- ✅ No lazy loading overhead
- ✅ Better for local apps

**Trade-off:** Larger initial bundle, but acceptable for desktop apps

---

### 5. `server.port` and `server.strictPort`

```typescript
server: {
  port: 5173,
  strictPort: true,
}
```

**Why `strictPort: true`?**

Electron's main process expects dev server on port 5173:

```typescript
// src/main/index.ts
if (config.isDevelopment) {
  mainWindow.loadURL('http://localhost:5173');
}
```

If port 5173 is taken:
- **Without `strictPort`:** Vite uses 5174, Electron fails to connect
- **With `strictPort`:** Vite errors immediately, you know to fix it

---

## Dev vs Prod Behavior

### Development Mode

**Command:** `pnpm dev`

**Vite behavior:**
1. Starts dev server on `http://localhost:5173`
2. Serves files from `src/renderer/`
3. Enables HMR (Hot Module Replacement)
4. No build output

**Electron behavior:**
```typescript
if (config.isDevelopment) {
  mainWindow.loadURL('http://localhost:5173');
}
```

**Flow:**
```
Vite Dev Server (port 5173)
    ↓
Electron loads http://localhost:5173
    ↓
React app runs with HMR
```

**File changes:**
1. Edit `src/renderer/App.tsx`
2. Vite detects change
3. HMR updates browser
4. **No Electron restart needed!**

---

### Production Mode

**Command:** `pnpm build:renderer`

**Vite behavior:**
1. Builds from `src/renderer/`
2. Outputs to `dist/renderer/`
3. Minifies code
4. Generates source maps
5. Uses relative paths (`base: './'`)

**Electron behavior:**
```typescript
else {
  const indexPath = path.join(__dirname, '../renderer/index.html');
  mainWindow.loadFile(indexPath);
}
```

**Flow:**
```
Vite Build
    ↓
dist/renderer/index.html
    ↓
Electron loads file:///.../dist/renderer/index.html
    ↓
React app runs (no HMR)
```

---

## Path Resolution Examples

### Development

**Vite serves:**
```
http://localhost:5173/
http://localhost:5173/src/renderer/App.tsx
http://localhost:5173/src/renderer/App.css
```

**Electron loads:**
```typescript
mainWindow.loadURL('http://localhost:5173');
```

**Browser sees:**
```
http://localhost:5173/
```

---

### Production

**Vite builds:**
```
dist/renderer/
├── index.html
└── assets/
    ├── index-abc123.js
    └── index-xyz789.css
```

**index.html contains:**
```html
<script type="module" src="./assets/index-abc123.js"></script>
<link rel="stylesheet" href="./assets/index-xyz789.css">
```

**Electron loads:**
```typescript
const indexPath = path.join(__dirname, '../renderer/index.html');
// indexPath = C:\...\dist\renderer\index.html

mainWindow.loadFile(indexPath);
```

**Browser sees:**
```
file:///C:/path/to/dist/renderer/index.html
```

**Assets resolve to:**
```
file:///C:/path/to/dist/renderer/assets/index-abc123.js
file:///C:/path/to/dist/renderer/assets/index-xyz789.css
```

**✅ All paths work!**

---

## Common Issues

### Issue 1: Assets not loading in production

**Symptom:**
```
Failed to load resource: net::ERR_FILE_NOT_FOUND
file:///assets/index-abc123.js
```

**Cause:** Missing `base: './'` in vite.config.ts

**Fix:**
```typescript
export default defineConfig({
  base: './',  // ✅ Add this
});
```

---

### Issue 2: Dev server port conflict

**Symptom:**
```
Port 5173 is in use, trying another one...
```

**Cause:** Another app using port 5173

**Fix:**
```bash
# Find and kill process on port 5173
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Or change port in vite.config.ts
server: {
  port: 5174,  // Change this
}

# And update main process
mainWindow.loadURL('http://localhost:5174');
```

---

### Issue 3: HMR not working

**Symptom:** Changes don't reflect without full reload

**Cause:** Electron's `webSecurity` blocking WebSocket

**Fix:** Already handled in `src/main/index.ts`:
```typescript
webPreferences: {
  webSecurity: true,  // ✅ Allows localhost WebSocket
}
```

---

### Issue 4: Path aliases not working

**Symptom:**
```
Cannot find module '@renderer/components/Button'
```

**Cause:** Mismatch between vite.config.ts and tsconfig.json

**Fix:** Ensure both match:

**vite.config.ts:**
```typescript
resolve: {
  alias: {
    '@renderer': path.resolve(__dirname, 'src/renderer'),
  },
}
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "paths": {
      "@renderer/*": ["src/renderer/*"]
    }
  }
}
```

---

## Testing Build Output

### 1. Build renderer

```bash
pnpm build:renderer
```

### 2. Check output

```bash
ls dist/renderer
# Should see: index.html, assets/
```

### 3. Test with Electron

```bash
# Build main process
pnpm build:main

# Set NODE_ENV to production
$env:NODE_ENV="production"

# Run Electron
electron .
```

**Expected:** App loads from built files, no dev server needed

---

## Optimization Tips

### 1. Disable source maps in production

```typescript
build: {
  sourcemap: process.env.NODE_ENV !== 'production',
}
```

**Why:** Smaller bundle, faster startup

---

### 2. Enable minification

```typescript
build: {
  minify: 'esbuild',  // Default, very fast
}
```

**Why:** Smaller bundle size

---

### 3. Tree shaking

Vite does this automatically, but ensure:
```typescript
// ✅ Named imports (tree-shakeable)
import { useState } from 'react';

// ❌ Default imports (not tree-shakeable)
import React from 'react';
const { useState } = React;
```

---

## Summary

| Aspect | Development | Production |
|--------|-------------|------------|
| **Source** | `src/renderer/` | `dist/renderer/` |
| **Loading** | `loadURL('http://localhost:5173')` | `loadFile('../renderer/index.html')` |
| **HMR** | Enabled | Disabled |
| **Base Path** | `/` (absolute) | `./` (relative) |
| **Code Splitting** | Disabled | Disabled |
| **Source Maps** | Enabled | Enabled (optional) |

**Key principle:** `base: './'` makes production builds work with Electron's `loadFile()`

---

**Last updated:** 2026-02-08  
**File:** `vite.config.ts`
