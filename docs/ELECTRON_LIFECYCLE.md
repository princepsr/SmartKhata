# Electron Main Process Lifecycle

## Overview

The `src/main/index.ts` file is the entry point for the Electron main process. It handles application lifecycle, window management, and platform-specific behavior.

---

## File Structure

```typescript
src/main/index.ts
├── Imports (Electron, config, logger)
├── Window creation function
├── App lifecycle handlers
└── Error handlers
```

---

## Lifecycle Events

### 1. `app.whenReady()`

**When:** App initialization is complete, ready to create windows

```typescript
app.whenReady().then(() => {
  // Log startup information
  logger.info('=== SmartKhata Starting ===');
  logger.info('Environment', { isDevelopment: config.isDevelopment });
  
  // Create main window
  createWindow();
  
  // Register activate handler (macOS)
  app.on('activate', () => { ... });
});
```

**Why `whenReady()` instead of `on('ready')`?**
- Returns a Promise (modern async/await pattern)
- Recommended by Electron docs
- Cleaner than event listeners

---

### 2. `window-all-closed`

**When:** All windows are closed

```typescript
app.on('window-all-closed', () => {
  // Windows/Linux: Quit app
  if (process.platform !== 'darwin') {
    logger.info('All windows closed, quitting app');
    app.quit();
  }
  // macOS: Keep app running (standard behavior)
});
```

**Platform-specific behavior:**
- **Windows/Linux:** App quits when all windows close
- **macOS:** App stays running (dock icon remains)

**Why this matters:**
- SmartKhata is Windows-first, so we quit on close
- macOS users expect apps to stay running
- `process.platform !== 'darwin'` handles this

---

### 3. `activate` (macOS only)

**When:** App is activated (clicked in dock) with no windows open

```typescript
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    logger.info('Reactivating app (macOS)');
    createWindow();
  }
});
```

**Why needed:**
- On macOS, apps can run without windows
- Clicking dock icon should recreate window
- Not relevant for Windows, but good practice

---

## Window Creation

### `createWindow()` Function

```typescript
function createWindow(): void {
  const config = configManager.getConfig();
  
  mainWindow = new BrowserWindow({
    width: APP_CONSTANTS.WINDOW.DEFAULT_WIDTH,
    height: APP_CONSTANTS.WINDOW.DEFAULT_HEIGHT,
    minWidth: APP_CONSTANTS.WINDOW.MIN_WIDTH,
    minHeight: APP_CONSTANTS.WINDOW.MIN_HEIGHT,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,        // Security
      contextIsolation: true,        // Security
    },
    title: APP_CONSTANTS.APP_NAME,
  });
  
  // Load URL based on environment
  if (config.isDevelopment) {
    mainWindow.loadURL('http://localhost:5173');  // Vite dev server
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
  
  // Cleanup on close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}
```

**Key settings:**

| Setting | Value | Why |
|---------|-------|-----|
| `nodeIntegration` | `false` | Security: Renderer can't access Node.js |
| `contextIsolation` | `true` | Security: Isolate renderer from main |
| `preload` | `../preload/index.js` | Secure IPC bridge |

---

## Security Best Practices

### ✅ What We Do

1. **No Node.js in renderer:**
   ```typescript
   nodeIntegration: false
   ```
   - Renderer can't access `require()`, `fs`, etc.
   - Prevents malicious code execution

2. **Context isolation:**
   ```typescript
   contextIsolation: true
   ```
   - Renderer and preload have separate contexts
   - Prevents prototype pollution attacks

3. **Preload script:**
   ```typescript
   preload: path.join(__dirname, '../preload/index.js')
   ```
   - Controlled IPC bridge
   - Only expose specific APIs to renderer

### ❌ What We DON'T Do

```typescript
// ❌ NEVER do this
nodeIntegration: true,        // Dangerous!
contextIsolation: false,      // Insecure!
webSecurity: false,           // Opens XSS attacks
```

---

