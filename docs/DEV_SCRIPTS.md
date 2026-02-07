# Development Scripts & Build Commands

## Overview

SmartKhata uses **Vite** for the React renderer and **electron-builder** for packaging. This document explains all npm/pnpm scripts and how the development workflow works.

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Run development mode (one command)
pnpm dev

# Build for production
pnpm build

# Build Windows installer
pnpm build:win
```

---

## Development Scripts

### `pnpm dev` - Start Development Mode

**What it does:**
Runs renderer (Vite), main process (TypeScript watch), and Electron concurrently.

**Under the hood:**
```bash
concurrently -k "pnpm dev:renderer" "pnpm dev:main" "pnpm dev:electron"
```

**Breakdown:**

| Script | Command | Purpose |
|--------|---------|---------|
| `dev:renderer` | `vite` | Start Vite dev server on `http://localhost:5173` |
| `dev:main` | `tsc-watch` | Compile main process & auto-restart Electron |

**Flags:**
- `-k` - Kill all processes when one exits

---

## How Dev Mode Works (End-to-End)

### Step-by-Step Flow

```
1. You run: pnpm dev
   ↓
2. Concurrently starts 3 processes in parallel:
   
   Process 1: dev:renderer (Vite)
   - Starts Vite dev server on port 5173
   - Serves React app with HMR (Hot Module Replacement)
   - Watches src/renderer/ for changes
   
   Process 2: dev:main (TypeScript Watch)
   - Compiles src/main/ to dist/main/
   - Watches for changes and recompiles
   - Does NOT restart Electron automatically
   
   Process 3: dev:electron (Electron)
   - Waits for Vite server to be ready (wait-on)
   - Launches Electron pointing to http://localhost:5173
   - Loads React app from Vite dev server
   
3. You make changes:
   
   - Renderer changes (React/UI):
     → Vite HMR updates instantly (no reload)
   
   - Main process changes (Node.js):
     → TypeScript recompiles
     → You MUST manually restart Electron (Ctrl+R or close/reopen)
   
4. You stop: Ctrl+C
   - All 3 processes terminate
```

### Visual Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    pnpm dev                             │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
   ┌─────────┐      ┌──────────┐     ┌──────────┐
   │  Vite   │      │   tsc    │     │ Electron │
   │  :5173  │      │  --watch │     │          │
   └─────────┘      └──────────┘     └──────────┘
        │                 │                 │
        │                 │                 │
   Serves React     Compiles main      Loads from
   with HMR         to dist/main/      localhost:5173
```

---

## Build Scripts

### `pnpm build` - Production Build

**What it does:**
Compiles both renderer and main process for production.

```bash
pnpm build:renderer && pnpm build:main
```

**Breakdown:**

| Script | Command | Output |
|--------|---------|--------|
| `build:renderer` | `tsc && vite build` | `dist/renderer/` (HTML, JS, CSS) |
| `build:main` | `tsc --project tsconfig.main.json` | `dist/main/` (compiled Node.js) |

**Output structure:**
```
dist/
├── main/
│   ├── index.js
│   ├── services/
│   └── repositories/
└── renderer/
    ├── index.html
    ├── assets/
    └── *.js
```

---

### `pnpm build:win` - Windows Installer

**What it does:**
Builds production bundle + creates Windows installer (NSIS) and portable exe.

```bash
pnpm build && electron-builder --win --x64
```

**Output:**
```
release/
├── SmartKhata Setup 0.1.0.exe    # Installer
└── SmartKhata 0.1.0.exe          # Portable
```

**Installer types:**
- **NSIS** - Traditional Windows installer (recommended for distribution)
- **Portable** - Single .exe (no installation required)

---

### `pnpm build:win:portable` - Portable Only

**What it does:**
Builds only the portable .exe (faster, for testing).

```bash
pnpm build && electron-builder --win portable
```

---

## Utility Scripts

### Code Quality

```bash
# Linting
pnpm lint              # Check for errors
pnpm lint:fix          # Auto-fix errors

# Formatting
pnpm format            # Format all files
pnpm format:check      # Check if formatted

# Type checking
pnpm type-check        # Check all
pnpm type-check:main   # Check main only
pnpm type-check:renderer  # Check renderer only
```

### Cleanup

```bash
pnpm clean  # Remove dist/, build/, out/, release/
```

---

## Vite Configuration

### File: `vite.config.ts`

**Key settings:**

```typescript
{
  server: {
    port: 5173,           // Dev server port
    strictPort: true,     // Fail if port is taken
  },
  build: {
    outDir: 'dist/renderer',  // Output directory
    sourcemap: true,          // Generate source maps
  },
  base: './',             // Relative paths (for Electron)
  resolve: {
    alias: {              // Path aliases
      '@renderer': 'src/renderer',
      '@shared': 'src/shared',
      '@/types': 'src/shared/types',
    }
  }
}
```

**Why `base: './'`?**
- Electron loads files from `file://` protocol
- Relative paths ensure assets load correctly

