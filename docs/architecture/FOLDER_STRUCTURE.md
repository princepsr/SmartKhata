# Mono-Repo Folder Structure

## Overview

This document defines the folder structure for the SmartKhata Electron POS application, following clean architecture principles with clear separation between main process, renderer, and shared code.

---

## Complete Folder Tree

```
SmartKhata/
├── src/
│   ├── main/                      # Electron main process (Node.js)
│   │   ├── index.ts               # Entry point
│   │   ├── services/              # Business logic layer
│   │   │   ├── product-service.ts
│   │   │   ├── billing-service.ts
│   │   │   ├── customer-service.ts
│   │   │   ├── supplier-service.ts
│   │   │   ├── purchase-service.ts
│   │   │   ├── purchase-order-service.ts
│   │   │   ├── medical-service.ts
│   │   │   ├── kirana-service.ts
│   │   │   ├── barcode-service.ts
│   │   │   ├── credit-note-service.ts
│   │   │   ├── debit-note-service.ts
│   │   │   ├── inventory-service.ts
│   │   │   ├── report-service.ts
│   │   │   ├── export-service.ts
│   │   │   ├── print-service.ts
│   │   │   ├── settings-service.ts
│   │   │   ├── license-service.ts
│   │   │   ├── google-drive-service.ts
│   │   │   ├── backup-service.ts
│   │   │   └── update-service.ts
│   │   ├── repositories/          # Data access layer (SQLite)
│   │   │   ├── product-repository.ts
│   │   │   ├── bill-repository.ts
│   │   │   ├── customer-repository.ts
│   │   │   ├── inventory-repository.ts
│   │   │   ├── report-repository.ts
│   │   │   ├── credit-note-repository.ts
│   │   │   ├── purchase-repository.ts
│   │   │   └── base-repository.ts
│   │   ├── ipc/                   # IPC logic & handlers
│   │   │   ├── handlers/          # Specific logic handlers
│   │   │   ├── ipc-handler.ts     # Registry and base logic
│   │   │   └── index.ts           # Entry point
│   │   ├── database/              # Database setup & migrations
│   │   │   ├── connection.ts
│   │   │   ├── migrations/
│   │   │   │   ├── 001_initial_schema.sql
│   │   │   │   ├── 025_credit_notes.sql
│   │   │   │   └── 026_itc_purchases.sql
│   │   │   └── seeds/
│   │   │       └── dev-data.sql
│   │   ├── utils/                 # Main process utilities
│   │   │   ├── logger.ts
│   │   │   ├── printer.ts
│   │   │   └── file-system.ts
│   │   └── config/                # Configuration
│   │   │   ├── app-config.ts      # Environment-aware config
│   │   │   └── env-bundle.ts      # Baked-in production secrets
│   │
│   ├── renderer/                  # React UI (browser context)
│   │   ├── index.tsx              # React entry point
│   │   ├── App.tsx                # Root component
│   │   ├── pages/                 # Flat structure of page files
│   │   │   ├── OnboardingPage.tsx
│   │   │   ├── BillingPage.tsx
│   │   │   ├── ReportsPage.tsx
│   │   │   ├── ProductsPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── components/            # Reusable UI components
│   │   │   ├── ProductSearch/
│   │   │   │   ├── ProductSearch.tsx
│   │   │   │   └── index.ts
│   │   │   ├── CartItem/
│   │   │   ├── InvoicePrint/
│   │   │   └── common/            # Common UI elements
│   │   │       ├── Button/
│   │   │       ├── Input/
│   │   │       ├── Modal/
│   │   │       ├── PrivacyPolicy.tsx
│   │   │       ├── LoadingScreen.tsx
│   │   │       └── RestoreSuccessModal.tsx
│   │   ├── hooks/                 # Custom React hooks
│   │   │   ├── useIPC.ts
│   │   │   ├── useLocalStorage.ts
│   │   │   └── useLicense.ts
│   │   ├── services/              # Shared IPC abstractions
│   │   │   └── report-api.ts
│   │   ├── styles/                # Global styles
│   │   │   ├── global.css
│   │   │   ├── variables.css
│   │   │   └── themes.css
│   │   └── utils/                 # Renderer utilities
│   │       ├── formatters.ts
│   │       └── validators.ts
│   │
│   ├── preload/                   # Preload scripts (IPC bridge)
│   │   ├── index.ts               # Main preload script
│   │   └── ipc-channels.ts        # Channel name constants
│   │
│   └── shared/                    # Shared code (main + renderer)
│       ├── types/                 # product.types.ts, report.types.ts, etc.
│       │   ├── product.types.ts
│   │   │   ├── sales.types.ts
│   │   │   ├── customer.types.ts
│   │   │   └── common.types.ts
│       ├── constants/             # Shared constants
│       │   ├── ipc-events.ts
│       │   ├── app-constants.ts
│       │   └── validation-rules.ts
│       └── utils/                 # Pure utilities
│           ├── date-utils.ts
│           └── currency-utils.ts
│
├── resources/                     # Static assets
│   ├── icons/
│   │   ├── icon.ico
│   │   └── icon.png
│   ├── images/
│   └── installer/                 # Installer configurations
│       └── installer-config.json
│
├── database/                      # Database documentation
│   ├── schema.md                  # Schema documentation
│   └── sample-data/               # Sample data for testing
│
├── docs/                          # Project documentation
│   ├── ARCHITECTURE_DECISIONS.md
│   ├── CURRENT_ARCHITECTURE.md
│   ├── GST_REPORTING_GUIDE.md
│   ├── COMMAND_CENTER.md
│   ├── FOLDER_STRUCTURE.md
│   ├── UI_ARCHITECTURE.md
│   ├── GIT_WORKFLOW.md
│   └── API.md                     # IPC API documentation
│
├── scripts/                       # Build & utility scripts
│   ├── prepare-env.js             # Bakes .env into code
│   ├── build.js
│   ├── dev.js
│   └── migrate.js
│
├── tests/                         # Tests (mirrors src structure)
│   ├── services/                  # Integration tests
│   ├── unit/                      # Unit tests
│   └── utils/                     # Test db and helpers
│
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json                  # Root TypeScript config
├── tsconfig.main.json             # Main process config
├── tsconfig.renderer.json         # Renderer config
├── vitest.config.ts               # Global test config
├── vitest.unit.config.ts          # Pure unit test config
├── eslint.config.js
└── README.md
```

