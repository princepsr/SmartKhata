# 🤖 SmartKhata Agent Development Guide (Enterprise Edition)

Welcome to the **SmartKhata Agentic Development Ecosystem**. This comprehensive guide defines the architectural standards, coding rules, and contribution workflows required for AI Agents (like Antigravity/Claude) to build and maintain high-performance features in SmartKhata.

---

## 1. Product Brief: "The SmartKhata Way"

SmartKhata is a **local-first, 0-latency POS** built specifically for Windows-based Retail and Pharmacy businesses.

### Core Value Pillars for Agents:

- **0-Latency Billing**: Every millisecond counts. Calculations (Totals/Taxes) must happen in the UI instantly, providing immediate feedback (Optimistic State) before the transaction reaches the database.
- **Offline First**: The app must remain functional without internet. Data integrity is managed locally via SQLite.
- **Premium Aesthetics**: Business software shouldn't look boring. Leverage glassmorphism, smooth gradients, and micro-animations. Avoid generic UI frameworks; use Vanilla CSS for a "Wow" experience.
- **Keyboard-First UX**: Speed is king. Every major action must be reachable via shortcuts (F-keys, Enter, Esc).
- **Data Sovereignty**: The user owns their data. Local backups and direct SQLite access are core features.

---

## 2. Technical Stack (The Agent's Toolkit)

| Layer            | Technologies             | Purpose                                                      |
| :--------------- | :----------------------- | :----------------------------------------------------------- |
| **Shell**        | Electron                 | Native Windows window management and OS integration.         |
| **Frontend**     | React 18, Vite           | High-performance, reactive UI with instant hot-reload.       |
| **Global State** | Zustand                  | Lightweight store for active bills, settings, and UI states. |
| **Routing**      | React Router 6           | Client-side navigation with layout persistence.              |
| **Database**     | SQLite, `better-sqlite3` | Zero-config, ACID-compliant local persistence.               |
| **Styling**      | Vanilla CSS, CSS Modules | Zero-runtime CSS with design token support.                  |
| **Validation**   | Zod                      | Type-safe IPC payloads and form validation.                  |
| **Languages**    | TypeScript (Strict)      | End-to-end type safety across Main and Renderer.             |
| **I18n**         | `react-i18next`          | Localization for English and Hindi markets.                  |

---

## 3. High-Level Architecture (The Triple-Layer Cake)

SmartKhata follows a strict separation of concerns. Agents must respect these boundaries:

### 🧱 Main Process (The Brain)

- **IPC Handlers** (`src/main/ipc/handlers/`): The "Controllers". They listen for UI requests, validate payloads (using Zod), and delegate logic to Services.
- **Services** (`src/main/services/`): The "Orchestrators". They contain all business logic (e.g., "Is the discount valid?", "Update this customer's balance"). They manage transactions and cross-repository operations. **NEVER write SQL here.**
- **Repositories** (`src/main/repositories/`): The "Data Accessors". They contain raw SQL queries. All repositories extend `BaseRepository` to leverage prepared statement caching.
- **Database Manager** (`src/main/database/`): Manages the SQLite connection, migrations, and transactional integrity.

### 🌓 Shared Layer (The Bridge)

- **Types** (`src/shared/types/`): Centralized TypeScript interfaces for all entities (Product, Bill, Customer). These ensure the Main and Renderer processes are always in sync.
- **IPC Channels** (`src/shared/ipc/channels.ts`): The single source of truth for all communication channel names.
- **Zod Schemas** (`src/shared/validation/`): Shared schemas for validating data at both the form (UI) and IPC (Main) levels.
- **Shared Utils** (`src/shared/utils/`): Pure logic that both Main and Renderer need (e.g., `billing-math.ts`).

### 🎨 Renderer Process (The Face)