---

## electron-builder Configuration

### In `package.json`

```json
{
  "build": {
    "appId": "com.smartkhata.pos",
    "productName": "SmartKhata",
    "directories": {
      "output": "release",
      "buildResources": "resources"
    },
    "files": [
      "dist/**/*",
      "package.json"
    ],
    "win": {
      "target": ["nsis", "portable"],
      "icon": "resources/icons/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true
    }
  }
}
```

**Key settings:**
- `files` - Only include `dist/` and `package.json` (keeps installer small)
- `win.target` - Build both NSIS installer and portable exe
- `nsis.oneClick: false` - Allow user to choose install directory

---

## Development Workflow

### Typical Day

```bash
# Morning: Start dev mode
pnpm dev

# Work on features
# - Edit React components → HMR updates instantly
# - Edit main process → Restart Electron manually (Ctrl+R)

# Before commit
pnpm lint:fix
pnpm format
pnpm type-check

# Commit
git add .
git commit -m "feat: add product search"

# End of day: Test production build
pnpm build
pnpm build:win:portable  # Quick test
```

---

## Hot Module Replacement (HMR)

### What is HMR?

**HMR** = Hot Module Replacement
- Updates React components without full page reload
- Preserves component state
- Instant feedback (< 100ms)

### What triggers HMR?

✅ **Instant HMR (no reload):**
- React component changes
- CSS changes
- New imports

❌ **Requires manual restart:**
- Main process changes (Electron restart needed)
- Preload script changes (Electron restart needed)
- Shared types changes (both processes need restart)

---

## Troubleshooting

### Vite server won't start

**Error:** `Port 5173 is already in use`

**Fix:**
```bash
# Kill process on port 5173 (Windows)
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Or change port in vite.config.ts
server: { port: 5174 }
```

---

### Electron won't start

**Error:** `wait-on timeout`

**Fix:**
1. Check if Vite is running: `http://localhost:5173`
2. Increase timeout:
   ```bash
   wait-on http://localhost:5173 --timeout 30000 && electron .
   ```

---

### Main process changes not reflected

**Symptom:** Code changes don't take effect

**Fix:**
- Main process requires **manual Electron restart**
- Close Electron window and reopen (or Ctrl+R if dev tools open)

**Future improvement:**
- Add `electron-reloader` for auto-restart (optional)

---

### Build fails

**Error:** `Cannot find module '@renderer/...'`

**Fix:**
- Ensure path aliases match in `tsconfig.json` and `vite.config.ts`
- Run `pnpm clean` and rebuild

---

## Performance Tips

### Faster Development

1. **Use HMR effectively:**
   - Work on renderer (React) for instant feedback
   - Batch main process changes to reduce restarts

2. **Skip type checking in dev:**
   - Vite doesn't type-check by default (faster)
   - Run `pnpm type-check` before commit

3. **Use `--watch` mode:**
   - Main process compiles incrementally (fast)

### Faster Builds

1. **Skip source maps in production:**
   ```typescript
   // vite.config.ts
   build: { sourcemap: false }
   ```

2. **Use portable build for testing:**
   ```bash
   pnpm build:win:portable  # Faster than full installer
   ```

---

## Future Enhancements

### Auto-restart Electron on Main Changes

**Install:**
```bash
pnpm add -D electron-reloader
```

**In main process:**
```typescript
// src/main/index.ts
if (process.env.NODE_ENV === 'development') {
  require('electron-reloader')(module);
}
```

### Separate Vite Config for Main Process

**For advanced users:**
- Use Vite to bundle main process (instead of tsc)
- Enables tree-shaking and minification

---

## Summary

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `pnpm dev` | Start dev mode | Daily development |
| `pnpm build` | Production build | Before packaging |
| `pnpm build:win` | Windows installer | Release to users |
| `pnpm build:win:portable` | Portable exe | Quick testing |
| `pnpm lint:fix` | Fix linting | Before commit |
| `pnpm format` | Format code | Before commit |
| `pnpm type-check` | Check types | Before commit |
| `pnpm clean` | Clean build dirs | When build fails |

**One-command experience:**
- ✅ `pnpm dev` starts everything
- ✅ HMR for instant React updates
- ✅ TypeScript watch for main process
- ✅ All processes stop with Ctrl+C

---

**Last updated:** 2026-02-08
