# Bill Items Table Design

## Overview

The `bill_items` table stores line items for each bill with **immutable product snapshots**. This design prioritizes **historical safety over normalization** to ensure audit compliance and data integrity.

---

## Table Definition

```sql
CREATE TABLE bill_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price INTEGER NOT NULL CHECK(unit_price >= 0),
  gst_percent INTEGER NOT NULL DEFAULT 0 CHECK(gst_percent >= 0 AND gst_percent <= 10000),
  line_total INTEGER NOT NULL CHECK(line_total >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);
```

---

## Column Specifications

### Primary Key

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique bill item identifier |

---

### Bill Reference

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `bill_id` | INTEGER | NOT NULL, FOREIGN KEY | Reference to bills table |

**Foreign Key Constraint:**
```sql
FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
```

**Why CASCADE:**
- Bill and its items are **atomic** (inseparable)
- If bill is deleted, all items must be deleted
- No orphaned bill items

**Use Case:**
- Voiding a bill deletes all its items
- Testing/development cleanup

---

### Product Reference

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `product_id` | INTEGER | NOT NULL, FOREIGN KEY | Reference to products table |

**Foreign Key Constraint:**
```sql
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
```

**Why RESTRICT:**
- Cannot delete product if it has been sold
- Audit requirement (historical data must remain valid)
- Forces soft delete (set `is_active = 0` instead)

**Use Case:**
```sql
-- This will FAIL if product has been sold:
DELETE FROM products WHERE id = 101;
-- Error: FOREIGN KEY constraint failed

-- Correct approach (soft delete):
UPDATE products SET is_active = 0 WHERE id = 101;
```

**Why keep product_id:**
- For reporting (e.g., "top selling products")
- For analytics (e.g., "product sales trend")
- NOT for retrieving product details (use snapshot instead)

---

### Product Snapshot (IMMUTABLE)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `product_name_snapshot` | TEXT | NOT NULL | Product name at time of sale |

**Design Choices:**

**Snapshot Strategy:**
> [!IMPORTANT]
> **Critical Design Decision: Product Snapshots**
> 
> Product details (name, price, GST) are **captured at time of sale** and stored in `bill_items`.
> 
> **Why:**
> - Product details may change over time (price increase, name change, GST rate change)
> - Historical bills must show **what was actually sold**, not current product details
> - Audit compliance requires immutable historical records
> 
> **Implication:** Product changes don't affect old bills.

**Example Scenario:**
```
Day 1: Sell "Coca Cola 500ml" for ₹40.00
       → Stored in bill_items: product_name_snapshot = "Coca Cola 500ml", unit_price = 4000

Day 2: Product renamed to "Coke 500ml" and price increased to ₹45.00
       → products table updated: name = "Coke 500ml", sale_price = 4500

Day 3: View Day 1 bill
       → Still shows "Coca Cola 500ml" for ₹40.00 (CORRECT!)
       → If we used product_id to fetch name/price, it would show "Coke 500ml" for ₹45.00 (WRONG!)
```

**Denormalization Trade-off:**

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Snapshot (denormalized)** | ✅ Historical accuracy<br>✅ Immutable<br>✅ Audit-safe | ⚠️ Redundant data | ✅ **CHOSEN** |
| **Reference only (normalized)** | ✅ No redundancy | ❌ Historical inaccuracy<br>❌ Mutable | ❌ Rejected |

---

### Quantity

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `quantity` | INTEGER | NOT NULL, > 0 | Number of units sold |

**Design Choices:**

**INTEGER (Whole Units):**
- Simplifies initial implementation
- Suitable for most kirana products (bottles, packets, pieces)
- CHECK constraint prevents zero or negative quantity

**Future Enhancement (Fractional Quantities):**
```sql
-- For products sold by weight (e.g., 1.5 kg dal)
ALTER TABLE bill_items MODIFY COLUMN quantity REAL NOT NULL CHECK(quantity > 0);
```

**Current Limitation:**
- Cannot sell 1.5 kg of dal (only 1 kg or 2 kg)
- Acceptable for MVP (most products are whole units)

---

### Pricing Snapshot (IMMUTABLE)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `unit_price` | INTEGER | NOT NULL, >= 0 | Price per unit at time of sale (paise) |
| `gst_percent` | INTEGER | NOT NULL, >= 0, <= 10000 | GST rate at time of sale (basis points) |
| `line_total` | INTEGER | NOT NULL, >= 0 | Total for this line item (paise) |