- **Pages** (`src/renderer/src/pages/`): Stateful containers for major routes (Billing, Inventory, Reports).
- **Components** (`src/renderer/src/components/`): Reusable UI units (Buttons, Modals, Product Cards).
- **Hooks** (`src/renderer/src/hooks/`): Encapsulated UI logic (e.g., `useBarcodeScanner`, `usePrinter`).
- **IPC Wrappers** (`src/renderer/src/services/`): Typed wrappers that make calling the Main process feel like a standard library.
- **Zustand Stores** (`src/renderer/src/store/`): Global state (e.g., the current active bill, shop settings).

---

## 4. Coding Standards & Conventions

### 🏷️ Naming Strategy

- **File Names**: Always use `kebab-case.ts` (e.g., `billing-transaction-service.ts`, `product-card.tsx`).
- **Classes & Types**: Always use `PascalCase` (e.g., `BaseRepository`, `ProductItem`).
- **Methods & Variables**: Always use `camelCase` (e.g., `calculateGst`, `isStockLow`).
- **Constants**: Always use `SCREAMING_SNAKE_CASE` (e.g., `GST_PERCENT_18`, `MAX_ITEM_LIMIT`).
- **SQL Tables**: Always use `snake_case` (e.g., `bill_items`, `inventory_logs`).

### ⚠️ Error Handling (The Standard)

We never use generic `throw new Error()` in production.

1.  **Repository Layer**: Throws `DatabaseError` (SQL errors, constraint violations).
2.  **Service Layer**: Throws typed business errors (e.g., `InsufficientStockError`, `DuplicateSkuError`, `InvalidLicenseError`).
3.  **IPC Layer**: The `IPCHandler` automatically catches all errors and sanitizes them into a standard `IPCResponse` format:
    ```json
    { "success": false, "error": "User-friendly message extracted from the error object" }
    ```
4.  **UI Layer**: Use the `UIStore.setError()` to show a global toast notification.

---

## 5. Architectural Blueprints (Pattern Rules)

Instead of copying boilerplate, Agents must follow these structural rules:

### 🛡️ Database & Repository Rules

- **Prepared Statements**: All queries must use `BaseRepository` methods (`queryOne`, `queryAll`, `execute`). SQL String concatenation is **STRICTLY FORBIDDEN**.
- **Transactions**: Multi-write operations (e.g., Sale + Stock Update) MUST be inside a transaction. Use `this.dbRepo.transaction(() => { ... })`.
- **Date Handling**: Store dates in SQLite as `YYYY-MM-DD HH:MM:SS` (Local Time). Use `this.formatDateForSql(new Date())` from `BaseRepository`.
- **Migrations**: Found in `src/main/database/migrations/`. Never edit a committed migration; create a new incremented file.

### 🌓 IPC Communication Flow

1.  **Channel Entry**: Add channel to `src/shared/ipc/channels.ts` in `domain:action` format.
2.  **Main Handler**: Register in `src/main/ipc/handlers/` using `IPCHandler.handle`.
    - **Agent Instruction**: Always provide a `schema` (Zod) and a `timeout` (default 5-30s).
3.  **Renderer Service**: Expose in `src/renderer/src/services/` as a static async method.
    - **Agent Instruction**: All UI calls must return `Promise<IPCResponse<T>>`.

### 🎨 State & UI Pattern

- **Centralized Math**: Complex calculations (Tax, Discounts) belong in `src/shared/utils/billing-math.ts`.
- **Optimistic UI**: When adding a product to a bill, calculate the total in the Zustand store (`useCurrentBillStore`) using `billing-math.ts` for instant feedback.
- **Vanilla CSS**: Use CSS Variables (`--color-primary`, `--spacing-md`) for consistency. Stick to the design tokens in `index.css`.
- **Keyboard Shortcuts**: Every button in a POS flow should have a shortcut (e.g., `F12` for Pay).

---

## 6. The "Golden Rules" (Crucial for Agents)

### ✅ THE "DO" LIST

