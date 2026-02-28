# Current Architecture (As of 2026-02-27 - Phase 1.2)

## Overview

SmartKhata POS follows a **layered architecture** with clear separation of concerns between UI, business logic, and data access.

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     UI Layer (Renderer)                       │
│      React + TypeScript + Zustand + Error Boundary            │
│                                                                │
│  Components → Hooks → State Management → API Client          │
│  Navigation: Command Center (Ctrl+K)                         │
└──────────────────────────────────────────────────────────────┘
                            ↓
                    window.api.xxx()
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                   Preload Script (Bridge)                     │
│              Secure IPC Exposure (contextBridge)              │
└──────────────────────────────────────────────────────────────┘
                            ↓
                    ipcRenderer.invoke()
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                    IPC Layer (Main)                           │
│         IPCHandler → Validation → Error Mapping               │
│                                                                │
│  Features:                                                    │
│  - 30s Timeouts on all requests                              │
│  - Automatic PII Sanitization in logs                        │
│  - User-safe Error conversion                                 │
└──────────────────────────────────────────────────────────────┘
                            ↓
                  Service Method Calls
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                   Service Layer (Main)                        │
│         Business Logic + Validation + Hardening               │
│                                                                │
│  Services:                                                    │
│  - StabilityService (Watchdog, Memory, Resource Tracking)     │
│  - Support Services (Product, Billing, Customer, Returns, etc.)│
│  - PrintService (Hidden Windows + Cleanup Timeouts)           │
└──────────────────────────────────────────────────────────────┘
                            ↓
                Repository Method Calls
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                 Repository Layer (Main)                       │
│              SQL Queries + Domain Mapping                     │
└──────────────────────────────────────────────────────────────┘
                            ↓
                    SQL Execution
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                    Database Layer                             │
│       SQLite + WAL Checkpointing + Integrity Checks           │
└──────────────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities

### 1. UI Layer (Renderer Process)

**Technology:** React + TypeScript + Zustand

**Responsibilities:**

- ✅ Display data to user
- ✅ Collect user input
- ✅ Manage UI state
- ✅ Call IPC methods via `window.api`
- ❌ NO business logic
- ❌ NO direct database access
- ❌ NO SQL queries

**Example:**

```typescript
const createProduct = async (productData) => {
  const result = await window.api.product.create(productData);

  if (!result.success) {
    alert(result.error);
    return;
  }

  // Update UI state
  setProducts([...products, result.data]);
};
```

---

### 2. Preload Script (Bridge)

**Technology:** Electron contextBridge

**Responsibilities:**

- ✅ Expose secure IPC methods to renderer
- ✅ Validate channel names
- ✅ Prevent arbitrary IPC calls
- ❌ NO business logic
- ❌ NO data transformation

**Example:**

```typescript
contextBridge.exposeInMainWorld('api', {
  product: {
    create: (data) => ipcRenderer.invoke('product:create', data),
    list: () => ipcRenderer.invoke('product:list'),
  },
});
```

---

### 3. IPC Layer (Main Process)

**Technology:** Electron ipcMain + Custom IPCHandler

**Responsibilities:**

- ✅ Orchestrate service calls
- ✅ Validate input (schema validation)
- ✅ Handle service errors
- ✅ Convert errors to user-friendly messages
- ✅ Format responses
- ❌ NO business logic
- ❌ NO SQL queries
- ❌ NO calculations

**Example:**

```typescript
IPCHandler.handle('product:create', async (request) => {
  try {
    const product = productService.addProduct(request);
    return { success: true, data: product };
  } catch (error) {
    if (error instanceof DuplicateEntryError) {
      return {
        success: false,
        error: 'This SKU is already in use',
        errorCode: 'DUPLICATE_ENTRY',
      };
    }
    return { success: false, error: getUserFriendlyMessage(error) };
  }
});
```

---

### 4. Service Layer (Main Process)

**Technology:** TypeScript Classes

**Responsibilities:**

- ✅ Validate business rules
- ✅ Perform calculations
- ✅ Orchestrate multiple repositories
- ✅ Throw typed errors
- ✅ Maintain business logic
- ❌ NO SQL queries
- ❌ NO UI logic
- ❌ NO IPC handling

**Services:**

