# BrowserWindow Creation Guide

## Overview

The `createWindow()` function in `src/main/index.ts` creates and configures the main application window with POS-friendly defaults and security-conscious settings.

---

## Complete Implementation

```typescript
function createWindow(): void {
  const config = configManager.getConfig();

  logger.info('Creating main window');

  mainWindow = new BrowserWindow({
    width: APP_CONSTANTS.WINDOW.DEFAULT_WIDTH,      // 1280px
    height: APP_CONSTANTS.WINDOW.DEFAULT_HEIGHT,    // 800px
    minWidth: APP_CONSTANTS.WINDOW.MIN_WIDTH,       // 1024px
    minHeight: APP_CONSTANTS.WINDOW.MIN_HEIGHT,     // 768px
    center: true,                                    // Center on screen
    show: false,                                     // Don't show until ready
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,                        // Security
      contextIsolation: true,                        // Security
    },
    title: APP_CONSTANTS.APP_NAME,                  // 'SmartKhata'
  });

  // Show window when ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    logger.info('Main window shown');
  });

  // Load the app
  if (config.isDevelopment) {
    mainWindow.loadURL('http://localhost:5173');    // Vite dev server
    mainWindow.webContents.openDevTools();          // Auto-open DevTools
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html');
    mainWindow.loadFile(indexPath);                 // Built files
  }

  mainWindow.on('closed', () => {
    logger.info('Main window closed');
    mainWindow = null;                              // Cleanup
  });
}
```

---

## Window Configuration Explained

### Size & Position

| Option | Value | Why |
|--------|-------|-----|
| `width` | 1280px | Comfortable for POS UI (product list + cart) |
| `height` | 800px | Standard 16:10 aspect ratio |
| `minWidth` | 1024px | Minimum for usable POS interface |
| `minHeight` | 768px | Prevents UI from being cramped |
| `center` | `true` | Opens in center of screen (better UX) |

**POS-Friendly Rationale:**
- **1280x800** is large enough for:
  - Product search/list (left)
  - Shopping cart (right)
  - Billing controls (bottom)
- **1024x768 minimum** ensures UI doesn't break on smaller screens
- **Centered** looks professional on first launch

### Display Behavior

| Option | Value | Why |
|--------|-------|-----|
| `show` | `false` | Prevents white flash on startup |
| `ready-to-show` | Event handler | Shows window only when content is loaded |

**Why `show: false`?**
```typescript
// ❌ Without show: false
// User sees: White window → Flash → Content appears

// ✅ With show: false + ready-to-show
// User sees: Nothing → Content appears smoothly
```

**Pattern:**
```typescript
show: false,  // Don't show immediately

mainWindow.once('ready-to-show', () => {
  mainWindow?.show();  // Show when content is ready
});
```

### Security Settings

| Option | Value | Why |
|--------|-------|-----|
| `nodeIntegration` | `false` | Renderer can't access Node.js APIs |
| `contextIsolation` | `true` | Renderer and preload have separate contexts |
| `preload` | `../preload/index.js` | Controlled IPC bridge |

**Security Model:**
```
┌─────────────────────────────────────┐
│  Renderer (React UI)                │
│  - No access to Node.js             │
│  - No access to Electron APIs       │
│  - Can only use window.electron.*   │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Preload Script                     │
│  - Exposes safe APIs via            │
│    contextBridge                    │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Main Process                       │
│  - Full Node.js access              │
│  - Full Electron access             │
│  - Database, file system, etc.      │
└─────────────────────────────────────┘
```

**Why this matters:**
- Prevents malicious code in renderer from accessing file system
- Prevents XSS attacks from escalating to system access
- Industry best practice for Electron apps

---

## Loading Strategy

### Development Mode

```typescript
if (config.isDevelopment) {
  mainWindow.loadURL('http://localhost:5173');  // Vite dev server
  mainWindow.webContents.openDevTools();        // Auto-open DevTools
}
```

**Features:**
- ✅ Hot Module Replacement (HMR)
- ✅ Instant updates on code changes
- ✅ DevTools for debugging
- ✅ Source maps for debugging

**URL:** `http://localhost:5173` (Vite default port)

### Production Mode

```typescript
else {
  const indexPath = path.join(__dirname, '../renderer/index.html');
  mainWindow.loadFile(indexPath);
}
```

**Features:**
- ✅ Loads from built files
- ✅ No DevTools
- ✅ Optimized bundle
- ✅ Works offline

**Path:** `dist/renderer/index.html` (relative to main process)

**Why `path.join()`?**
- No hardcoded paths
- Works across platforms (Windows, macOS, Linux)
- Relative to `__dirname` (current file location)

---

## Path Resolution

### Preload Script Path

```typescript
preload: path.join(__dirname, '../preload/index.js')
```