- **Logic in Services**: If a business rule changes (e.g., "Max discount ₹500"), the code MUST sit in a `Service`.
- **SQL in Repositories**: All `SELECT/INSERT/UPDATE` must be encapsulated in a repository method.
- **0-Latency Math**: Always calculate totals in the Renderer for instant feedback.
- **Atomic Transactions**: If you save a Bill, you MUST also log Inventory and update Ledgers in the same transaction.
- **Shared Types**: Use the interfaces in `src/shared/types/` for all cross-process data.

### ❌ THE "DON'T" LIST

- **NO SQL in Services**: Never write a raw string like `"SELECT * FROM..."` inside a service class.
- **NO Business Logic in UI**: React components should call a Service Wrapper, not calculate taxes or check stock.
- **NO Hardcoded Strings**: If it's visible, it belongs in `en.json` (English) and `hi.json` (Hindi).
- **NO Generic Errors**: Avoid `catch(e) { console.log(e) }`. Either handle it or throw a typed error.
- **NO Heavy Libraries**: Avoid `lodash`, `moment`, or `tailwind`. Use native JS, `date-fns`, and Vanilla CSS.

---

## 7. Operational Workflow for Agents

Agents should follow this cycle to maximize accuracy and minimize regressions:

### 🔍 Step 1: Research & Discovery

- Check `audit_suite.sql` to understand table relationships.
- Search for "Examples" in the codebase (e.g., `product-handlers.ts` for IPC patterns).

### 📝 Step 2: Planning (PLANNING Mode)

- Create `implementation_plan.md` documenting:
  - New/Modified IPC channels.
  - Schema updates.
  - Business logic changes in Services.
- Create `task.md` with granular steps.

### 🛠️ Step 3: Implementation (EXECUTION Mode)

- Follow the flow: `Migration` -> `Repository` -> `Service` -> `IPC Handler` -> `Renderer Service` -> `Zustand Store` -> `UI Component`.
- **Testing**: Create unit tests in `tests/` simultaneously with the service/repo logic.
- **Documentation**: Update relevant `.md` files in `docs/` as you write the code.
- Use `pnpm copy:seeds` frequently to sync SQL assets with the `dist` folder.

### 🛡️ Step 4: Verification (VERIFICATION Mode)

- **Automated Tests**: Run `pnpm test:run` and ensure all tests pass.
- **Data Integrity**: Run `audit_suite.sql` to ensure no data discrepancies.
- **Manual Proof**: Create a `walkthrough.md` with a summary of changes and validation results.

---

## 8. Product Module Map (Core Tables)

Understanding these 19 tables is essential for any technical agent:

| Area            | Key Tables                    | Purpose                                                  |
| :-------------- | :---------------------------- | :------------------------------------------------------- |
| **Catalog**     | `products`                    | Master registry. MRPS, Sale-Prices, and Stock levels.    |
| **Sales**       | `bills`, `bill_items`         | Every POS transaction. Stores snapshots of prices/taxes. |
| **Returns**     | `credit_notes`, `debit_notes` | Reverse transactions. Updates stock and ledgers.         |
| **Procurement** | `purchases`, `purchase_items` | Stock inward. Updates costs and supplier balance.        |
| **Entities**    | `customers`, `suppliers`      | Party masters. Stores current `balance_due`.             |
| **Finance**     | `ledger`, `expenses`          | Every movement (Sale, Payment) creates a ledger entry.   |
| **Audit**       | `inventory_logs`              | Every stock change (+ or -) must be logged here.         |
| **System**      | `app_config`, `license`       | Shop settings (GSTIN, Logo) and activation.              |

---

## 9. Performance Guarantees (The Metrics)

- **UI Interaction**: < 16ms (60 FPS) for all visual feedback.
- **IPC Round-trip**: < 50ms for standard CRUD operations.
- **Database Search**: < 100ms for searching 10,000 products.
- **App Boot**: < 3.0s from click to "Ready" state.

---

## 10. Frequently Asked Questions (FAQ)

**Q: Why don't we use nested transactions?**
**A**: `better-sqlite3` does not support nested transactions by default. Always initiate transactions at the top level of your service logic and do not call `transaction()` inside another transaction block.