| Service                  | Responsibilities                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| **ProductService**       | Product CRUD, stock adjustments, duplicate prevention, margin calculation                                      |
| **BillingService**       | Bill calculations, finalization, validation, bill number generation                                            |
| **CustomerService**      | Customer CRUD, phone validation, balance tracking, detailed transaction ledgers                                |
| **SupplierService**      | Vendor CRUD, payables tracking, ledgers                                                                        |
| **PurchaseService**      | Recording supplier invoices, ITC calculation, and net GST liability mapping                                    |
| **PurchaseOrderService** | Managing Draft/Pending supply requests and receiving goods                                                     |
| **MedicalService**       | Domain logic for Pharmacies (Salt dictionaries, Scheduled-H drug warnings, Expiry tracking)                    |
| **KiranaService**        | Domain logic for Grocery (Serial Port weighing scale readers, offline metrics)                                 |
| **BarcodeService**       | Generating and mapping printable sticker barcodes offline                                                      |
| **ReportService**        | Data aggregation for sales, GST, payment modes, Profit & Loss analysis, and trend analytics                    |
| **ExportService**        | CSV/PDF generation, Tesseract.js OCR Pipeline for offline scanned invoice imports                              |
| **PrintService**         | Thermal receipt formatting, printer driver communication, status checks                                        |
| **SettingsService**      | Configuration management, caching, validation, Domain Setup States                                             |
| **LicenseService**       | License validation, expiry checking, machine binding, redundant marker persistence, and anti-time-tamper logic |
| **GoogleDriveService**   | Secure OAuth 2.0 based automated cloud state replication and backup synchronization                            |
| **UpdateService**        | Background version checking, `autoUpdater` event handling, and update log integration                          |
| **BackupService**        | Atomic database archival and ZIP-based restoration flow                                                        |
| **CreditNoteService**    | Sales returns reversal, linked bill validation, and GST reversal math                                          |
| **DebitNoteService**     | Purchase returns against Suppliers, Input Tax Credit Reversals                                                 |

**Example:**

```typescript
export class BillingService extends BaseService {
  public finalizeBill(input: FinalizeBillInput): BillWithItems {
    // 1. Validate
    this._validateBillNumber(input.billNumber);
    this._validatePaymentMode(input.paymentMode);

    // 2. Check stock availability
    input.items.forEach((item) => {
      const product = this.productRepo.findById(item.productId);
      if (product.stockQty < item.quantity) {
        throw new InsufficientStockError(product.id, product.name, product.stockQty, item.quantity);
      }
    });

    // 3. Execute atomic transaction
    return this.transactionService.createSale(saleInput);
  }
}
```

---

### 5. Repository Layer (Main Process)

**Technology:** TypeScript Classes + better-sqlite3

**Responsibilities:**

- ✅ Execute SQL queries
- ✅ Map database rows to domain objects
- ✅ Handle transactions
- ✅ Enforce data integrity
- ❌ NO business logic
- ❌ NO validation
- ❌ NO calculations

**Repositories:**

| Repository               | Responsibilities                                          |
| ------------------------ | --------------------------------------------------------- |
| **ProductRepository**    | Product CRUD, stock updates, SKU/barcode lookup           |
| **BillRepository**       | Bill creation, queries, sales summaries                   |
| **CustomerRepository**   | Customer CRUD, balance updates, phone lookup              |
| **InventoryRepository**  | Inventory logging, stock history                          |
| **ReportRepository**     | Advanced aggregation, GST slabs, and trend analytics data |
| **SettingsRepository**   | Key-value storage, UPSERT operations                      |
| **LicenseRepository**    | Single-row license management                             |
| **CreditNoteRepository** | Sales return storage and bill linking                     |
| **PurchaseRepository**   | Supplier purchase storage and ITC tracking                |

**Example:**

```typescript
export class ProductRepository extends BaseRepository {
  public create(data: CreateProductInput): Product {
    const sql = `
      INSERT INTO products (name, sale_price, gst_percent, stock_qty)
      VALUES (?, ?, ?, ?)
    `;

    const result = this.execute(sql, [
      data.name,
      data.salePrice, // Direct Rupees
      data.gstPercent, // Direct Percent
      data.stockQty,
    ]);

    return this.findById(result.lastInsertRowid)!;
  }
}
```

---

### 6. Database Layer

