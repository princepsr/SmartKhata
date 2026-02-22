# Products Table Design

## Overview

The `products` table is the core master data table for the POS system, storing product catalog information including pricing, inventory, and GST details.

---

## Table Definition

```sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  barcode TEXT UNIQUE,
  sale_price REAL NOT NULL CHECK(sale_price >= 0),
  purchase_price REAL CHECK(purchase_price >= 0),
  gst_percent REAL NOT NULL DEFAULT 0 CHECK(gst_percent >= 0 AND gst_percent <= 100),
  stock_qty INTEGER NOT NULL DEFAULT 0 CHECK(stock_qty >= 0),
  low_stock_alert INTEGER CHECK(low_stock_alert >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
```

---

## Column Specifications

### Primary Key

| Column | Type    | Constraints               | Description               |
| ------ | ------- | ------------------------- | ------------------------- |
| `id`   | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique product identifier |

---

### Identification Fields

| Column    | Type | Constraints | Description                                           |
| --------- | ---- | ----------- | ----------------------------------------------------- |
| `name`    | TEXT | NOT NULL    | Product display name (e.g., "Coca Cola 500ml")        |
| `sku`     | TEXT | UNIQUE      | Stock Keeping Unit (optional, e.g., "PROD-001")       |
| `barcode` | TEXT | UNIQUE      | Barcode for scanner (optional, e.g., "8901234567890") |

**Design Choices:**

**`name` (Required):**

- Always required for display in UI and receipts
- Indexed for fast search
- No length limit (TEXT allows up to 1 billion characters in SQLite)

**`sku` (Optional):**

- For internal inventory management
- UNIQUE constraint prevents duplicates
- NULL allowed (not all products need SKU)
- Useful for products without barcodes

**`barcode` (Optional):**

- For barcode scanner integration
- UNIQUE constraint prevents duplicates
- NULL allowed (not all products have barcodes)
- Supports EAN-13, UPC, QR codes, etc.

---

### Pricing Fields (Stored in Rupees)

| Column           | Type | Constraints    | Description                       |
| ---------------- | ---- | -------------- | --------------------------------- |
| `sale_price`     | REAL | NOT NULL, >= 0 | Selling price in Rupees (Decimal) |
| `purchase_price` | REAL | >= 0           | Cost price in Rupees (optional)   |

**Design Choices:**

**REAL Storage (Rupees):**

- ✅ Simplified calculations (no division by 100)
- ✅ Direct mapping to UI values
- ✅ Standard SQLite decimal precision |
  **Conversion:**
  | Display | Storage | Calculation |
  |---------|---------|-------------|
  | ₹40.00 | 40.0 | Direct |
  | ₹150.50 | 150.5 | Direct |
  | ₹2.00 | 2.0 | Direct |

**`sale_price` (Required):**

- Always required (cannot sell without a price)
- CHECK constraint prevents negative prices
- NOT NULL ensures data integrity

**`purchase_price` (Optional):**

- For profit margin calculations
- NULL allowed (not all shops track purchase price)
- Useful for inventory valuation and reports

---

### GST Field

| Column        | Type | Constraints     | Description            |
| ------------- | ---- | --------------- | ---------------------- |
| `gst_percent` | REAL | NOT NULL, 0-100 | GST rate as percentage |

**Design Choices:**

**Percentage Storage:**

- Stored as `REAL` (e.g., 18.0, 5.0, 12.5)
- Range: 0 to 100 (0% to 100%)

**Common GST Rates in India:**
| Rate | Storage | Use Case |
|------|---------|----------|
| 0% | 0.0 | Essential goods (grains, milk) |
| 5% | 5.0 | Household necessities |
| 12% | 12.0 | Processed foods |
| 18% | 18.0 | Most goods (default) |
| 28% | 28.0 | Luxury items |

**Calculation Example:**

```typescript
const salePrice = 100.0;
const gstPercent = 18.0;

// Calculate GST amount
const gstAmount = (salePrice * gstPercent) / 100;
// = (100.00 × 18.0) / 100 = 18.00

// Total with GST
const total = salePrice + gstAmount;
// = 100.00 + 18.00 = 118.00
```

**Why NOT NULL with DEFAULT 0:**

- Every product must have a GST rate (even if 0%)
- Default 0 for non-taxable items
- Explicit value prevents ambiguity

---

### Inventory Fields

| Column            | Type    | Constraints    | Description                |
| ----------------- | ------- | -------------- | -------------------------- |
| `stock_qty`       | INTEGER | NOT NULL, >= 0 | Current stock quantity     |
| `low_stock_alert` | INTEGER | >= 0           | Alert threshold (optional) |

**Design Choices:**

**`stock_qty` (Required):**

- Current available stock
- Auto-decremented on sales
- Auto-incremented on stock adjustments
- CHECK constraint prevents negative stock
- NOT NULL with DEFAULT 0 (new products start with 0 stock)

**`low_stock_alert` (Optional):**

- Threshold for low stock warnings
- NULL = no alert configured
- Example: Alert when stock < 10 units
- Used in inventory reports and dashboard

**Stock Management:**

```sql
-- Deduct stock on sale
UPDATE products
SET stock_qty = stock_qty - 2, updated_at = datetime('now', 'localtime')
WHERE id = 1;

-- Add stock on purchase
UPDATE products
SET stock_qty = stock_qty + 50, updated_at = datetime('now', 'localtime')
WHERE id = 1;

-- Check low stock products
SELECT * FROM products
WHERE is_active = 1
  AND low_stock_alert IS NOT NULL
  AND stock_qty <= low_stock_alert;
```

---