## Error Handling

### Global Error Handlers

```typescript
// Uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
});

// Unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
});
```

**Why needed:**
- Logs errors to file (for debugging in production)
- Prevents silent failures
- Helps diagnose issues in kirana shops

---

## Development vs Production

### Development Mode

```typescript
if (config.isDevelopment) {
  mainWindow.loadURL('http://localhost:5173');  // Vite dev server
  mainWindow.webContents.openDevTools();        // Auto-open DevTools
}
```

**Features:**
- Loads from Vite dev server (HMR)
- DevTools auto-open
- Debug logging enabled

### Production Mode

```typescript
else {
  const indexPath = path.join(__dirname, '../renderer/index.html');
  mainWindow.loadFile(indexPath);  // Built files
}
```

**Features:**
- Loads from built files
- No DevTools
- File logging only

---

## Lifecycle Flow Diagram

```
┌─────────────────────────────────────────────┐
│  App Start                                  │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  app.whenReady()                            │
│  - Log startup info                         │
│  - Create main window                       │
│  - Register activate handler                │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  Window Created                             │
│  - Load Vite (dev) or built files (prod)    │
│  - Open DevTools (dev only)                 │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  App Running                                │
│  - User interacts with UI                   │
│  - IPC communication                        │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  User Closes Window                         │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  window-all-closed event                    │
│  - Windows/Linux: app.quit()                │
│  - macOS: Keep running                      │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  App Quit                                   │
└─────────────────────────────────────────────┘
```

---

## Common Patterns

### Single Window App (Current)

```typescript
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({ ... });
  mainWindow.on('closed', () => {
    mainWindow = null;  // Cleanup
  });
}
```

**Why `null`?**
- Allows garbage collection
- Prevents memory leaks

### Multiple Windows (Future)

```typescript
const windows: Set<BrowserWindow> = new Set();

function createWindow() {
  const win = new BrowserWindow({ ... });
  windows.add(win);
  win.on('closed', () => {
    windows.delete(win);
  });
}
```

---

## Troubleshooting

### Window doesn't appear

**Check:**
1. Vite dev server running? (`http://localhost:5173`)
2. Preload script path correct?
3. Check logs: `dev-data/logs/app-*.log`

**Fix:**
```typescript
// Add error handler
mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
  logger.error('Failed to load', { errorCode, errorDescription });
});
```

---

### App doesn't quit on Windows

**Symptom:** App stays running after closing window

**Fix:** Already handled correctly:
```typescript
if (process.platform !== 'darwin') {
  app.quit();  // ✅ Correct
}
```

---

### DevTools not opening in dev

**Check:**
```typescript
if (config.isDevelopment) {
  mainWindow.webContents.openDevTools();  // Should be here
}
```

---

## Best Practices

### ✅ DO

```typescript
// Use whenReady() instead of on('ready')
app.whenReady().then(() => { ... });

// Clean up window references
mainWindow.on('closed', () => {
  mainWindow = null;
});

// Handle platform differences
if (process.platform !== 'darwin') {
  app.quit();
}
```

### ❌ DON'T

```typescript
// Don't use deprecated on('ready')
app.on('ready', () => { ... });  // ❌ Old style

// Don't leave window references
mainWindow.on('closed', () => {
  // Missing: mainWindow = null;  // ❌ Memory leak
});

// Don't ignore platform differences
app.on('window-all-closed', () => {
  app.quit();  // ❌ Wrong on macOS
});
```

---

## Summary

| Event | When | Action |
|-------|------|--------|
| `whenReady()` | App initialized | Create window, register handlers |
| `window-all-closed` | All windows closed | Quit (Windows/Linux), Keep running (macOS) |
| `activate` | Dock icon clicked (macOS) | Recreate window if none exist |
| `closed` | Window closed | Cleanup window reference |

**Current implementation:** ✅ All best practices followed

---

**Last updated:** 2026-02-08  
**File:** `src/main/index.ts`
