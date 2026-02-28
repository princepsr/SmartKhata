# BillingTransactionService - Atomic Transaction Flow

The `BillingTransactionService` is the application's most critical component, ensuring that every sale is processed with **ACID (Atomicity, Consistency, Isolation, Durability)** compliance. This document details the exact sequence of operations performed during a sale.

---

## 1. Execution Architecture

To minimize database lock contention, the service follows a **Three-Phase Execution** model:

### Phase 1: Pre-Transaction Preparation (Async)
Before starting the heavy-weight database transaction, the system performs non-locking asynchronous reads:
- **Config Fetch**: Retrieves `gstEnabled`, `supplyType`, and `billingOnly` mode.
- **Product Indexing**: Fetches all involved products by ID and creates a `Map<number, Product>` for $O(1)$ lookup.
- **Sequence Generation**: Generates the next `billNumber` (e.g., `BILL-20260228-0012`).

### Phase 2: Atomic Transaction (Synchronous)
The actual write operations are wrapped in a `databaseManager.transaction()` block. If any step fails, the entire sale is rolled back.

### Phase 3: Response Formatting
Data is mapped back to the IPC response format and sent to the Renderer.

---

## 2. Step-by-Step Transaction Sequence

Once the transaction starts, the following steps occur in strict order:

### Step A: Data Integrity Calculation
1.  **Calculate Preview**: The service invokes `calculateBillPreview` using the prepared product snapshots.
2.  **GST Mapping**: The total GST is split into `CGST`, `SGST`, and `IGST` based on the shop's `supplyType` (Intrastate vs Interstate).
3.  **Proportional Discounting**: Any global discount is weighted across items based on their contribution to the total gross amount.

### Step B: Persistence & Snapshotting
1.  **Header Creation**: The `bills` record is inserted with total sums, payment mode, and `round_off_amount`.
2.  **Item Snapshotting**: Each `bill_items` record is inserted. **CRITICAL**: The system snapshots the `productName`, `hsnCode`, `gstPercent`, and `purchasePrice` at this moment. 
    - *Why?* This ensures that historical reports remain accurate even if the product's name or price changes in the future.

### Step C: Context-Aware Table Updates
1.  **Stock Adjustment**: If `billingOnly` is disabled, the system decrements `stock_qty` in the `products` table.
2.  **Activity Tracking**: The `last_sale_date` for each product is updated to the current system date.
3.  **Customer Ledger**: If a customer is linked and `paymentReceived < grandTotal`, the `customers.balance` is incremented by the delta (the "Udhaar" amount).

---

## 3. ACID Guarantees & Recovery

### Atomicity (All or Nothing)
If the power fails or a "Unique Constraint" is hit (e.g., duplicate bill number) during Step B.2, the SQLite WAL-mode ensured that:
- No stock is deducted.
- No bill header remains in the database.
- The customer's balance is not touched.

### Consistency
The system prevents "Overselling" by performing stock checks inside the transaction block using the previously fetched product maps.

### Durability
SmartKhata uses `FULL` synchronous mode for SQLite. Once the `COMMIT` command returns success to the `BillingTransactionService`, the sale is physically written to the disk even if the application crashes immediately after.

---

## Technical Reference
- **Main Service**: `src/main/services/billing-transaction-service.ts`
- **Math Engine**: `src/shared/utils/billing-math.ts`
- **Database Wrapper**: `src/main/database/index.ts`