### Status & Audit Fields

| Column       | Type    | Constraints      | Description                      |
| ------------ | ------- | ---------------- | -------------------------------- |
| `is_active`  | INTEGER | NOT NULL, 0 or 1 | Soft delete flag                 |
| `created_at` | TEXT    | NOT NULL         | Creation timestamp (ISO 8601)    |
| `updated_at` | TEXT    | NOT NULL         | Last update timestamp (ISO 8601) |

**Design Choices:**

**`is_active` (Soft Delete):**

- 1 = Active (default)
- 0 = Inactive (Deactivated)
- Never physically delete products (audit requirement)
- Inactive products hidden from POS but visible in reports (if toggled)

**Timestamps:**

- ISO 8601 format: `2026-02-08 15:05:15`
- Local timezone (IST)
- Auto-populated via `datetime('now', 'localtime')`
- `updated_at` should be manually updated on changes

---

## Indexes

### Performance Indexes

```sql
-- Name search (autocomplete, search)
CREATE INDEX idx_products_name ON products(name);

-- Barcode lookup (scanner)
CREATE INDEX idx_products_barcode ON products(barcode);

-- SKU lookup (inventory management)
CREATE INDEX idx_products_sku ON products(sku);

-- Active filter (most queries)
CREATE INDEX idx_products_is_active ON products(is_active);
```

### Composite Index for Low Stock Alerts

```sql
CREATE INDEX idx_products_stock_alert
ON products(stock_qty, low_stock_alert)
WHERE is_active = 1 AND low_stock_alert IS NOT NULL;
```

**Why this index:**

- Optimizes low stock queries
- Partial index (only active products with alerts)
- Smaller index size (excludes inactive and non-alert products)

---

## Key Design Decisions

### 1. Optional SKU and Barcode

**Rationale:**

- Not all kirana shops use SKUs
- Not all products have barcodes (loose items, local products)
- Flexibility for different shop sizes and workflows

**UNIQUE Constraints:**

- Prevents duplicate SKUs/barcodes
- NULL values are allowed (multiple NULLs don't violate UNIQUE)

---

### 2. Separate Sale and Purchase Prices

**Rationale:**

- Profit margin tracking
- Inventory valuation
- Purchase price optional (not all shops track it)

**Alternative considered:**

- Single `price` field with separate `cost_price`
- ❌ Rejected: Ambiguous which is selling price

---

### 3. GST Percent (Not HSN Code)

**Rationale:**

- Simplified for kirana shops (HSN code not mandatory for small businesses)
- GST rate is sufficient for most POS operations
- Can add HSN code in future migration if needed

**Future Extension:**

```sql
ALTER TABLE products ADD COLUMN hsn_code TEXT;
CREATE INDEX idx_products_hsn_code ON products(hsn_code);
```

---

### 4. Simple Stock Management

**Rationale:**

- No separate `inventory` table (overkill for kirana shops)
- Stock tracked directly in products table
- Stock adjustments logged in separate `inventory_adjustments` table (audit trail)

**Stock Deduction Flow:**

```
Sale Created → Sale Items Inserted → Product Stock Decremented
```

---

### 5. No Category/Brand Fields (Yet)

**Rationale:**

- Keep initial schema simple
- Can add in future migration:
  ```sql
  ALTER TABLE products ADD COLUMN category TEXT;
  ALTER TABLE products ADD COLUMN brand TEXT;
  CREATE INDEX idx_products_category ON products(category);
  ```

**Extensibility:**

- Easy to add columns later
- No breaking changes to existing code
- Follows "simple but extensible" requirement

---

## Usage Examples

### Create Product

```typescript
const product = {
  name: 'Coca Cola 500ml',
  barcode: '8901234567890',
  sale_price: 40.0,
  purchase_price: 30.0,
  gst_percent: 18.0,
  stock_qty: 50,
  low_stock_alert: 10,
};

db.execute(
  `
  INSERT INTO products (name, barcode, sale_price, purchase_price, gst_percent, stock_qty, low_stock_alert)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`,
  [
    product.name,
    product.barcode,
    product.sale_price,
    product.purchase_price,
    product.gst_percent,
    product.stock_qty,
    product.low_stock_alert,
  ]
);
```

### Search Products

```typescript
// Search by name
const products = db.queryAll(
  `
  SELECT * FROM products 
  WHERE name LIKE ? AND is_active = 1
  ORDER BY name
`,
  [`%${searchTerm}%`]
);

// Lookup by barcode
const product = db.queryOne(
  `
  SELECT * FROM products 
  WHERE barcode = ? AND is_active = 1
`,
  [barcode]
);
```

### Check Low Stock

```typescript
const lowStockProducts = db.queryAll(`
  SELECT id, name, stock_qty, low_stock_alert
  FROM products
  WHERE is_active = 1 
    AND low_stock_alert IS NOT NULL 
    AND stock_qty <= low_stock_alert
  ORDER BY stock_qty ASC
`);
```

---

## Summary

| Aspect              | Design Choice            | Rationale                       |
| ------------------- | ------------------------ | ------------------------------- |
| **Monetary values** | REAL (Rupees)            | Simplified calculations         |
| **GST**             | REAL (Percentage)        | Direct percentage values        |
| **SKU/Barcode**     | Optional, UNIQUE         | Flexibility for different shops |
| **Stock**           | Single `stock_qty` field | Simple, auto-managed via sales  |
| **Soft delete**     | `is_active` flag         | Audit compliance, deactivation  |
| **Extensibility**   | Minimal initial fields   | Easy to add columns later       |

**The products table is production-ready and follows all schema design rules!**
