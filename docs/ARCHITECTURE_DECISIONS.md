# Architecture Decisions

**Rationale:**

- **Tightly coupled components**: Electron main/renderer/preload share types and interfaces
- **Simpler CI/CD**: Single build pipeline, no version sync issues
- **Faster development**: Refactor across boundaries without managing multiple repos
- **TypeScript benefits**: Shared types between main and renderer processes

**Structure:**

```
SmartKhata/
├── src/
│   ├── main/          # Electron main process (Node.js)
│   ├── renderer/      # React UI
│   ├── preload/       # Preload scripts (IPC bridge)
│   └── shared/        # Shared types, constants, utilities
├── resources/         # Icons, assets, installers
├── database/          # SQLite schema, migrations, seeds
└── docs/              # Documentation
```

**Alternative considered:** Multi-repo (main + renderer separate)

- ❌ Overkill for small team
- ❌ Adds complexity (version sync, type sharing)
- ❌ Only beneficial for large teams or microservices

---

### 2. Package Manager: **pnpm** ✅

**Decision:** pnpm

**Rationale:**

- **Disk efficiency**: Symlinks to global store (important for low-end PCs)
- **Faster installs**: ~2x faster than npm, especially on Windows
- **Strict dependency resolution**: Prevents phantom dependencies
- **Workspace support**: Built-in mono-repo support
- **Growing adoption**: Industry trend, good tooling support

**Configuration:**

- Workspaces for organizing main/renderer if needed
- Lockfile committed to repo (`pnpm-lock.yaml`)

**Alternatives considered:**

- **npm**: ❌ Slower, larger `node_modules`, but most compatible
- **yarn**: ❌ Good but pnpm is faster on Windows and more efficient

**Fallback:** If pnpm causes issues with Electron tooling, switch to npm (most battle-tested with Electron)

---

### 3. Folder Naming Conventions

**Decision:** kebab-case for folders, PascalCase for React components

**Rules:**

```
src/
├── main/
│   ├── services/           # Business logic (kebab-case)
│   ├── repositories/       # Data access (kebab-case)
│   ├── ipc-handlers/       # IPC handlers (kebab-case)
│   └── utils/              # Utilities (kebab-case)
├── renderer/
│   ├── components/         # React components (kebab-case folder)
│   │   ├── BillingScreen/  # PascalCase component folder
│   │   │   ├── BillingScreen.tsx
│   │   │   ├── BillingScreen.module.css
│   │   │   └── index.ts
│   ├── hooks/              # Custom hooks (kebab-case)
│   ├── pages/              # Page components (kebab-case)
│   └── styles/             # Global styles (kebab-case)
├── preload/
│   └── index.ts            # IPC bridge
└── shared/
    ├── types/              # TypeScript types (kebab-case)
    ├── constants/          # Constants (kebab-case)
    └── utils/              # Shared utilities (kebab-case)
```

**File naming:**

- React components: `ComponentName.tsx` (PascalCase)
- Services/Repos: `product-service.ts` (kebab-case)
- Types: `product.types.ts` (kebab-case)
- Tests: `product-service.test.ts` (kebab-case)

**Rationale:**

- **Consistency**: Matches Node.js/npm conventions
- **Cross-platform**: Avoids case-sensitivity issues (though Windows-only, good practice)
- **Readability**: Clear separation between React (PascalCase) and Node (kebab-case)

---

---

### 4. Service Layer Architecture ✅

**Decision:** Three-layer architecture (UI → IPC → Service → Repository → Database)

**Rationale:**

- **Separation of concerns**: Business logic separated from data access
- **Testability**: Services can be tested independently without UI or database
- **Reusability**: Services can be called from multiple IPC handlers
- **Maintainability**: Business rules centralized in one place
- **Type safety**: Strongly typed errors and responses

**Architecture:**

```
┌─────────────────────────────────────────┐
│              UI (Renderer)              │
│         React Components + State        │
└─────────────────────────────────────────┘
                    ↓
            window.api.xxx()
                    ↓
┌─────────────────────────────────────────┐
│          IPC Layer (Main)               │
│      Handles IPC Communication          │
└─────────────────────────────────────────┘
                    ↓
          Service Method Call
                    ↓
┌─────────────────────────────────────────┐
│        Service Layer (Main)             │
│      Business Logic + Validation        │
└─────────────────────────────────────────┘
                    ↓
        Repository Method Calls
                    ↓
┌─────────────────────────────────────────┐
│      Repository Layer (Main)            │
│         SQL Queries + Mapping           │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         SQLite Database                 │
└─────────────────────────────────────────┘
```

**Layer Responsibilities:**

- **IPC**: Orchestration, error handling, response formatting
- **Service**: Business logic, validation, calculations, cross-entity operations
- **Repository**: SQL queries, data mapping, transactions

**Benefits:**

- ✅ Business logic is testable (in-memory database)
- ✅ IPC handlers are thin (no business logic)
- ✅ Repositories are thin (no business logic)
- ✅ Errors are typed and user-friendly
- ✅ Easy to add new features

**Alternative considered:** Direct IPC → Repository

- ❌ Business logic scattered across IPC handlers
- ❌ Difficult to test
- ❌ Code duplication
- ❌ Violates single responsibility principle

**See:** [`SERVICE_LAYER_RULES.md`](./SERVICE_LAYER_RULES.md), [`IPC_SERVICE_MAPPING.md`](./IPC_SERVICE_MAPPING.md)

---

### 5. Taxation & Discount Distribution ✅

**Decision:** Proportional discount distribution across line items.

**Rationale:**

- **GST Compliance**: Tax must be calculated on the net taxable value after discounts.
- **Accuracy**: Distributing global discounts to items ensures the taxable base is reduced appropriately for each GST slab.
- **Traceability**: Allows for precise calculation of tax liability at the line-item level.

---

### 6. Historical Profit Integrity ✅

**Decision:** Cost-price (`purchase_price`) snapshotting at the moment of sale.

**Rationale:**

- **Business Transparency**: Ensures profit reports for previous months remain accurate even if current product costs change.
- **Data Integrity**: Decouples historical performance from future price fluctuations.
- **Reporting Clarity**: Allows for "Coverage" metrics to be calculated reliably by checking for snapshots in historical data.

---

## Summary

| Decision            | Choice                            | Why                                  |
| ------------------- | --------------------------------- | ------------------------------------ |
| **Repo structure**  | Mono-repo                         | Small team, tightly coupled, simpler |
| **Package manager** | pnpm                              | Fast, efficient, Windows-friendly    |
| **Architecture**    | Service Layer                     | Separation of concerns, testability  |
| **Folder naming**   | kebab-case (PascalCase for React) | Consistent, readable, conventional   |

---

**Last updated:** 2026-02-23
**Status:** ✅ Modern POS architecture with robust taxation logic verified