**Q: How do I handle rounding for GST?**
**A**: Never round intermediate taxable amounts. Round ONLY at the final Payable and Tax components for each line. Distributed discounts must be spread across items _before_ tax extraction.

**Q: Can I use `any` in TypeScript?**
**A**: Absolutely NO. Use `unknown` if necessitated, but always strive for a proper interface in `src/shared/types/ipc.ts`.

---

## 11. Standardized Workflows (Blueprints)

When performing common tasks, agents must touch these files in order:

### 🆕 Adding a New Data Field

1. **Shared Type**: Update interface in `src/shared/types/ipc.ts`.
2. **Main Migration**: Create new SQL in `src/main/database/migrations/`.
3. **Repository**: Update `INSERT/UPDATE` queries and `Model` mapping.
4. **IPC Schema**: Update Zod validation in `src/shared/validation/`.
5. **Renderer Store**: Update Zustand state and actions.
6. **UI Component**: Add input field with proper i18n key.

### 🛠️ Creating a New IPC Channel

1. **Shared Channels**: Register `domain:action` in `src/shared/ipc/channels.ts`.
2. **Main Handler**: Register in `src/main/ipc/handlers/` using `IPCHandler.handle`.
3. **Renderer Service**: Create typed wrapper in `src/renderer/src/services/`.

---

## 12. Technical Pitfalls & Anti-Patterns

- **Direct Window Access**: Never call `window.api.invoke` directly from a React component. Use a Service Wrapper.
- **SQL Injection**: Never use backticks ` ` or `+` to build SQL queries. Use `?` placeholders.
- **Floating Numbers**: Use `Math.round(val * 100) / 100` for currency. Never compare floats directly using `===`.
- **Main Thread Blocking**: Perform heavy data parsing (like Excel imports) in chunks or optimized loops to prevent UI freezing.
- **Missing Seeds**: If you add a table, you MUST update `quickstart.sql` so the feature is testable immediately.

---

## 13. Documentation Standards (Living Knowledge)

SmartKhata maintains a high-quality documentation suite in `/docs/`. Agents MUST update documentation when making changes:

### 📝 Core Documentation Files

- **App Metadata**: `docs/development/APP_METADATA.md` (Update for version/config changes).
- **Database Schema**: `docs/database/DATABASE_SCHEMA.md` (Update for ANY table/column changes).
- **IPC Client**: `docs/development/RENDERER_IPC_CLIENT.md` (Update when adding/modifying IPC channels).
- **Service Rules**: `docs/development/SERVICE_LAYER_RULES.md` (Update for new business logic patterns).
- **UI Architecture**: `docs/development/UI_ARCHITECTURE.md` (Update for new UI patterns).

### 🛠️ Agent Rule: "Code + Doc"

A feature is NOT complete until its corresponding documentation is updated. Always search for relevant `.md` files in `docs/` before finishing a task.

---

## 14. Testing Standards (The Quality Shield)

We use **Vitest** for automated testing. No major service or repository function should be added without a test.

### 🧪 Test Structure

- **Location**: `tests/` directory at the root (mirrors the `src/` structure).
- **Naming**: `[feature-name].test.ts`.
- **Framework**: Vitest (Jest-compatible API).

### 🛡️ Mandatory Test Scenarios

1. **Success Paths**: Verify the normal operation (e.g., Bill created successfully).
2. **Error Handling**: Verify that typed errors (e.g., `InsufficientStockError`) are thrown correctly.
3. **Database Constraints**: Verify that uniqueness or NOT NULL constraints are respected.
4. **Calculations**: Verify math in `billing-math.ts` with edge cases (0 quantity, 100% discount, etc.).

### 🚀 Running Tests

- Run all tests: `pnpm test:run`
- Run in watch mode: `pnpm test:watch`
- Check coverage: `pnpm test:coverage`

## 15. Operational Workflow for Agents (Advanced)
