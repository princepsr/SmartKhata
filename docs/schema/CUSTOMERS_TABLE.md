# Customers Table Design

## Overview

The `customers` table stores customer information with simple udhaar (credit) tracking for kirana shops. The design prioritizes simplicity and phone-based lookup.

---

## Table Definition

```sql
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  balance_due INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Column Specifications

### Primary Key

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique customer identifier |

---

### Identification Fields

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `name` | TEXT | NOT NULL | Customer name (e.g., "Ramesh Kumar") |
| `phone` | TEXT | UNIQUE | Phone number (primary lookup field) |

**Design Choices:**

**`name` (Required):**
- Always required for identification
- No length limit (TEXT type)
- Used in receipts and reports

**`phone` (Optional but Unique):**
- Primary lookup method in POS (faster than name search)
- UNIQUE constraint prevents duplicate phone numbers
- NULL allowed for walk-in customers
- Format: Store as-is (no validation in DB, handle in app)
  - Example: "9876543210" or "+91-9876543210"
  - Recommendation: Store normalized (digits only) in app layer

**Why phone is optional:**
- Walk-in customers may not provide phone
- Some customers prefer not to share phone
- Flexibility for different shop policies

---

### Udhaar (Credit) Tracking

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `balance_due` | INTEGER | NOT NULL, DEFAULT 0 | Outstanding balance in paise |

**Design Choices:**

**INTEGER Storage (Paise):**
- Stored in paise for precision (same as all monetary values)
- Positive = Customer owes money
- Negative = Customer has advance payment
- Zero = No outstanding balance

**Balance Semantics:**

| Value | Paise | Rupees | Meaning |
|-------|-------|--------|---------|
| `50000` | 50000 | ₹500.00 | Customer owes ₹500 |
| `0` | 0 | ₹0.00 | No outstanding balance |
| `-20000` | -20000 | -₹200.00 | Customer paid ₹200 advance |

**Why allow negative values:**
- Some customers pay in advance
- Simplifies accounting (single field instead of separate "advance" field)
- Easy to calculate: `balance_due += sale_total - payment_received`

**NOT NULL with DEFAULT 0:**
- Every customer must have a balance (even if zero)
- New customers start with zero balance
- Prevents NULL confusion

---

### Status & Audit Fields

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `is_active` | INTEGER | NOT NULL, 0 or 1 | Soft delete flag |
| `created_at` | TEXT | NOT NULL | Creation timestamp (ISO 8601) |
| `updated_at` | TEXT | NOT NULL | Last update timestamp (ISO 8601) |

**Same as products table** (see DATABASE_SCHEMA_RULES.md)

---

## Indexes

### Performance Indexes

```sql
-- Phone lookup (primary search in POS)
CREATE INDEX idx_customers_phone ON customers(phone);

-- Name search (autocomplete, reports)
CREATE INDEX idx_customers_name ON customers(name);

-- Active filter
CREATE INDEX idx_customers_is_active ON customers(is_active);
```

### Partial Index for Udhaar Reports

```sql
CREATE INDEX idx_customers_balance_due 
ON customers(balance_due) 
WHERE is_active = 1 AND balance_due > 0;
```

**Why this index:**
- Optimizes "customers with outstanding balance" queries
- Partial index (only active customers with debt)
- Smaller index size (excludes paid-up and inactive customers)

---

## Balance Due Usage

### How Udhaar Works

**Scenario 1: Credit Sale (Udhaar)**

```typescript
// Customer buys ₹500 worth of goods on credit
const saleTotal = 50000; // ₹500.00 in paise
const paymentReceived = 0; // No payment

// Update customer balance
db.execute(`
  UPDATE customers 
  SET balance_due = balance_due + ?, 
      updated_at = datetime('now')
  WHERE id = ?
`, [saleTotal - paymentReceived, customerId]);

// Result: balance_due increases by 50000 paise
```

**Scenario 2: Partial Payment**

```typescript
// Customer buys ₹500 but pays ₹300
const saleTotal = 50000;      // ₹500.00
const paymentReceived = 30000; // ₹300.00

// Update customer balance
db.execute(`
  UPDATE customers 
  SET balance_due = balance_due + ?, 
      updated_at = datetime('now')
  WHERE id = ?
`, [saleTotal - paymentReceived, customerId]);

// Result: balance_due increases by 20000 paise (₹200.00)
```

**Scenario 3: Payment Against Old Debt**

```typescript
// Customer pays ₹500 against old debt
const paymentReceived = 50000; // ₹500.00
const saleTotal = 0;           // No new sale

// Update customer balance
db.execute(`
  UPDATE customers 
  SET balance_due = balance_due - ?, 
      updated_at = datetime('now')
  WHERE id = ?
`, [paymentReceived, customerId]);

// Result: balance_due decreases by 50000 paise
```

**Scenario 4: Advance Payment**

```typescript
// Customer pays ₹1000 in advance (no sale yet)
const paymentReceived = 100000; // ₹1000.00
const saleTotal = 0;