**Design Choices:**

**`unit_price` (Snapshot):**
- Price at time of sale, NOT current price
- Stored in paise (INTEGER)
- Example: ₹40.00 = 4000 paise

**`gst_percent` (Snapshot):**
- GST rate at time of sale, NOT current rate
- Stored as basis points (1800 = 18%)
- Example: 18% GST = 1800

**`line_total` (Calculated and Stored):**
- Total for this line item (unit_price × quantity + GST)
- Stored, NOT recalculated (same rationale as bills table)
- Immutable for audit compliance

**Calculation Formula:**
```typescript
const unitPricePaise = 4000;     // ₹40.00
const quantity = 2;
const gstPercent = 1800;         // 18%

// Subtotal (before GST)
const subtotalPaise = unitPricePaise * quantity; // 8000 paise = ₹80.00

// GST amount
const gstAmountPaise = Math.round((subtotalPaise * gstPercent) / 10000); // 1440 paise = ₹14.40

// Line total
const lineTotalPaise = subtotalPaise + gstAmountPaise; // 9440 paise = ₹94.40
```

**Why store `line_total` (not calculate):**
- Same rationale as `bills.grand_total`
- Immutable for audit compliance
- Fast queries (no calculation needed)

---

### Audit Timestamp

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `created_at` | TEXT | NOT NULL | Item creation timestamp (ISO 8601) |

**No `updated_at`:**
- Bill items are immutable once created
- Same as bills table

---

## Indexes

### Performance Indexes

```sql
-- Bill items lookup (most common query)
CREATE INDEX idx_bill_items_bill_id ON bill_items(bill_id);

-- Product sales history (reporting)
CREATE INDEX idx_bill_items_product_id ON bill_items(product_id);

-- Date-based product sales (analytics)
CREATE INDEX idx_bill_items_created_at ON bill_items(created_at);
```

**Why these indexes:**

| Index | Use Case | Frequency |
|-------|----------|-----------|
| `bill_id` | Fetch items for a bill (receipt, display) | Very High |
| `product_id` | Product sales reports, top sellers | Medium |
| `created_at` | Date-range product sales analytics | Low |

---

## Foreign Key Rules

### Rule 1: Bill Items CASCADE with Bill

```sql
FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
```

**Rationale:**
- Bill and items are atomic (inseparable)
- Deleting bill should delete all items
- No orphaned items

**Example:**
```sql
-- Delete bill (all items deleted automatically)
DELETE FROM bills WHERE id = 1;
-- All bill_items with bill_id = 1 are deleted
```

---

### Rule 2: Product RESTRICT (Cannot Delete if Sold)

```sql
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
```

**Rationale:**
- Audit requirement (cannot delete sold products)
- Historical data integrity
- Forces soft delete approach

**Example:**
```sql
-- This FAILS if product has been sold:
DELETE FROM products WHERE id = 101;
-- Error: FOREIGN KEY constraint failed

-- Correct approach:
UPDATE products SET is_active = 0 WHERE id = 101;
```

**Why not SET NULL:**
- Losing `product_id` breaks reporting
- Cannot track "top selling products" if product_id is NULL

**Why not CASCADE:**
- Deleting product would delete all bill items (data loss!)
- Violates audit requirements

---

## Snapshot Strategy Explained

### The Problem

**Without snapshots:**
```
Day 1: Sell "Coca Cola 500ml" for ₹40.00
       → bill_items stores: product_id = 101

Day 2: Product renamed to "Coke 500ml", price = ₹45.00
       → products table updated

Day 3: View Day 1 bill
       → Query: SELECT p.name, p.sale_price FROM bill_items bi JOIN products p ON bi.product_id = p.id
       → Result: "Coke 500ml", ₹45.00 (WRONG! Should be "Coca Cola 500ml", ₹40.00)
```

**With snapshots:**
```
Day 1: Sell "Coca Cola 500ml" for ₹40.00
       → bill_items stores: product_id = 101, product_name_snapshot = "Coca Cola 500ml", unit_price = 4000

Day 2: Product renamed to "Coke 500ml", price = ₹45.00
       → products table updated (bill_items unchanged)

Day 3: View Day 1 bill
       → Query: SELECT product_name_snapshot, unit_price FROM bill_items WHERE bill_id = 1
       → Result: "Coca Cola 500ml", ₹40.00 (CORRECT!)
```

