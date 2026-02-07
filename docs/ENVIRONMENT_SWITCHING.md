# Environment Switching (Dev vs Prod)

## Overview

SmartKhata automatically detects whether it's running in development or production mode and loads the renderer accordingly. This works seamlessly with the same Electron binary in both environments.

---

## How It Works

### Detection Logic

**File:** `src/main/config/app-config.ts`

```typescript
const isDevelopment = process.env.NODE_ENV !== 'production';
```

**Simple rule:**
- `NODE_ENV === 'production'` → Production mode
- Anything else (including `undefined`) → Development mode

---

## Environment Detection Flow

```
┌─────────────────────────────────────────┐
│  App Starts                             │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  ConfigManager Constructor              │
│  - Reads process.env.NODE_ENV           │
│  - Sets isDevelopment flag              │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  createWindow()                         │
│  - Gets config.isDevelopment            │
│  - Loads renderer based on mode         │
└─────────────────────────────────────────┘
```

---

## Renderer Loading Logic

**File:** `src/main/index.ts`

```typescript
const config = configManager.getConfig();

if (config.isDevelopment) {
  // Development: Vite dev server
  mainWindow.loadURL('http://localhost:5173');
  mainWindow.webContents.openDevTools();
} else {
  // Production: Built files
  const indexPath = path.join(__dirname, '../renderer/index.html');
  mainWindow.loadFile(indexPath);
}
```

---

## Development Mode

### When It Activates

- Running `pnpm dev`
- Running `electron .` without building
- `NODE_ENV` is not set to `'production'`

### What Happens

```typescript
if (config.isDevelopment) {
  mainWindow.loadURL('http://localhost:5173');  // Vite dev server
  mainWindow.webContents.openDevTools();        // Auto-open DevTools
}
```

**Features:**
- ✅ Loads from Vite dev server (`http://localhost:5173`)
- ✅ Hot Module Replacement (HMR)
- ✅ DevTools auto-open
- ✅ Source maps for debugging
- ✅ Fast refresh on code changes

**File Paths:**
- Database: `SmartKhata/dev-data/smartkhata.db`
- Logs: `C:\Users\<User>\AppData\Roaming\SmartKhata\logs\`

---

## Production Mode

### When It Activates

- Running built app (`pnpm build:win`)
- `NODE_ENV === 'production'`
- Packaged with electron-builder

### What Happens

```typescript
else {
  const indexPath = path.join(__dirname, '../renderer/index.html');
  mainWindow.loadFile(indexPath);  // Load built files
}
```

**Features:**
- ✅ Loads from built files (`dist/renderer/index.html`)
- ✅ No DevTools
- ✅ Optimized bundle
- ✅ Works offline

**File Paths:**
- Database: `C:\Users\<User>\AppData\Roaming\SmartKhata\data\smartkhata.db`
- Logs: `C:\Users\<User>\AppData\Roaming\SmartKhata\logs\`

---

## How NODE_ENV Gets Set

### Development (Automatic)

```bash
# pnpm dev
pnpm dev
```

**What happens:**
1. Vite starts dev server (sets `NODE_ENV=development`)
2. TypeScript compiles main process
3. Electron launches
4. `process.env.NODE_ENV !== 'production'` → Development mode

**No manual configuration needed!**

---

### Production (Automatic)

```bash
# pnpm build
pnpm build
```

**What happens:**
1. Vite builds renderer (sets `NODE_ENV=production`)
2. TypeScript compiles main process
3. electron-builder packages app
4. `process.env.NODE_ENV === 'production'` → Production mode

**No manual configuration needed!**

---

## Configuration Manager

**File:** `src/main/config/app-config.ts`

### Complete Implementation

```typescript
class ConfigManager {
  private config: AppConfig;

  constructor() {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const userDataPath = app.getPath('userData');

    this.ensureDirectories(userDataPath);

    this.config = {
      isDevelopment,
      isProduction: !isDevelopment,
      appVersion: app.getVersion(),
      userDataPath,
      databasePath: this.getDatabasePath(userDataPath, isDevelopment),
      logsPath: path.join(userDataPath, 'logs'),
      backupPath: path.join(userDataPath, 'backups'),
    };
  }

  private getDatabasePath(userDataPath: string, isDevelopment: boolean): string {
    if (isDevelopment) {
      // Dev: Project root
      return path.join(process.cwd(), 'dev-data', 'smartkhata.db');
    } else {
      // Prod: User data directory
      return path.join(userDataPath, 'data', 'smartkhata.db');
    }
  }

  public getConfig(): AppConfig {
    return { ...this.config };
  }
}

export const configManager = new ConfigManager();
```

---

## Path Resolution

### Development Paths

| Resource | Path |
|----------|------|
| Database | `SmartKhata/dev-data/smartkhata.db` |
| Logs | `AppData/Roaming/SmartKhata/logs/` |
| Backups | `AppData/Roaming/SmartKhata/backups/` |
| Renderer | `http://localhost:5173` (Vite) |

**Why dev database in project root?**
- Easy to inspect with SQLite browser
- Easy to delete and reset
- Doesn't pollute user data directory

---

### Production Paths

