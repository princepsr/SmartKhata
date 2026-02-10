# Database Schema - Table Relationships

## Overview

The initial schema (`001_initial_schema.sql`) defines 5 core tables for the SmartKhata POS system.

---

## Money Storage Convention

> [!IMPORTANT]
> All monetary values (Prices, Totals, Discounts, Balances) are stored as **Integers in Paisa** (e.g., ₹1.00 is stored as `100`).
>
> - **Why:** To prevent floating-point rounding errors during calculation.
> - **Precision:** 100% precision for all financial transactions.
> - **Formatting:** The renderer is responsible for converting Paisa to Rupees (`value / 100`) for display using the `formatCurrency` utility.

---

## Entity Relationship Diagram

```mermaid
erDiagram
    products ||--o{ bill_items : contains
    customers ||--o{ bills : places
    bills ||--|{ bill_items : has
    products ||--o{ inventory_logs : logs

    products {
        int id PK
        text name
        text barcode UK
        text sku UK
        int sale_price       /* Stored in Paisa (Integer) */
        int purchase_price   /* Stored in Paisa (Integer) */
        int gst_percent      /* Stored in Basis Points (1800 = 18.00%) */
        int stock_qty
        int low_stock_alert
        int is_active
        text created_at
        text updated_at
    }

    customers {
        int id PK
        text name
        text phone UK
        int balance_due      /* Stored in Paisa (Integer) */
        int is_active
        text created_at
        text updated_at
    }

    bills {
        int id PK
        text bill_number UK
        int customer_id FK
        int subtotal         /* Stored in Paisa (Integer) */
        int gst_total        /* Stored in Paisa (Integer) */
        int discount_amount  /* Stored in Paisa (Integer) */
        int grand_total      /* Stored in Paisa (Integer) */
        text payment_mode    /* 'cash', 'upi', 'mixed' */
        text created_at
    }

    bill_items {
        int id PK
        int bill_id FK
        int product_id FK
        text product_name_snapshot
        int quantity
        int unit_price       /* Stored in Paisa (Integer) */
        int gst_percent
        int line_total       /* Stored in Paisa (Integer) */
    }

    inventory_logs {
        int id PK
        int product_id FK
        int change_qty
        text reason
        int reference_id
        text created_at
    }

    settings {
        text key PK
        text value
        text updated_at
    }

    license {
        int id PK
        text license_key UK
        text machine_fingerprint
        text expires_at
        text activated_at
    }
```

---

## Table Descriptions

### 1. `products`

**Purpose:** Product catalog with pricing and inventory

**Key Fields:**

- `id`: Auto-incrementing primary key
- `barcode`: Unique barcode (optional, for scanner support)
- `sku`: Unique SKU (required)
- `name`: Product name (required)
- `brand`: Product brand (optional)
- `category`: Product category (optional)
- `sale_price`: Selling price in Paisa (required, ≥ 0)
- `purchase_price`: Cost price in Paisa (optional, for profit tracking)
- `gst_percent`: GST percentage in basis points (e.g., 1800 for 18%)
- `stock_qty`: Current inventory count (default: 0)
- `low_stock_alert`: Threshold for low stock warning
- `is_active`: Soft delete flag (1 = active, 0 = inactive)

---

### 2. `customers`

**Purpose:** Customer records with balance tracking

**Key Fields:**

- `id`: Auto-incrementing primary key
- `name`: Customer name (required)
- `phone`: Phone number (unique)
- `balance_due`: Current unpaid amount in Paisa (default: 0)
- `is_active`: Soft delete flag

---

### 3. `bills` (Legacy name: `sales`)

**Purpose:** Sale transactions

**Key Fields:**

- `id`: Auto-incrementing primary key
- `bill_number`: Unique bill number (e.g., SK-2025-0001)
- `customer_id`: Foreign key to customers (optional)
- `subtotal`: Sum of line items in Paisa (required)
- `gst_total`: Total GST in Paisa
- `discount_amount`: Total discount in Paisa
- `grand_total`: Final amount in Paisa (required)
- `payment_mode`: Payment type ('cash', 'upi', 'mixed')
- `created_at`: Transaction timestamp

---

### 4. `bill_items` (Legacy name: `sale_items`)

**Purpose:** Line items for each bill

**Key Fields:**

- `id`: Auto-incrementing primary key
- `bill_id`: Foreign key to bills (required)
- `product_id`: Foreign key to products (required)
- `product_name_snapshot`: Name at time of sale
- `quantity`: Quantity sold (required, > 0)
- `unit_price`: Price at time of sale in Paisa
- `gst_percent`: GST rate at time of sale
- `line_total`: Line total in Paisa

