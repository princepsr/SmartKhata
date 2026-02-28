# Suppliers & Purchases (Accounts Payable) Technical Documentation

SmartKhata implements a complete **Supply Chain Management** suite enabling store owners to track what they buy, who they owe, and how much Input Tax Credit (ITC) they can claim.

---

## 1. Supplier Management (`suppliers` table)
Suppliers (Vendors, Distributors, Wholesalers) are managed as first-class entities with persistent financial states.

### Core Attributes
| Field | Type | Description |
|-------|------|-------------|
| `name` | TEXT | Primary identifier (Unique). |
| `phone` | TEXT | Contact number (Validated for 10 numeric digits). |
| `gstin` | TEXT | Tax ID (Critical for GSTR-3B Input Tax Credit). |
| `balance_due` | REAL | Running total of debt owed to the supplier. |
| `is_active` | INTEGER | Soft-delete flag (0 = Inactive, 1 = Active). |

### Automated Balance Reconciliation
The system maintains a running balance without requiring manual entries for every invoice.
- **Trigger**: `PurchaseService.recordPurchase()`.
- **Logic**: The `grandTotal` (Taxable + GST) is automatically added to the linked supplier's `balance_due`.
- **Payment Reversal**: Payments to suppliers or Debit Notes (Returns) decrement this balance via `SupplierService.updateBalance(id, -amount)`.

---

## 2. Purchases (Inward Invoicing)
Recording a Purchase is the formal financial recognition of incoming inventory and tax liability.

### Workflow:
1. **Invoice Capture**: User enters Supplier's `Invoice Number` and `Invoice Date`.
2. **Itemization**: Items mapping to the local `Products` table are added.
3. **Complex Tax Handling**:
   - Computes B2B GST (CGST/SGST or IGST based on configured Supply Type).
   - Rounds values to 2 decimal places to ensure ledger precision.
4. **Finalization (Atomic)**:
   - `supplier_balance` is increased.
   - `product_stock` is incremented.
   - `inventory_log` entry is generated.
   - Product `purchase_price` snapshot is updated to reflect the most recent cost.

---

## 3. Input Tax Credit (ITC) Tracking
A critical feature for Indian GST compliance. Every purchase tracks:
- `gst_total`, `cgst_amount`, `sgst_amount`, `igst_amount`.
- **GSTR-3B Integration**: `PurchaseService.getITCSummary()` aggregates these values, allowing the shop owner to calculate their total ITC offset against sales tax (Output GST).

---

## 4. Debit Notes (Purchase Returns)
If goods arrive damaged or expired, a **Debit Note** is issued to reconcile the accounts.
- **Service**: `DebitNoteService`.
- **Financial Impact**: Decrements Supplier's Balance Due.
- **Inventory Impact**: Deducts `stock_qty` from active inventory.
- **Compliance**: Reverses the ITC claim, ensuring accurate tax reporting.

---

## Technical Workflows

### Supplier Profile Validation
The `SupplierService` enforces name uniqueness and phone formatting (stripping spaces, hyphens, and parentheses) before database persistence.

### Soft Deletion Persistence
Suppliers are never purged from the database to maintain referential integrity of historical purchase records. Deactivation only hides them from the active UI.
