# SmartKhata Technical Design Patterns

This document outlines the core architectural patterns and engineering principles used across the SmartKhata codebase to ensure reliability, security, and local-first performance.

---

## 1. Clean Layered Architecture
The application follows a strict unidirectional flow to separate concerns and simplify testing.
- **Renderer (UI)**: React components + Custom Hooks. Never contains SQL or FS logic. Communication is strictly via IPC.
- **Preload (Secure Bridge)**: Exposes a hardened `ipcClient` to the renderer, ensuring `contextIsolation` is maintained.
- **IPC Handlers (Main)**: Orchestrates requests from the UI. Maps IPC calls to Service methods.
- **Service Layer (Logic)**: Contains business rules, validations (Zod), and complex flows (e.g., Billing Transaction). **Services are stateful where necessary but usually coordinate between repositories.**
- **Repository Layer (Data)**: The single source of truth for SQL. Maps database rows to Domain Types. Handles ACID transactions.
- **Database (SQLite)**: Persists data using `better-sqlite3` in WAL mode for concurrent high-speed access.

## 2. Atomic Transaction Pattern
To prevent data corruption during complex operations (like finishing a bill), we use an **Atomic Persistence** pattern.
- **Implementation**: The Repository layer uses `this.transaction(() => { ... })` from `better-sqlite3`.
- **Scope**: A single "Finish Bill" operation updates:
    1. `bills` (Insert header).
    2. `bill_items` (Insert line entries).
    3. `inventory_logs` (Record stock deltas).
    4. `products` (Decrement stock).
    5. `customer_ledger` (Update balance).
- **Rule**: If any step fails, the entire transaction rolls back, leaving the database in a consistent state.

## 3. Monetary Integrity (Rupee-First)
Unlike legacy systems that store values in `Paise` (integers), SmartKhata uses a `REAL` (decimal) approach for 1:1 Rupee mapping while enforcing precision.
- **Precision**: All financial calculations use `Math.round(value * 100) / 100` to prevent floating-point drift.
- **Immutable Totals**: Once a Bill or Purchase is finalized, its `grand_total` and tax amounts are immutable. Edits are handled via Credit/Debit notes.

## 4. Proportional Tax & Discount Distribution
To ensure "Total GST" matches the sum of line items exactly, we use proportional distribution.
- **Algorithm**:
    1. Calculate total taxable amount.
    2. Apply global discount proportionally to each item.
    3. Calculate GST on the *discounted* line total.
    4. Sum up line items for the final header total.
- **Impact**: Ensures that when calculating Input Tax Credit (ITC), the numbers perfectly match the supplier's invoice.

## 5. Local-First Sync Architecture (Phase 1-2)
- **WAL Mode**: `PRAGMA journal_mode = WAL` allows readers and writers to operate simultaneously without locking.
- **Atomic Backups**: The system bundles the SQLite file + App Settings + Logs into a single ZIP for Google Drive synchronization, ensuring a "Snapshot" recovery model rather than incremental sync (which is prone to conflict).

## 6. Secure Licensing & Anti-Tamper
- **Hardware Binding**: License keys are unique to the motherboard/CPU fingerprint.
- **Triple Redundancy**: Verification markers are stored in the AppData, LocalAppData, and Windows Registry to prevent "Trial Resetting" via folder deletion.
- **High-Water Mark Clock**: Tracks the latest used time locally. If the System Clock is moved backward, the app detects the discrepancy and blocks access until the clock is corrected.

---

## Pattern Summary Table
| Pattern | Location | Benefit |
|---------|----------|---------|
| Repository | `src/main/repositories` | Decouples SQL from Business Logic. |
| Dependency Injection | `src/main/ipc/handlers` | Easy swapping of services for testing. |
| Schema Migration | `src/main/database/migrations` | Safe, versioned database upgrades. |
| Hook-based IPC | `src/renderer/hooks` | Clean UI code without Electron leak. |
