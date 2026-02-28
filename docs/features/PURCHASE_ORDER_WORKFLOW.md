# Purchase Order (PO) Technical Documentation

SmartKhata implements a structured procurement workflow through the Purchase Order module, allowing businesses to plan inventory intake before financial commitments (Purchases) are finalized.

---

## 1. Data Model & Architecture
Purchase Orders are decoupled from inventory totals to prevent "Ghost Stock" until items are physically received.
- **Header Table**: `purchase_orders` (Stores summary, status, and supplier link).
- **Items Table**: `purchase_order_items` (Stores line items with planned prices).
- **Status Lifecycle**:
    - `PENDING`: Order sent to supplier, awaiting delivery.
    - `RECEIVED`: Items have arrived; usually triggers a transition to a **Purchase Invoice**.
    - `CANCELLED`: Order voided; no stock or financial impact.

## 2. Key Technical Features

### sequential Number Generation
PO numbers follow a standardized format: `PO-[YEAR]-[SEQUENCE]` (e.g., `PO-2024-0012`).
- **Logic**: The `PurchaseOrderRepository` scans for the highest current sequence for the active year and increments by 1.
- **Ensures**: No gaps in procurement records and easier physical filing.

### Supplier Name Snapshotting
To prevent data loss if a supplier is renamed or deleted, the system stores a `supplier_name_snapshot` inside the `purchase_orders` table.
- **Impact**: historic POs always display the supplier name as it was at the time of order creation, even if the linked supplier record in the `suppliers` table changes.

### Atomic Persistence
Every PO creation is wrapped in a **Database Transaction**. 
- **Mechanism**: Header and Items are inserted in a single block. If an item fails validation, the entire header is rolled back, preventing orphaned "empty" orders.

## 3. The "PO to Purchase" Transition
While POs are planning tools, Purchases are financial realities.
- **Workflow**:
    1. UI fetches PO details via `getPurchaseOrderById`.
    2. Data is mapped to the `RecordPurchaseInput` structure.
    3. User verifies quantities and prices.
    4. `PurchaseService.recordPurchase()` is called.
    5. **Final Step**: PO status is updated to `RECEIVED`.

---

## Technical Maintenance Workflows

### Listing & Filtering
The `listPurchaseOrders()` query uses a `LEFT JOIN` on the `suppliers` table to fetch live contact details while falling back to the `supplier_name_snapshot` if the join returns null, ensuring robust data recovery.

### Implementation Consistency
All PO operations are implemented with `async/await` to prevent blocking the Main process during complex transaction writes.
