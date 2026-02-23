# Customer Management & Ledger

This document describes how SmartKhata manages customer records, credit (udhaar), and transaction history.

---

## 👤 Customer Profiles

Each customer record stores:

- **Identification**: Name and unique Phone number.
- **Contact Details**: Optional Email and physical Address.
- **Financial Status**: `balance_due` (Real/Rupees).

### Balance Interpretation:

- **Positive Balance (`+ ₹X`)**: The customer owes money to the shop (Credit/Udhaar).
- **Negative Balance (`- ₹X`)**: The customer has paid in advance or has a credit note (Advance).

---

## 📒 The Ledger System

The ledger is a chronological record of all financial interactions with a customer.

### Atomic Entries

Whenever a bill is generated or a payment is received, a ledger entry is created **atomically** within the same database transaction. This ensures that the balance on the customer card always matches the sum of ledger entries.

### Entry Types:

1. **SALE**: Created when a bill is generated. Links directly to the `reference_id` (bill ID).
2. **PAYMENT_IN**: Created when a customer pays their pending balance.
3. **PAYMENT_OUT**: Created if the shop issues a refund or payout to the customer.
4. **OPENING_BALANCE**: Created when a customer is registered with a non-zero starting balance.

---

## 💳 Billing Integration (Udhaar Flow)

When finalizing a bill for a customer, the system checks the `paymentMode` and `paymentReceived`:

1. **Full Payment**: `paymentReceived == grandTotal`. Balance remains unchanged.
2. **Partial Payment**: `paymentReceived < grandTotal`. The difference is **added** to the customer's `balance_due`.
3. **Advance/Over-payment**: `paymentReceived > grandTotal`. The extra amount is **subtracted** from the `balance_due`.

---

## 🔍 Navigation & UX

- **Bill Links**: In the customer ledger, clicking a bill number instantly opens the detailed view of that specific transaction.
- **Quick Add**: Customers can be registered on-the-fly during the billing process.
- **History Integration**: Uses the same high-density table pattern as the Product History for visual consistency.

---

## 🛠️ Implementation References

- **Service**: `src/main/services/customer-service.ts`
- **Repository**: `src/main/repositories/customer-repository.ts`
- **UI**: `src/renderer/pages/CustomersPage.tsx`

---

**Last updated:** 2026-02-23  
**Status:** ✅ Extended profiles and integrated ledger verified.