**Technology:** SQLite (better-sqlite3)

**Configuration:**

- WAL mode (Write-Ahead Logging) with explicit `TRUNCATE` checkpointing on shutdown
- FULL synchronous mode for ACID compliance
- Foreign keys enabled
- Busy timeout: 5000ms with secondary app-level retry logic
- Mandatory integrity checks on startup if "clean.exit" marker is missing

**Schema:**

- 12 tables (products, customers, bills, bill_items, inventory_logs, settings, license, schema_migrations, credit_notes, credit_note_items, purchases, purchase_items)
- Monetary values stored as decimals (rupees)
- Percentages stored as percentage (e.g., 18.0)
- Timestamps stored as ISO 8601 strings

---

## Data Flow Examples

### Example 1: Create Product

```
1. UI: User fills product form
   ↓
2. UI: window.api.product.create({ name, price, ... })
   ↓
3. Preload: ipcRenderer.invoke('product:create', data)
   ↓
4. IPC: productService.addProduct(data)
   ↓
5. Service: Validate name, price, check duplicate SKU
   ↓
6. Service: productRepo.create(data)
   ↓
7. Repository: INSERT INTO products ...
   ↓
8. Database: Execute SQL, return lastInsertRowid
   ↓
9. Repository: Map row to Product domain object
   ↓
10. Service: Return Product
    ↓
11. IPC: { success: true, data: product }
    ↓
12. UI: Display success message, update product list
```

---

### Example 2: Create Bill (Complex Transaction)

```
1. UI: User adds items to cart, clicks "Complete Sale"
   ↓
2. UI: window.api.bill.create({ items, paymentMode, ... })
   ↓
3. Preload: ipcRenderer.invoke('bill:create', data)
   ↓
4. IPC: billingService.finalizeBill(data)
   ↓
5. Service: Validate bill number, payment mode, items
   ↓
6. Service: Check stock availability for all items
   ↓
7. Service: billingTransactionService.createSale(data)
   ↓
8. Transaction Service: BEGIN TRANSACTION
   ↓
9. Transaction Service: billRepo.createBillWithItems(...)
   ↓
10. Transaction Service: productRepo.updateStock(...) for each item
    ↓
11. Transaction Service: inventoryRepo.logChange(...) for each item
    ↓
12. Transaction Service: customerRepo.updateBalance(...)
    ↓
13. Transaction Service: COMMIT
    ↓
14. Service: Return BillWithItems
    ↓
15. IPC: { success: true, data: { bill, items } }
    ↓
16. UI: Print receipt, clear cart, show success
```

---

## Error Handling

### Error Flow

```
Service throws typed error
   ↓
IPC catches error
   ↓
IPC converts to user-friendly message
   ↓
IPC returns { success: false, error: "message", errorCode: "CODE" }
   ↓
UI displays error to user
```

### Error Types

| Error Class                | Usage                 | Example                                             |
| -------------------------- | --------------------- | --------------------------------------------------- |
| `ValidationError`          | Invalid input         | "Product name is required"                          |
| `NotFoundError`            | Entity not found      | "Product not found"                                 |
| `DuplicateEntryError`      | Duplicate entry       | "This SKU is already in use"                        |
| `InsufficientStockError`   | Not enough stock      | "Not enough stock for Coca Cola. Only 5 available." |
| `InactiveEntityError`      | Entity is inactive    | "This product is inactive"                          |
| `CreditLimitExceededError` | Credit limit exceeded | "Customer credit limit exceeded"                    |
| `LicenseError`             | License issue         | "License has expired"                               |
| `StabilityError`           | Resource limits       | "System memory limit exceeded"                      |

### Global Hardening

- **Main Process Boundary**: `uncaughtException` and `unhandledRejection` hooks trigger a controlled graceful shutdown.
- **Renderer Boundary**: High-level React Error Boundary captures UI crashes and provides a "Click to Restore" recovery flow.
- **IPC Timeout**: All IPC requests race against a 30s timeout to prevent UI hangs.

---

## Testing Strategy

### Unit Tests (Vitest)

**Test Database:** In-memory SQLite

**Test Coverage:**

- ✅ BillingService (22 tests)
- ✅ ProductService (18 tests)
- ✅ CustomerService (12 tests)
- ✅ LicenseService (10 tests)
- ✅ CreditNoteService (12 tests)
- ✅ PurchaseService (10 tests)

