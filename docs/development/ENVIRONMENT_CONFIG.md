# Environment & Configuration Management

SmartKhata uses a unified environment strategy that automatically handles the transition between local development and production-ready packaging.

---

## 🏗️ Configuration Architecture

The system relies on three distinct layers of configuration:

1.  **Compile-time Constants**: Shared values (versioning, feature flags) in `src/shared/constants/`.
2.  **Runtime Detection**: Environment sensing (`isDevelopment`) in `src/main/config/app-config.ts`.
3.  **Secure Secrets**: Baked-in `.env` values that are obfuscated during the production build.

---

## ⚡ Environment Switching (Dev vs Prod)

The application detects its state via `process.env.NODE_ENV`.

### 1. Development Mode
- **Triggers**: `pnpm dev` or `NODE_ENV=development`.
- **Renderer**: Loads from the Vite dev server at `http://localhost:5173`.
- **Database**: Stores data in the project root: `SmartKhata/dev-data/smartkhata.db`.
- **Features**: Auto-opens DevTools, enables Hot Module Replacement (HMR), and allows verbose logging.

### 2. Production Mode
- **Triggers**: Packaged `.exe` or `NODE_ENV=production`.
- **Renderer**: Loads the pre-built `dist/renderer/index.html` via `loadFile()`.
- **Database**: Stores data in the official Windows app data directory: `%APPDATA%/SmartKhata/data/`.
- **Features**: Disabled DevTools, optimized code, and silent operation.

---

## 💾 Path Resolution Table

| Resource | Development Path | Production Path |
| :--- | :--- | :--- |
| **Database** | `dev-data/smartkhata.db` | `%APPDATA%/SmartKhata/data/` |
| **Logs** | `logs/app_dev.log` | `%APPDATA%/SmartKhata/logs/` |
| **Backups** | `dev-data/backups/` | `%APPDATA%/SmartKhata/backups/` |
| **Renderer URL** | `http://localhost:5173` | `file://.../index.html` |

---

## 🔐 Secure Secret Baking

To prevent plain-text `.env` files from leaking into production, SmartKhata uses a **Secure Baking** process:

1.  **Pre-build**: `scripts/prepare-env.js` reads your local `.env`.
2.  **Bake**: Values are written to a temporary `env-bundle.ts` inside the source tree.
3.  **Obfuscate**: The production build step runs a JavaScript Obfuscator that encrypts these strings within the final binary.
4.  **Runtime**: The `EnvLoader` detects the missing `.env` in production and automatically fallbacks to reading the baked-in bundle.

---

## 🛠️ Usage in Code

### Checking Environment
```typescript
import { configManager } from './config/app-config';
const { isDevelopment } = configManager.getConfig();

if (isDevelopment) {
  console.log('Running in debug mode');
}
```

### Accessing Paths
Always use the `configManager` rather than hardcoding paths.

```typescript
const dbPath = configManager.getConfig().databasePath;
const db = new Database(dbPath);
```

---

**Last Updated**: 2026-02-28
**Primary Files**: `src/main/config/app-config.ts`, `src/main/env-loader.ts`