---

## Folder Responsibilities

### `src/main/` - Electron Main Process (Node.js)

**Purpose:** Backend logic, database access, system operations

| Folder          | Responsibility                    | Example                                                  |
| --------------- | --------------------------------- | -------------------------------------------------------- |
| `services/`     | Business logic, orchestration     | `product-service.ts` handles product CRUD + validation   |
| `repositories/` | Direct database access (SQLite)   | `product-repository.ts` executes SQL queries             |
| `ipc-handlers/` | Handle IPC requests from renderer | `product-handlers.ts` receives IPC calls, calls services |
| `database/`     | DB connection, migrations, seeds  | `connection.ts` manages SQLite connection pool           |
| `utils/`        | Main-specific utilities           | `printer.ts` handles thermal printer communication       |
| `config/`       | App configuration                 | `app-config.ts` loads settings from file/env             |

**Key Principles:**

- Services call repositories (never direct DB access from services)
- IPC handlers call services (thin layer, no business logic)
- All database code stays in `repositories/`

---

### `src/renderer/` - React UI (Browser Context)

**Purpose:** User interface, user interactions, display logic

| Folder               | Responsibility                | Example                                                |
| -------------------- | ----------------------------- | ------------------------------------------------------ |
| `pages/`             | Full-page components (routes) | `BillingPage.tsx` - main billing screen                |
| `components/`        | Reusable UI components        | `ProductSearch.tsx` - search widget                    |
| `components/common/` | Generic UI elements           | `Button.tsx`, `Modal.tsx`                              |
| `hooks/`             | Custom React hooks            | `useProducts.ts` - fetch products via IPC              |
| `services/`          | IPC wrappers (API layer)      | `product-api.ts` wraps `window.electron.getProducts()` |
| `styles/`            | Global CSS, themes            | `variables.css` - color palette, spacing               |
| `utils/`             | Renderer-specific utilities   | `formatters.ts` - format currency, dates               |