**Directory structure:**
```
dist/
├── main/
│   └── index.js          ← __dirname points here
├── preload/
│   └── index.js          ← ../preload/index.js
└── renderer/
    └── index.html
```

**Why `../preload/index.js`?**
- Main process is in `dist/main/`
- Preload is in `dist/preload/`
- Go up one level (`../`) then into `preload/`

### Renderer HTML Path

```typescript
const indexPath = path.join(__dirname, '../renderer/index.html');
mainWindow.loadFile(indexPath);
```

**Same logic:**
- Main process: `dist/main/index.js`
- Renderer: `dist/renderer/index.html`
- Path: `../renderer/index.html`

---

## Window Lifecycle

### Creation Flow

```
1. createWindow() called
   ↓
2. BrowserWindow created (show: false)
   ↓
3. Load URL/file
   ↓
4. Content loads
   ↓
5. 'ready-to-show' event fires
   ↓
6. mainWindow.show()
   ↓
7. Window appears to user
```

### Cleanup on Close

```typescript
mainWindow.on('closed', () => {
  logger.info('Main window closed');
  mainWindow = null;  // Allow garbage collection
});
```

**Why set to `null`?**
- Allows JavaScript garbage collector to free memory
- Prevents memory leaks
- Standard Electron pattern

---

## Advanced Options (Not Currently Used)

### Frameless Window (Future)

```typescript
frame: false,           // Remove title bar
titleBarStyle: 'hidden' // macOS-style hidden title bar
```

**Use case:** Custom title bar with branding

### Fullscreen (Future)

```typescript
fullscreen: true,       // Start in fullscreen
kiosk: true,           // Kiosk mode (can't exit fullscreen)
```

**Use case:** Dedicated POS terminal

### Background Color

```typescript
backgroundColor: '#ffffff'  // Prevents flash on load
```

**Use case:** Match app background color

---

## Common Patterns

### Multiple Monitors

```typescript
// Open on specific display
const { screen } = require('electron');
const primaryDisplay = screen.getPrimaryDisplay();
const { width, height } = primaryDisplay.workAreaSize;

mainWindow = new BrowserWindow({
  x: 0,
  y: 0,
  width: width,
  height: height,
});
```

### Remember Window Position (Future)

```typescript
// Save position on close
mainWindow.on('close', () => {
  const bounds = mainWindow.getBounds();
  // Save bounds to settings
});

// Restore position on create
const savedBounds = loadSavedBounds();
mainWindow = new BrowserWindow({
  x: savedBounds.x,
  y: savedBounds.y,
  width: savedBounds.width,
  height: savedBounds.height,
});
```

---

## Troubleshooting

### Window appears off-screen

**Symptom:** Window opens but is not visible

**Fix:**
```typescript
center: true,  // Always center on first launch
```

### White flash on startup

**Symptom:** Brief white screen before content appears

**Fix:**
```typescript
show: false,
backgroundColor: '#f0f0f0',  // Match app background

mainWindow.once('ready-to-show', () => {
  mainWindow?.show();
});
```

### DevTools not opening in dev

**Check:**
```typescript
if (config.isDevelopment) {
  mainWindow.webContents.openDevTools();  // ✅ Should be here
}
```

### Preload script not loading

**Check path:**
```typescript
// ❌ Wrong
preload: 'preload/index.js'

// ✅ Correct
preload: path.join(__dirname, '../preload/index.js')
```

---

## Best Practices

### ✅ DO

```typescript
// Use constants for sizes
width: APP_CONSTANTS.WINDOW.DEFAULT_WIDTH,

// Use path.join for paths
preload: path.join(__dirname, '../preload/index.js'),

// Use ready-to-show pattern
show: false,
mainWindow.once('ready-to-show', () => { ... });

// Clean up on close
mainWindow.on('closed', () => {
  mainWindow = null;
});
```

### ❌ DON'T

```typescript
// Don't hardcode sizes
width: 1280,  // ❌ Use constants

// Don't hardcode paths
preload: 'C:\\path\\to\\preload.js',  // ❌ Not portable

// Don't show immediately
show: true,  // ❌ Causes white flash

// Don't forget cleanup
// Missing: mainWindow = null;  // ❌ Memory leak
```

---

## Summary

| Aspect | Implementation | Benefit |
|--------|---------------|---------|
| **Size** | 1280x800 (min 1024x768) | POS-friendly layout |
| **Position** | Centered | Professional appearance |
| **Security** | No Node integration, context isolation | Prevents attacks |
| **Loading** | Dev: localhost, Prod: file | HMR in dev, offline in prod |
| **Display** | `show: false` + `ready-to-show` | No white flash |
| **Paths** | `path.join(__dirname, ...)` | No hardcoding, portable |

**Current status:** ✅ Production-ready with all best practices

---

**Last updated:** 2026-02-08  
**File:** `src/main/index.ts`
