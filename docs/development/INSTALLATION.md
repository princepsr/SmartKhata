# Installation & Distribution (Technical Deployment)

SmartKhata follows a "Zero-Friction" installation philosophy for non-technical retail users while maintaining a robust, persistent back-end for accounting integrity.

---

## 1. Development Prerequisites

To ensure reproducible builds across different Windows environments, the following stack is mandatory:

| Tool | Version | Responsibility |
|------|---------|----------------|
| **Node.js** | `^20.0.0` | Runtime for build scripts and Main process. |
| **pnpm** | `^10.0.0` | Dependency manager (Strict symlinking prevents phantom dependencies). |
| **Git** | `^2.40.0` | Version control and release tagging. |

---

## 2. Dependency Management (`pnpm`)

SmartKhata uses `pnpm` specifically for its high-performance content-addressable storage on Windows.

- **Installation**: `pnpm install`
- **Store Verification**: If assets are missing or types mismatch, use `pnpm store prune` followed by `pnpm install`.
- **Pre-hooks**: `pnpm postinstall` automatically runs `electron-builder install-app-deps` to ensure that native C++ modules (like `better-sqlite3`) are compiled against the specific Electron headers.

---

## 3. NSIS Installer Architecture (Final Production)

The Windows installer is powered by NSIS (Nullsoft Scriptable Install System) with critical persistence overrides:

### Resilience Configuration
- **`perMachine: true`**: Installs to `C:\Program Files\SmartKhata`. This ensures that all Windows user accounts on the POS machine share the same application executable.
- **`allowToChangeInstallationDirectory: true`**: Allows retail owners to install on D: or E: drives if their primary C: drive (SSD) is small.
- **`deleteAppDataOnUninstall: false`**: **CRITICAL SECURITY FEATURE.** If the user uninstalls the app (e.g., for a clean reinstall), the SQLite database in `%APPDATA%` is **NOT** deleted. This prevents catastrophic loss of ledger data during troubleshooting.

### Persistence Geography
SmartKhata separates the "App" (read-only) from the "Data" (read-write):
- **App Binaries**: `C:\Program Files\SmartKhata`
- **User Data**: `%APPDATA%\SmartKhata\`
  - `database/`: Contains the encrypted SQLite master file.
  - `logs/`: Diagnostic rotation files (7-day retention).
  - `backups/`: Destination for automated daily ZIP snapshots.

---

## 4. Distribution Artifacts

The `pnpm build:win` command generates two distinct flavors in the `/release` folder:

| Artifact | Filename | Distribution Use Case |
|----------|----------|------------------------|
| **NSIS Setup** | `SmartKhata_Setup_v1.0_x64.exe` | Standard deployment. Handles start menu icons and file associations. |
| **Portable** | `SmartKhata_v1.0_Portable.exe` | "No-Touch" environments. Runs directly from a USB stick without writing to Program Files. |

---

## 5. Troubleshooting Windows Deployment

### Error: `better-sqlite3.node` missing
- **Cause**: Native module mismatch between Node and Electron.
- **Fix**: Run `pnpm postinstall` to trigger an auto-rebuild of the binary.

### Error: `App Data locked`
- **Cause**: Multiple instances of the app or another process (like an Antivirus) locking the SQLite file.
- **Fix**: Check Task Manager for zombie `smartkhata.exe` processes. SmartKhata includes a "Single Instance Lock" in `index.ts` to mitigate this.

---

## Technical Reference
- **Engine**: `electron-builder`
- **Bundler**: `vite`
- **Native Rebuilds**: `electron-rebuild` (via build-deps)
- **Installer Config**: `package.json#nsis`
