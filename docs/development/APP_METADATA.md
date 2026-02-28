# App Metadata & Configuration

## Overview

SmartKhata's app metadata is configured in multiple files to ensure consistency across the application, installer, and runtime.

---

## App Metadata

### Package.json

**File:** `package.json`

```json
{
  "name": "smartkhata",
  "version": "1.0.0",
  "description": "Local-first Kirana POS application for Windows",
  "author": "SmartKhata Team",
  "license": "MIT"
}
```

| Field         | Value               | Purpose                                 |
| ------------- | ------------------- | --------------------------------------- |
| `name`        | `smartkhata`        | npm package name (lowercase, no spaces) |
| `version`     | `0.1.0`             | Semantic versioning (major.minor.patch) |
| `description` | POS app description | Shown in package managers               |
| `author`      | SmartKhata Team     | Copyright holder                        |
| `license`     | MIT                 | Open source license                     |

---

### App Constants

**File:** `src/shared/constants/app-constants.ts`

```typescript
export const APP_CONSTANTS = {
  APP_NAME: 'SmartKhata',
  APP_VERSION: '1.0.0',
  APP_ID: 'com.smartkhata.pos',
  // ...
};
```

| Constant      | Value              | Purpose                                   |
| ------------- | ------------------ | ----------------------------------------- |
| `APP_NAME`    | SmartKhata         | Display name (with proper casing)         |
| `APP_VERSION` | 0.1.0              | Runtime version (must match package.json) |
| `APP_ID`      | com.smartkhata.pos | Unique app identifier (reverse domain)    |

**Why duplicate version?**

- `package.json` is for build tools
- `APP_CONSTANTS` is for runtime (UI, logs, etc.)
- Keep them in sync manually (or use a script)

---

### electron-builder Configuration

**File:** `package.json` → `build` section

```json
{
  "build": {
    "appId": "com.smartkhata.pos",
    "productName": "SmartKhata",
    "directories": {
      "output": "release",
      "buildResources": "resources"
    },
    "files": ["dist/**/*", "package.json"],
    "win": {
      "target": ["nsis", "portable"],
      "icon": "resources/icons/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

---

## App ID (Reverse Domain Notation)

### Format

```
com.{company}.{product}
```

**SmartKhata:**

```
com.smartkhata.pos
```

**Why this format?**

- Standard across platforms (Windows, macOS, Linux)
- Ensures global uniqueness
- Used by Windows for app data directory

**Where it's used:**

- User data path: `C:\Users\<User>\AppData\Roaming\SmartKhata\`
- Windows registry (for uninstall info)
- App shortcuts

---

## Version Numbering

### Semantic Versioning (SemVer)

```
MAJOR.MINOR.PATCH
```

**SmartKhata:** `0.1.0`

| Part  | Meaning          | When to increment                 |
| ----- | ---------------- | --------------------------------- |
| MAJOR | Breaking changes | API changes, major rewrites       |
| MINOR | New features     | New features, backward compatible |
| PATCH | Bug fixes        | Bug fixes, small improvements     |

**Examples:**

- `0.1.0` → `0.1.1` (bug fix)
- `0.1.1` → `0.2.0` (new feature: cloud sync)
- `0.2.0` → `1.0.0` (first stable release)

**Pre-1.0.0:**

- `0.x.x` indicates beta/development
- Breaking changes allowed in MINOR version

---

## Icon Configuration

### Windows Icon

**File:** `resources/icons/icon.ico`

**Requirements:**

- Format: `.ico` (Windows icon format)
- Sizes: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256
- Color depth: 32-bit (with alpha channel)

**Configuration:**

```json
{
  "build": {
    "win": {
      "icon": "resources/icons/icon.ico"
    }
  }
}
```

**Where it's used:**

- Taskbar icon
- Desktop shortcut
- Executable file icon
- Start menu shortcut
- Alt+Tab switcher

**Status:** ✅ Configured with official SmartKhata branding

**See:** `resources/icons/icon.ico`

---

## Single-Instance Lock

### What It Does

Prevents multiple instances of SmartKhata from running simultaneously.

**Why it matters:**

- Prevents database conflicts (SQLite doesn't handle concurrent writes well)
- Avoids user confusion (multiple windows)
- Windows best practice for desktop apps

---

### Implementation

**File:** `src/main/index.ts`

```typescript
// Request single-instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running, quit this one
  logger.info('Another instance is already running, quitting...');
  app.quit();
} else {
  // This is the first instance
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    logger.info('Second instance attempted to start');

    // Focus the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}
```

---

### Behavior

#### First Instance (Normal Startup)

```
1. User launches SmartKhata.exe
   ↓
2. app.requestSingleInstanceLock() → true
   ↓
3. App starts normally
   ↓
4. Window opens
```

#### Second Instance (Blocked)

```
1. User launches SmartKhata.exe again
   ↓
2. app.requestSingleInstanceLock() → false
   ↓
3. Second instance quits immediately
   ↓
4. First instance receives 'second-instance' event
   ↓
5. First instance window is focused
```

**User experience:**

- User double-clicks app icon
- Existing window comes to front
- No error message needed (seamless)

---

### Windows-Specific Behavior

**How it works on Windows:**

- Uses Windows mutex (mutual exclusion)
- Mutex name based on `appId` (`com.smartkhata.pos`)
- Mutex released when app quits

**Edge cases handled:**

- App crashes → Mutex auto-released by OS
- App force-quit → Mutex auto-released by OS
- Multiple users → Each user has separate mutex

---

## electron-builder Windows Configuration

### NSIS Installer

```json
{
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true
  }
}
```

| Option                               | Value   | Why                                    |
| ------------------------------------ | ------- | -------------------------------------- |
| `oneClick`                           | `false` | Allows user to choose install location |
| `allowToChangeInstallationDirectory` | `true`  | User can pick install folder           |
| `createDesktopShortcut`              | `true`  | Adds desktop icon                      |
| `createStartMenuShortcut`            | `true`  | Adds Start menu entry                  |

**Windows best practices:**

- ✅ Allow install directory choice (some users have C: drive restrictions)
- ✅ Create desktop shortcut (easy access for shop owners)
- ✅ Create Start menu entry (standard Windows behavior)

---

### Build Targets

```json
{
  "win": {
    "target": [
      { "target": "nsis", "arch": ["x64"] },
      { "target": "portable", "arch": ["x64"] }
    ]
  }
}
```

**NSIS Installer:**

- Full installer with uninstaller
- Adds to Windows Programs & Features
- Creates shortcuts
- Best for permanent installation

**Portable:**

- Single .exe file
- No installation required
- Runs from USB drive
- Best for testing or temporary use

**Architecture:**

- `x64` only (64-bit Windows)
- No `ia32` (32-bit) support (Windows 10+ is 64-bit)

---

## File Paths

### User Data Directory

**Path:** `C:\Users\<User>\AppData\Roaming\SmartKhata\`

**Determined by:**

- `app.getPath('userData')`
- Uses `productName` from package.json

**Contains:**

```
SmartKhata/
├── data/
│   └── smartkhata.db
├── logs/
│   └── app-2026-02-08.log
└── backups/
    └── backup-2026-02-08.zip