// Update customer balance
db.execute(`
  UPDATE customers 
  SET balance_due = balance_due - ?, 
      updated_at = datetime('now')
  WHERE id = ?
`, [paymentReceived, customerId]);

// Result: balance_due becomes negative (-100000 paise = -₹1000.00)
```

---

### Udhaar Reports

**Get all customers with outstanding balance:**

```sql
SELECT 
  id, 
  name, 
  phone, 
  balance_due,
  ROUND(balance_due / 100.0, 2) as balance_rupees
FROM customers
WHERE is_active = 1 AND balance_due > 0
ORDER BY balance_due DESC;
```

**Get total outstanding amount:**

```sql
SELECT 
  COUNT(*) as customer_count,
  SUM(balance_due) as total_due_paise,
  ROUND(SUM(balance_due) / 100.0, 2) as total_due_rupees
FROM customers
WHERE is_active = 1 AND balance_due > 0;
```

**Get customers with advance payments:**

```sql
SELECT 
  id, 
  name, 
  phone, 
  ABS(balance_due) as advance_paise,
  ROUND(ABS(balance_due) / 100.0, 2) as advance_rupees
FROM customers
WHERE is_active = 1 AND balance_due < 0
ORDER BY balance_due ASC;
```

---

## Key Design Decisions

### 1. No Credit Limit Field

**Rationale:**
- Kirana shops typically don't enforce strict credit limits
- Trust-based relationships with customers
- Shop owner decides case-by-case

**If needed later:**
```sql
ALTER TABLE customers ADD COLUMN credit_limit INTEGER CHECK(credit_limit >= 0);
```

**Then enforce in application:**
```typescript
if (customer.balance_due + saleTotal > customer.credit_limit) {
  throw new Error('Credit limit exceeded');
}
```

---

### 2. No Address/Email Fields

**Rationale:**
- Kirana shops rarely need customer addresses
- Email not commonly used
- Keeps schema simple

**If needed later:**
```sql
ALTER TABLE customers ADD COLUMN address TEXT;
ALTER TABLE customers ADD COLUMN email TEXT;
```

---

### 3. No GSTIN Field (Yet)

**Rationale:**
- Most kirana customers are B2C (no GSTIN needed)
- Can add later for B2B customers

**If needed later:**
```sql
ALTER TABLE customers ADD COLUMN gstin TEXT;
CREATE INDEX idx_customers_gstin ON customers(gstin);
```

---

### 4. Phone as TEXT (Not INTEGER)

**Rationale:**
- Phone numbers can start with 0 (e.g., "0987654321")
- May include country code (e.g., "+91-9876543210")
- May include formatting (e.g., "98765-43210")
- TEXT is more flexible

**Recommendation:**
- Store normalized (digits only) in application layer
- Display formatted in UI

---

## Usage Examples

### Create Customer

```typescript
const customer = {
  name: 'Ramesh Kumar',
  phone: '9876543210',
  balance_due: 0  // New customer, no balance
};

db.execute(`
  INSERT INTO customers (name, phone, balance_due)
  VALUES (?, ?, ?)
`, [customer.name, customer.phone, customer.balance_due]);
```

### Lookup by Phone

```typescript
// Primary lookup method in POS
const customer = db.queryOne(`
  SELECT * FROM customers 
  WHERE phone = ? AND is_active = 1
`, [phone]);

if (!customer) {
  // Customer not found, create new or use walk-in
}
```

### Search by Name

```typescript
// Autocomplete search
const customers = db.queryAll(`
  SELECT id, name, phone, balance_due
  FROM customers 
  WHERE name LIKE ? AND is_active = 1
  ORDER BY name
  LIMIT 10
`, [`%${searchTerm}%`]);
```

### Update Balance (Credit Sale)

```typescript
// Customer buys on credit
const saleTotal = 50000; // ₹500.00
const paymentReceived = 0;

db.execute(`
  UPDATE customers 
  SET balance_due = balance_due + ?, 
      updated_at = datetime('now')
  WHERE id = ?
`, [saleTotal - paymentReceived, customerId]);
```

### Record Payment

```typescript
// Customer pays against old debt
const paymentAmount = 50000; // ₹500.00

db.execute(`
  UPDATE customers 
  SET balance_due = balance_due - ?, 
      updated_at = datetime('now')
  WHERE id = ?
`, [paymentAmount, customerId]);
```

---

## Summary

| Aspect | Design Choice | Rationale |
|--------|---------------|-----------|
| **Balance tracking** | Single `balance_due` field (INTEGER paise) | Simple, precise, handles advance payments |
| **Phone** | Optional, UNIQUE, TEXT | Primary lookup, flexible format |
| **Credit limit** | Not included | Trust-based, can add later |
| **Address/Email** | Not included | Rarely needed, can add later |
| **Soft delete** | `is_active` flag | Audit compliance, never delete |
| **Indexes** | Phone, name, balance_due | Fast lookup, udhaar reports |

**The customers table is simple, focused on udhaar tracking, and production-ready!**