**Run Tests:**

```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
```

---

## Key Design Decisions

### 1. Service Layer

**Why:** Separate business logic from data access and UI

**Benefits:**

- Testable without UI or database
- Reusable across multiple IPC handlers
- Centralized business rules
- Typed errors

### 2. Typed Errors

**Why:** Provide structured error information

**Benefits:**

- User-friendly messages
- Error codes for UI handling
- Context for debugging
- Type safety

### 3. In-Memory Caching (Settings)

**Why:** Avoid repeated database queries for settings

**Benefits:**

- Fast reads
- Reduced database load
- Automatic cache invalidation on writes

### 4. Atomic Transactions

**Why:** Ensure data consistency

**Benefits:**

- All-or-nothing operations
- Automatic rollback on error
- Data integrity

---

## Documentation Index

### Core Architecture

- [`CURRENT_ARCHITECTURE.md`](./CURRENT_ARCHITECTURE.md) - This document
- [`ARCHITECTURE_DECISIONS.md`](./ARCHITECTURE_DECISIONS.md) - Architecture decisions
- [`FOLDER_STRUCTURE.md`](./FOLDER_STRUCTURE.md) - Project structure

### Service Layer

- [`SERVICE_LAYER_RULES.md`](../development/SERVICE_LAYER_RULES.md) - Service layer rules
- [`SERVICE_ERROR_FLOW.md`](./SERVICE_ERROR_FLOW.md) - Error handling
- [`IPC_SERVICE_MAPPING.md`](./IPC_SERVICE_MAPPING.md) - IPC to service mapping
- [`SERVICE_LAYER_TESTING.md`](../development/SERVICE_LAYER_TESTING.md) - Testing strategy
- [`REPORTS_ARCHITECTURE.md`](../features/REPORTS_ARCHITECTURE.md) - Reporting and Analytics
- [`SETTINGS_ARCHITECTURE.md`](../development/SETTINGS_ARCHITECTURE.md) - Settings UI & Patterns
- [`PRINT_SERVICE.md`](../features/PRINT_SERVICE.md) - Printing and Receipt formatting
- [`BACKUP_RESTORE.md`](../database/BACKUP_RESTORE.md) - Backup & Restore Architecture
- [`TAXATION_AND_DISCOUNTS.md`](../features/TAXATION_AND_DISCOUNTS.md) - GST Models and Discount Logic
- [`CUSTOMER_MANAGEMENT.md`](../features/CUSTOMER_MANAGEMENT.md) - Profiles and Ledger Integration
- [`SECURITY_AND_VALIDATION.md`](../security/SECURITY_AND_VALIDATION.md) - Zod and IPCHandler Middleware
- [`UI_PATTERNS.md`](../development/UI_PATTERNS.md) - Loading, Pagination, and Resilience

### Repository Layer

- [`REPOSITORY_RULES.md`](../database/REPOSITORY_RULES.md) - Repository rules
- [`BASE_REPOSITORY.md`](../database/BASE_REPOSITORY.md) - Base repository
- [`DATABASE_TRANSACTIONS.md`](../database/DATABASE_TRANSACTIONS.md) - Transactions

### Database

- [`DATABASE_SCHEMA.md`](../database/DATABASE_SCHEMA.md) - Schema documentation
- [`DATABASE_MIGRATIONS.md`](../database/DATABASE_MIGRATIONS.md) - Migration system

### IPC

- [`IPC_ARCHITECTURE.md`](../security/IPC_ARCHITECTURE.md) - IPC architecture
- [`IPC_HANDLER_FRAMEWORK.md`](../security/IPC_HANDLER_FRAMEWORK.md) - Handler framework

---

## Summary

**SmartKhata POS uses a clean, layered architecture:**

```
UI → IPC → Service → Repository → Database
```

**Each layer has clear responsibilities:**

- **UI**: Display and collect data
- **IPC**: Orchestrate and handle errors
- **Service**: Business logic and validation
- **Repository**: SQL queries and mapping
- **Database**: Data storage

**This architecture ensures:**

- ✅ Separation of concerns
- ✅ Testability
- ✅ Maintainability
- ✅ Type safety
- ✅ Error handling
