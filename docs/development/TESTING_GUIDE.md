# Testing Guide (Advanced Methodology)

SmartKhata uses a high-fidelity testing strategy to ensure that critical POS logic (Billing, GST, Inventory) is 100% reliable without requiring the full Electron environment to be launched for every test.

---

## 1. The Virtualized Environment (`tests/setup.ts`)

To achieve high-speed testing, the system virtualizes the Electron and OS layers using Vitest's mocking engine.

### Electron Simulation

The `electron` module is globally mocked to decouple logic from the OS:

- **Virtualized Filesystem**: `app.getPath('userData')` is redirected to a local `test-data/` directory.
- **UI Decoupling**: `dialog` and `BrowserWindow` are replaced with spies (`vi.fn()`) to verify that the UI would have been triggered without actually opening windows.

### Database Mocking & WASM Integration

The `databaseManager` is redirected to use `sql.js` (a WASM-based SQLite driver) in `:memory:` mode.

- **Environment Agnostic**: Switched from `better-sqlite3` to `sql.js` for testing to resolve Node ABI mismatches between Electron and system Node environments.
- **Compatibility Wrapper**: A `SqlJsDatabase` wrapper in `tests/utils/test-db.ts` mimics the `better-sqlite3` API, supporting named parameters and transactions.
- **Atomic Transactions**: The test runner simulates SQL transactions by manually executing `BEGIN`, `COMMIT`, and `ROLLBACK` around test functions. This ensures a clean state for every test.
- **Migration Bypass**: `migrationRunner` is mocked to assume the schema is already at the latest version, significantly reducing test suite startup time.

---

## 2. Testing Methodology

### Unit vs. Integration

- **Unit Tests**: Focus on pure math (e.g., `billing-math.test.ts`). These have zero dependencies and run in milliseconds.
- **Service Integration Tests**: Focus on the flow between Business Logic and the Database (e.g., `product-service.test.ts`). These use the in-memory SQLite instance.

### The "Seed" Pattern

Every integration test suite follows the **Seed-Before-Test** pattern:

1. `createTestDatabase()`: Boots a fresh in-memory SQLite.
2. `seedTestData()`: Injects a standard set of "Test Product", "Test Customer", and "Default Settings".
3. **Execution**: The test runs against known data constants.
4. `resetTestDatabase()`: Destroys the in-memory instance.

---

## 3. Coverage & Quality Gates

SmartKhata enforces strict coverage requirements during the `pnpm release:check` command.

| Layer          | Requirement | Why?                                                                       |
| -------------- | ----------- | -------------------------------------------------------------------------- |
| **Core Math**  | 100%        | Even a 1-paisa rounding error is unacceptable in accounting.               |
| **Services**   | >90%        | Must cover all "Happy Path" and "Edge Case" (Stock-out, Expiry) scenarios. |
| **Migrations** | 100%        | Every SQL script must be verified for syntax and constraint integrity.     |

---

## 4. Debugging failing tests

### Advanced CLI Filtering

- **By Filename**: `pnpm test <filename>`
- **By Test Name**: `pnpm test -t "should calculate GST"`
- **By Module**: `pnpm test src/main/services/billing`

### The Vitest UI

Running `pnpm test:ui` provides a real-time dashboard where you can:

- View Console/Log output per test.
- Inspect the "Module Graph" to see which files are being pulled in.
- Time individual tests to identify performance bottlenecks in SQL logic.

---

## Technical Reference

- **Test Runner**: Vitest
- **Mocking Strategy**: `tests/setup.ts`
- **Database Utilities**: `tests/utils/test-db.ts`
- **CI Config**: `.github/workflows/tests.yml`
