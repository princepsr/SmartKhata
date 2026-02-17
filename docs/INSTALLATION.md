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

## Production Build & Distribution

Once development is complete, follow these steps to generate the production-ready installer for Windows.

### 1. Pre-Build Verification

Run the automated quality gates to ensure the code is stable:

```bash
pnpm release:check
```

### 2. Generate Installer

Run the distribution build command:

```bash
pnpm build:win
```

### 3. Distribution Artifacts

The build process generates artifacts in the `release/` directory:

| Artifact            | File Name                    | Purpose                                             |
| ------------------- | ---------------------------- | --------------------------------------------------- |
| **NSIS Installer**  | `SmartKhata Setup 1.0.0.exe` | Full installer for permanent PC setup.              |
| **Portable**        | `SmartKhata 1.0.0.exe`       | Single-file executable (no installation needed).    |
| **Update Metadata** | `latest.yml`                 | Used by auto-updater for background version checks. |

---

## Post-Installation Verification

### AppData Directory

After the first launch on a clean system, verify the local data directory:
**Path:** `%APPDATA%\SmartKhata\`

**Expected Files:**

- `database/smartkhata.db` (Initialized with migrations)
- `logs/APP.log` (Boot sequence records)
- `backups/` (Empty directory for auto-backups)

---

**Last updated:** 2026-02-18 (Phase 1 Complete)
**Status:** ✅ Production distribution pipeline verified