```

---

### Install Directory

**Default:** `C:\Program Files\SmartKhata\`

**User can change during installation** (if `allowToChangeInstallationDirectory: true`)

**Contains:**

```
SmartKhata/
├── SmartKhata.exe
├── resources/
└── ... (app files)
```

---

## Updating Metadata

### When Releasing a New Version

**1. Update version in package.json:**

```json
{
  "version": "0.2.0"
}
```

**2. Update version in app-constants.ts:**

```typescript
APP_VERSION: '0.2.0',
```

**3. Build:**

```bash
pnpm build:win
```

**4. Installer will have new version:**

```
SmartKhata Setup 0.2.0.exe
```

---

### Automated Version Sync (Future)

**Option 1: npm script**

```json
{
  "scripts": {
    "version": "node scripts/sync-version.js"
  }
}
```

**Option 2: Build-time replacement**

- Use Vite/Webpack to inject version from package.json
- No manual sync needed

---

## Best Practices

### ✅ DO

```typescript
// Use constants
import { APP_CONSTANTS } from '@shared/constants/app-constants';
console.log(APP_CONSTANTS.APP_NAME); // 'SmartKhata'

// Use app.getVersion() for runtime version
const version = app.getVersion(); // Reads from package.json

// Implement single-instance lock
const gotTheLock = app.requestSingleInstanceLock();
```

### ❌ DON'T

```typescript
// Don't hardcode app name
const appName = 'SmartKhata'; // ❌ Use APP_CONSTANTS

// Don't hardcode version
const version = '0.1.0'; // ❌ Use app.getVersion()

// Don't allow multiple instances (for POS apps)
// Missing: app.requestSingleInstanceLock()  // ❌ Database conflicts!
```

---

## Summary

| Aspect              | Configuration              | Location                        |
| ------------------- | -------------------------- | ------------------------------- |
| **App Name**        | `SmartKhata`               | package.json, app-constants.ts  |
| **App ID**          | `com.smartkhata.pos`       | package.json (build.appId)      |
| **Version**         | `0.1.0`                    | package.json, app-constants.ts  |
| **Icon**            | `resources/icons/icon.ico` | package.json (build.win.icon)   |
| **Single-Instance** | Enabled                    | src/main/index.ts               |
| **Installer**       | NSIS + Portable            | package.json (build.win.target) |

**Status:** ✅ Configured for Windows best practices

---

**Last updated:** 2026-02-18 (Phase 1 Complete)
**Files:** `package.json`, `src/shared/constants/app-constants.ts`, `src/main/index.ts`