---

### What to Snapshot

| Field | Snapshot? | Rationale |
|-------|-----------|-----------|
| **product_name** | ✅ Yes | Name may change |
| **unit_price** | ✅ Yes | Price changes frequently |
| **gst_percent** | ✅ Yes | GST rates may change |
| **quantity** | ❌ No | Entered at time of sale |
| **line_total** | ✅ Yes | Calculated and stored (immutable) |

**Not snapshotted:**
- `product.sku` - Not displayed on receipts
- `product.barcode` - Not needed for historical bills
- `product.category` - Can be added later if needed

---

### Historical Safety > Normalization

**Normalization Principle:**
- "Don't repeat yourself" (DRY)
- Store data once, reference it everywhere

**Why we violate it:**
- **Audit compliance** trumps normalization
- **Historical accuracy** is more important than disk space
- **Immutability** is a legal requirement for financial records

**Trade-offs:**

| Aspect | Normalized | Denormalized (Snapshot) |
|--------|------------|-------------------------|
| **Disk space** | ✅ Less | ⚠️ More |
| **Data consistency** | ✅ Single source of truth | ⚠️ Redundant data |
| **Historical accuracy** | ❌ Mutable | ✅ Immutable |
| **Audit compliance** | ❌ Fails | ✅ Passes |
| **Query performance** | ⚠️ Requires JOIN | ✅ Direct query |

**Decision:** Denormalization is the correct choice for financial/audit data.

---

## Usage Examples

### Create Bill Items

```typescript
const items = [
  {
    bill_id: 1,
    product_id: 101,
    product_name_snapshot: 'Coca Cola 500ml',
    quantity: 2,
    unit_price: 4000,      // ₹40.00
    gst_percent: 1800,     // 18%
    line_total: 9440       // ₹94.40
  },
  {
    bill_id: 1,
    product_id: 102,
    product_name_snapshot: 'Amul Milk 1L',
    quantity: 1,
    unit_price: 6000,      // ₹60.00
    gst_percent: 0,        // No GST
    line_total: 6000       // ₹60.00
  }
];

items.forEach(item => {
  db.execute(`
    INSERT INTO bill_items (bill_id, product_id, product_name_snapshot, quantity, unit_price, gst_percent, line_total)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [item.bill_id, item.product_id, item.product_name_snapshot, item.quantity, item.unit_price, item.gst_percent, item.line_total]);
});
```

### Fetch Bill Items

```typescript
const billItems = db.queryAll(`
  SELECT 
    product_name_snapshot,
    quantity,
    unit_price,
    gst_percent,
    line_total
  FROM bill_items
  WHERE bill_id = ?
  ORDER BY id
`, [billId]);

// Display on receipt
billItems.forEach(item => {
  console.log(`${item.product_name_snapshot} x ${item.quantity} @ ₹${item.unit_price / 100} = ₹${item.line_total / 100}`);
});
```

### Product Sales Report

```typescript
const productSales = db.queryAll(`
  SELECT 
    p.name as current_name,
    SUM(bi.quantity) as total_quantity,
    SUM(bi.line_total) as total_sales_paise,
    ROUND(SUM(bi.line_total) / 100.0, 2) as total_sales_rupees
  FROM bill_items bi
  JOIN products p ON bi.product_id = p.id
  WHERE DATE(bi.created_at) BETWEEN ? AND ?
  GROUP BY bi.product_id
  ORDER BY total_sales_paise DESC
  LIMIT 10
`, [startDate, endDate]);
```

---

## Summary

| Aspect | Design Choice | Rationale |
|--------|---------------|-----------|
| **Snapshot strategy** | Store product details in bill_items | Historical accuracy, audit compliance |
| **Denormalization** | Duplicate product data | Historical safety > normalization |
| **Foreign keys** | CASCADE for bill, RESTRICT for product | Atomic bills, prevent product deletion |
| **Monetary values** | INTEGER (paise) | Precision, no rounding errors |
| **Immutability** | No updates allowed | Audit requirement, legal compliance |
| **product_id** | Retained for reporting | Analytics, top sellers, trends |

**The bill_items table prioritizes historical accuracy and audit compliance over normalization!**
