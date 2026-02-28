# Supplier Management Technical Documentation

SmartKhata tracks vendor relationships through a centralized Supplier Management module. This document details how supplier profiles, outstanding balances, and purchase connections are maintained.

---

## 1. Profile Data Structure
Suppliers are stored in the `suppliers` table with the following core attributes:
| Field | Type | Description |
|-------|------|-------------|
| `name` | TEXT | Primary identifier (Mandatory). |
| `phone` | TEXT | Unique contact number (Validated for 10 digits). |
| `gstin` | TEXT | Tax ID (Used for GSTR-3B Input Tax Credit). |
| `balance_due` | REAL | Total amount we owe to the supplier. |
| `is_active` | INTEGER | Soft-delete flag (0 = Inactive, 1 = Active). |

## 2. Automated Balance Reconciliation
The system maintains a running balance for each supplier to track debts/credits without requiring manual ledger entries.
- **Trigger**: When a Purchase Invoice is recorded via `PurchaseService.recordPurchase()`.
- **Calculations**:
    1. System computes the `grandTotal` of the purchase (Taxable + GST).
    2. If a `supplierId` is provided, `supplierRepo.updateBalance(id, grandTotal)` is called.
    3. The `balance_due` is incremented by the invoice total.
- **Payment Impact**: When a manual payment (Cash/Cheque) is made to the supplier, the balance is decremented via the `SupplierService.updateBalance(id, -amount)` method.

## 3. Input Tax Credit (ITC) Linking
Suppliers are critical for GST compliance.
- **Mechanism**: Every `purchase` record is linked to a `supplier_name` and `supplier_gstin`.
- **Reporting**: The `PurchaseService.getITCSummary()` method aggregates GST amounts from all purchases linked to valid suppliers, forming the basis for **GSTR-3B Filing**.

---

## Technical Maintenance Workflows

### Supplier Profile Validation (`SupplierService`)
Before persistence, the service enforces:
1. **Name Uniqueness**: Prevents duplicate vendor names.
2. **Phone Validation**: Strips non-numeric characters and enforces a 10-digit format.
3. **Active Check**: Blocks updates or balance changes for inactive suppliers.

### Soft Deletion
Suppliers are never truly deleted from the database to maintain referential integrity of historical purchases.
- **Action**: `updateSupplier(id, { isActive: false })`.
- **Effect**: Supplier no longer appears in dropdowns or search results, but remains in the `suppliers` table for audit logs.
