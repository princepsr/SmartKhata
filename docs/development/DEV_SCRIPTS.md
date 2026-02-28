# Development Scripts & Build Pipeline (Technical Deep-Dive)

SmartKhata uses a professional-grade build pipeline designed for source protection, architectural integrity, and automated quality assurance.

---

## 1. Development Workflow (`pnpm dev`)

The development environment is orchestrated using `concurrently` to synchronize the Renderer and Main processes.

| Process | Component | Port / Command | Role |
|---------|-----------|----------------|------|
| **Renderer** | Vite | `:5173` | Serves React with Hot Module Replacement (HMR). |
| **Main** | `tsc-watch` | `dist/main/` | Compiles Node.js background logic on every save. |
| **Electron** | `electron .` | N/A | Launches the shell once the Vite server is healthy. |

**Path Resolution**: The `tsc-alias` utility is used during development to resolve `@shared` and `@main` path aliases, ensuring that the compiled JavaScript can locate modules without standard TypeScript runtime support.

---

## 2. Production Build Pipeline (`pnpm build`)

The production build is a multi-stage process designed to generate a secure, minified, and obfuscated distribution.

### Stage 1: Environment Preparation
Executes `scripts/prepare-env.js` to inject build-time constants (e.g., Version, Build Date) and ensure required directories exist.

### Stage 2: Renderer Compilation
Runs `vite build`. This bundles React, minifies CSS, and performs tree-shaking on 3rd-party libraries. Output is saved to `dist/renderer/`.

### Stage 3: Main Process Compilation & Obfuscation
1.  **Transpilation**: `tsc` converts TypeScript to clean JavaScript in `dist/main/`.
2.  **Alias Resolution**: `tsc-alias` replaces all path aliases with relative directory paths.
3.  **Migration Sync**: `copyfiles` moves `.sql` migration files into the `dist/main` folder for runtime database initialization.
4.  **Source Protection**: `javascript-obfuscator` is invoked with high-security parameters:
    - `--self-defending`: Prevents code from running if it's been prettified or tampered with.
    - `--string-array-encoding base64`: Hides sensitive strings (SQL queries, IPC channels).
    - `--string-array-threshold 0.75`: Obfuscates 75% of all strings.

---

## 3. Quality Gates (`pnpm release:check`)

Before any code is packaged, it must pass the "Quality Gate" which enforces three layers of correctness:
1.  **Linting**: `eslint` checks for anti-patterns and code style violations.
2.  **Type Safety**: `tsc --noEmit` verifies that all cross-process type definitions are strictly followed.
3.  **Unit Testing**: `vitest run` executes the full test suite and requires 100% pass rate.

---

## 4. Packaging & Distribution (`pnpm build:win`)

SmartKhata uses `electron-builder` to generate two distinct distribution flavors:

### NSIS Installer (Setup.exe)
- **Mode**: Per-Machine installation (prevents permission issues).
- **Persistent Data**: Configured via `deleteAppDataOnUninstall: false` to ensure user databases survive app updates/reinstalls.
- **Shortcuts**: Automatically creates Desktop and Start Menu entries.

### Portable Executable (Portable.exe)
- **Target**: Quick demonstrations or systems with strict installation policies.
- **Compression**: `maximum` compression level applied to minimize file size.

---

## 🛠️ Technical Reference
- **Config**: `package.json` -> `"build"` section.
- **Main Compiler**: `tsconfig.main.json`.
- **Renderer Compiler**: `tsconfig.renderer.json` + `vite.config.ts`.
- **Release Automation**: `scripts/release.js`.