| Resource | Path |
|----------|------|
| Database | `AppData/Roaming/SmartKhata/data/smartkhata.db` |
| Logs | `AppData/Roaming/SmartKhata/logs/` |
| Backups | `AppData/Roaming/SmartKhata/backups/` |
| Renderer | `dist/renderer/index.html` (built) |

**Why user data directory?**
- Standard Windows app location
- Survives app updates
- User-specific data

---

## Vite Dev Server Integration

### How It Works

**1. Vite starts on port 5173:**
```bash
pnpm dev:renderer  # Starts Vite
```

**2. Electron waits for Vite:**
```bash
pnpm dev:electron  # wait-on http://localhost:5173 && electron .
```

**3. Electron loads from Vite:**
```typescript
mainWindow.loadURL('http://localhost:5173');
```

**4. HMR works automatically:**
- Edit React component
- Vite recompiles
- Browser auto-refreshes
- No Electron restart needed!

---

## electron-builder Compatibility

### How It Works

**During build:**
```bash
pnpm build:win
```

**electron-builder sets:**
```javascript
process.env.NODE_ENV = 'production'
```

**App detects production mode:**
```typescript
const isDevelopment = process.env.NODE_ENV !== 'production';  // false
```

**Loads built files:**
```typescript
mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
```

**No special configuration needed!** ✅

---

## Best Practices

### ✅ DO

```typescript
// Use config manager
const config = configManager.getConfig();
if (config.isDevelopment) {
  // Dev-specific code
}

// Use environment-specific paths
const dbPath = config.databasePath;  // Auto-switches

// Check environment once
const isDev = config.isDevelopment;
```

### ❌ DON'T

```typescript
// Don't check NODE_ENV directly everywhere
if (process.env.NODE_ENV !== 'production') {  // ❌ Use config instead
  // ...
}

// Don't hardcode paths
const dbPath = 'C:\\path\\to\\db.sqlite';  // ❌ Use config

// Don't use global variables
global.isDevelopment = true;  // ❌ Use config manager
```

---

## Troubleshooting

### Vite dev server not loading

**Symptom:** Blank window in development

**Check:**
1. Is Vite running? (`http://localhost:5173` in browser)
2. Is `wait-on` working? (check terminal output)
3. Is port 5173 available?

**Fix:**
```bash
# Start Vite manually
pnpm dev:renderer

# In another terminal
pnpm dev:electron
```

---

### Production build loads dev server

**Symptom:** Built app tries to load `localhost:5173`

**Cause:** `NODE_ENV` not set to `'production'`

**Fix:**
```bash
# Ensure you're using build script
pnpm build:win  # Sets NODE_ENV automatically
```

---

### DevTools not opening in dev

**Symptom:** DevTools don't auto-open

**Check:**
```typescript
if (config.isDevelopment) {
  mainWindow.webContents.openDevTools();  // ✅ Should be here
}
```

---

### Database in wrong location

**Symptom:** Can't find dev database

**Check:**
```typescript
console.log('Database path:', config.databasePath);
// Dev: SmartKhata/dev-data/smartkhata.db
// Prod: AppData/Roaming/SmartKhata/data/smartkhata.db
```

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────┐
│  Development (pnpm dev)                 │
├─────────────────────────────────────────┤
│  1. Vite starts (port 5173)             │
│  2. TypeScript compiles main            │
│  3. Electron launches                   │
│  4. NODE_ENV !== 'production' → Dev     │
│  5. loadURL('http://localhost:5173')    │
│  6. DevTools auto-open                  │
│  7. HMR works                           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Production (pnpm build:win)            │
├─────────────────────────────────────────┤
│  1. Vite builds renderer                │
│  2. TypeScript compiles main            │
│  3. electron-builder packages           │
│  4. NODE_ENV === 'production' → Prod    │
│  5. loadFile('../renderer/index.html')  │
│  6. No DevTools                         │
│  7. Optimized bundle                    │
└─────────────────────────────────────────┘
```

---

## Testing Both Modes

### Test Development Mode

```bash
# 1. Start dev mode
pnpm dev

# 2. Verify:
# - Window opens
# - DevTools are open
# - HMR works (edit a file, see changes)
# - Database at: SmartKhata/dev-data/smartkhata.db
```

---

### Test Production Mode

```bash
# 1. Build app
pnpm build:win

# 2. Run built app
./release/SmartKhata.exe

# 3. Verify:
# - Window opens
# - No DevTools
# - Database at: AppData/Roaming/SmartKhata/data/smartkhata.db
```

---

## Summary

| Aspect | Development | Production |
|--------|-------------|------------|
| **Detection** | `NODE_ENV !== 'production'` | `NODE_ENV === 'production'` |
| **Renderer** | `http://localhost:5173` | `dist/renderer/index.html` |
| **DevTools** | Auto-open | Disabled |
| **Database** | `dev-data/smartkhata.db` | `AppData/.../data/smartkhata.db` |
| **HMR** | Enabled | N/A |
| **Source Maps** | Enabled | Disabled |

**Key principle:** Same binary, different behavior based on `NODE_ENV`

**No hacks, no global variables, works with electron-builder!** ✅

---

**Last updated:** 2026-02-08  
**Files:** `src/main/config/app-config.ts`, `src/main/index.ts`