---

### 5. `settings`

**Purpose:** Application configuration (key-value store)

**Key Fields:**

- `key`: Setting name (primary key)
- `value`: Setting value (stored as text)
- `updated_at`: Last modification timestamp

**Default Settings:**

- `business_name`: "SmartKhata POS"
- `tax_rate`: "0" (percentage, e.g., "18" for 18%)
- `currency`: "INR"
- `receipt_footer`: "Thank you for your business!"

**No Foreign Keys:** Standalone configuration table

---

### 7. `license`

**Purpose:** Software licensing and activation

**Key Fields:**

- `id`: Primary key (restricted to 1)
- `license_key`: Activation key
- `machine_fingerprint`: Unique hardware ID
- `expires_at`: License expiration date
- `activated_at`: Activation timestamp

---

## Relationship Details

### One-to-Many Relationships

**1. Customer → Sales**

```
One customer can have many sales
One sale belongs to zero or one customer (optional)
```

**SQL:**

```sql
-- Get all sales for a customer
SELECT * FROM sales WHERE customer_id = ?;

-- Get customer for a sale
SELECT c.* FROM customers c
JOIN sales s ON s.customer_id = c.id
WHERE s.id = ?;
```

**2. Sale → Sale Items**

```
One sale has many sale items
One sale item belongs to exactly one sale
```

**SQL:**

```sql
-- Get all items for a sale
SELECT * FROM sale_items WHERE sale_id = ?;

-- Get sale for an item
SELECT s.* FROM sales s
JOIN sale_items si ON si.sale_id = s.id
WHERE si.id = ?;
```

**3. Product → Sale Items**

```
One product can appear in many sale items
One sale item references exactly one product
```

**SQL:**

```sql
-- Get all sales of a product
SELECT si.* FROM sale_items si
WHERE si.product_id = ?;

-- Get product for a sale item
SELECT p.* FROM products p
JOIN sale_items si ON si.product_id = p.id
WHERE si.id = ?;
```

---

## Foreign Key Behaviors

### ON DELETE SET NULL

```sql
FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
```

**Scenario:** Customer is deleted

- Sales remain in database
- `customer_id` becomes NULL
- Historical data preserved

### ON DELETE CASCADE

```sql
FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
```

**Scenario:** Sale is deleted

- All `sale_items` for that sale are automatically deleted
- Maintains referential integrity

### ON DELETE RESTRICT

```sql
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
```

**Scenario:** Attempt to delete a product that has been sold

- Deletion fails with error
- Prevents data loss
- Use `is_active = 0` for soft delete instead

---

## Data Flow Example

### Creating a Sale

```sql
-- 1. Insert sale header
INSERT INTO sales (customer_id, subtotal, tax, discount, total, payment_method)
VALUES (5, 1000, 180, 50, 1130, 'cash');
-- Returns sale_id = 42

-- 2. Insert sale items
INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
VALUES
  (42, 10, 'Product A', 2, 300, 600),
  (42, 15, 'Product B', 1, 400, 400);

-- 3. Update product stock
UPDATE products SET stock = stock - 2 WHERE id = 10;
UPDATE products SET stock = stock - 1 WHERE id = 15;
```

---

## Extensibility

The schema is designed to be extended without breaking changes:

**Future Additions (via migrations):**

- `products.supplier_id` - Supplier tracking
- `sales.cashier_id` - User tracking
- `sale_items.discount` - Line-item discounts
- `payments` table - Multiple payment methods per sale
- `inventory_adjustments` - Stock tracking
- `categories` table - Normalize product categories

**Current Design Allows:**

- Adding columns without affecting existing queries
- Adding new tables without foreign key conflicts
- Soft deletes preserve historical data

---

## Summary

| Table            | Purpose           | Parent Tables       | Child Tables                   |
| ---------------- | ----------------- | ------------------- | ------------------------------ |
| `products`       | Product catalog   | None                | `bill_items`, `inventory_logs` |
| `customers`      | Customer records  | None                | `bills`                        |
| `bills`          | Sale transactions | `customers`         | `bill_items`                   |
| `bill_items`     | Line items        | `bills`, `products` | None                           |
| `inventory_logs` | Stock history     | `products`          | None                           |
| `settings`       | Configuration     | None                | None                           |
| `license`        | Licensing         | None                | None                           |

**Total Tables:** 7  
**Total Foreign Keys:** 5

---

**The schema is production-ready and follows SQLite best practices!**
