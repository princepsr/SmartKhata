# T0.2.1 – Core Electron Dependencies Installation

## Summary

Successfully installed all core dependencies for the SmartKhata Electron project.

---

## Installed Packages

### Core Dependencies (Production)
```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1"
}
```

### Development Dependencies
```json
{
  "electron": "^34.0.0",
  "electron-builder": "^25.1.8",
  "vite": "^6.0.5",
  "@vitejs/plugin-react": "^4.3.4",
  "typescript": "^5.7.2",
  "@types/node": "^22.10.5",
  "@types/react": "^18.3.18",
  "@types/react-dom": "^18.3.5",
  "eslint": "^9.17.0",
  "typescript-eslint": "^8.19.1",
  "prettier": "^3.4.2",
  "concurrently": "^9.1.2",
  "wait-on": "^8.0.1",
  "rimraf": "^6.0.1"
}
```

**Total packages installed:** 557

---

## Installation Steps

### 1. Install pnpm (if not already installed)
```bash
npm install -g pnpm
```

**Result:** pnpm v10.29.1 installed globally

### 2. Install project dependencies
```bash
pnpm install
```

**Result:** All dependencies installed successfully in ~2 minutes

---

## Verification

### Check Electron version
```bash
pnpm electron --version
```

**Expected output:** `v34.0.0`

### Check pnpm version
```bash
pnpm --version
```

**Expected output:** `10.29.1`

### Verify TypeScript
```bash
pnpm tsc --version
```

**Expected output:** `Version 5.7.2`

---

## Package Manager Choice: pnpm

**Why pnpm?**
- ✅ **Faster installs** (~2x faster than npm on Windows)
- ✅ **Disk efficient** (symlinks to global store)
- ✅ **Strict dependencies** (prevents phantom dependencies)
- ✅ **Workspace support** (built-in mono-repo support)

**Alternative:** npm (most compatible with Electron tooling, but slower)

---

## electron-builder Configuration

Already configured in `package.json`:

```json
{
  "build": {
    "appId": "com.smartkhata.pos",
    "productName": "SmartKhata",
    "directories": {
      "output": "release",
      "buildResources": "resources"
    },
    "win": {
      "target": ["nsis", "portable"],
      "icon": "resources/icons/icon.ico"
    }
  }
}
```

**Why electron-builder?**
- ✅ Most popular Electron packaging tool
- ✅ Supports NSIS installer + portable exe
- ✅ Auto-update support (for future)
- ✅ Code signing support (for future)

**Alternative:** electron-forge (more opinionated, heavier)

---

## Next Steps

### 1. Verify Electron launches
```bash
# This will fail until we create the entry point files
pnpm dev
```

**Expected error:** Cannot find module (because src files don't exist yet)

### 2. Create minimal entry point files
- `src/main/index.ts` ✅ (already created)
- `src/preload/index.ts` (needs creation)
- `src/renderer/index.tsx` (needs creation)
- `src/renderer/index.html` (needs creation)

### 3. Test development mode
```bash
pnpm dev
```

---

## Troubleshooting

### pnpm not found after installation

**Fix (Windows):**
```bash
# Close and reopen terminal
# Or add to PATH manually
```

### Electron download fails

**Fix:**
```bash
# Use npm mirror (if needed)
pnpm config set electron_mirror https://npmmirror.com/mirrors/electron/
pnpm install
```

### TypeScript errors

**Expected:** TypeScript errors are normal until we run `pnpm install`
**Fix:** Already resolved by installing dependencies

---

## Installation Summary

| Package | Version | Purpose |
|---------|---------|---------|
| **electron** | 34.0.0 | Desktop framework |
| **electron-builder** | 25.1.8 | Packaging & distribution |
| **react** | 18.3.1 | UI framework |
| **vite** | 6.0.5 | Build tool & dev server |
| **typescript** | 5.7.2 | Type safety |
| **pnpm** | 10.29.1 | Package manager |

**Status:** ✅ All core dependencies installed and ready

---

**Completed:** 2026-02-08  
**Time taken:** ~2 minutes  
**Next task:** Create minimal React entry point files