**Key Principles:**

- Pages compose components
- Components use hooks for data fetching
- Hooks call services (IPC wrappers)
- No direct IPC calls from components (use services)

---

### `src/preload/` - Preload Scripts (IPC Bridge)

**Purpose:** Secure bridge between main and renderer processes

| File              | Responsibility                                           |
| ----------------- | -------------------------------------------------------- |
| `index.ts`        | Exposes safe IPC methods to renderer via `contextBridge` |
| `ipc-channels.ts` | Defines IPC channel name constants                       |

**Example:**

```typescript
// preload/index.ts
contextBridge.exposeInMainWorld('electron', {
  getProducts: () => ipcRenderer.invoke('products:getAll'),
  createSale: (data) => ipcRenderer.invoke('sales:create', data),
});
```

---

### `src/shared/` - Shared Code (Main + Renderer)

**Purpose:** Code used by both main and renderer processes

| Folder       | Responsibility              | Example                                  |
| ------------ | --------------------------- | ---------------------------------------- |
| `types/`     | TypeScript interfaces/types | `product.types.ts` - `Product` interface |
| `constants/` | Shared constants            | `ipc-events.ts` - IPC channel names      |
| `utils/`     | Pure utility functions      | `date-utils.ts` - date formatting        |

**Key Principles:**

- No Node.js-specific code (must work in browser)
- No Electron-specific code
- Pure functions only

---

### `resources/` - Static Assets

**Purpose:** Icons, images, installer configurations

- `icons/` - App icons for Windows
- `images/` - Splash screens, logos
- `installer/` - Electron builder configs

---

### `database/` - Database Documentation

**Purpose:** Schema docs, sample data

- `schema.md` - Human-readable schema documentation
- `sample-data/` - Test data for development

---

### `docs/` - Project Documentation

**Purpose:** Architecture, API, workflows

- `ARCHITECTURE_DECISIONS.md` - Tech choices
- `GIT_WORKFLOW.md` - Git strategy
- `API.md` - IPC API documentation

---

### `scripts/` - Build & Utility Scripts

**Purpose:** Automation scripts

- `build.js` - Production build
- `dev.js` - Development server
- `migrate.js` - Run database migrations

---

### `tests/` - Test Files

**Purpose:** Unit and integration tests

- Mirrors `src/` structure
- `main/` - Test services, repositories
- `renderer/` - Test React components

---

## Data Flow Example

**User clicks "Add Product" in UI:**

```
1. BillingPage.tsx (renderer/pages)
   ↓ uses hook
2. useProducts.ts (renderer/hooks)
   ↓ calls service
3. product-api.ts (renderer/services)
   ↓ IPC call via preload
4. preload/index.ts
   ↓ forwards to main
5. product-handlers.ts (main/ipc-handlers)
   ↓ calls service
6. product-service.ts (main/services)
   ↓ validates, calls repository
7. product-repository.ts (main/repositories)
   ↓ executes SQL
8. SQLite database
```

---

## Future Extensibility

**For cloud sync (later):**

- Add `src/main/sync/` for sync logic
- Add `src/shared/types/sync.types.ts`
- Keep repositories unchanged (sync layer sits above)

**For plugins/extensions:**

- Add `src/main/plugins/` for plugin system
- Add `src/shared/plugin-api/` for plugin interfaces

---

## Summary

| Layer              | Location                 | Purpose                              |
| ------------------ | ------------------------ | ------------------------------------ |
| **UI**             | `src/renderer/`          | React components, pages, hooks       |
| **IPC Bridge**     | `src/preload/`           | Secure main ↔ renderer communication |
| **Business Logic** | `src/main/services/`     | Validation, orchestration            |
| **Data Access**    | `src/main/repositories/` | SQLite queries                       |
| **Shared**         | `src/shared/`            | Types, constants, pure utils         |

---

**Last updated:** 2026-02-27 (GST Robustness Fixed & Documented)
