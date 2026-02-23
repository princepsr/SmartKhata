# Database Schema - Table Relationships

## Overview

The initial schema (`001_initial_schema.sql`) defines 5 core tables for the SmartKhata POS system.

---

## Money Storage Convention

> [!IMPORTANT]
> All monetary values (Prices, Totals, Discounts, Balances) are stored as **Decimals in Rupees** (e.g., ₹1.50 is stored as `1.50` in `REAL`/`DECIMAL` format).
>
> - **Why:** To improve consistency, prevent conversion bugs, and simplify the code across all layers.
> - **Precision:** Calculations use standard floating-point arithmetic with rounding applied only at final totals for display.
> - **Formatting:** The `formatCurrency` utility is used solely for visual presentation (adding symbols and locale-specific grouping).

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
        real sale_price       /* Stored in Rupees (Decimal) */
        real purchase_price   /* Stored in Rupees (Decimal) */
        real gst_percent      /* Stored as Percentage (e.g., 18.0) */
        int stock_qty
        int low_stock_alert
        int is_gst_inclusive  /* 1 = Inclusive (MRP), 0 = Exclusive */
        int is_active
        text created_at
        text updated_at
    }

    customers {
        int id PK
        text name
        text phone UK
        text email
        text address
        real balance_due      /* Stored in Rupees (Decimal) */
        int is_active
        text created_at
        text updated_at
    }

    customer_ledger {
        int id PK
        int customer_id FK
        real amount
        text type             /* SALE, PAYMENT_IN, PAYMENT_OUT, OPENING_BALANCE */
        int reference_id
        text notes
        text created_at
    }

    bills {
        int id PK
        text bill_number UK
        int customer_id FK
        real subtotal         /* Stored in Rupees (Decimal) */
        real gst_total        /* Stored in Rupees (Decimal) */
        real discount_amount  /* Stored in Rupees (Decimal) */
        real grand_total      /* Stored in Rupees (Decimal) */
        text payment_mode    /* 'cash', 'upi', 'mixed' */
        text created_at
    }

    bill_items {
        int id PK
        int bill_id FK
        int product_id FK
        text product_name_snapshot
        int quantity
        real unit_price       /* Stored in Rupees (Decimal) */
        real purchase_price   /* Stored in Rupees (Decimal) SNAPSHOT */
        real gst_percent      /* Stored as Percentage */
        real line_total       /* Stored in Rupees (Decimal) */
    }

    inventory_logs {
        int id PK
        int product_id FK
        int change_qty
        text reason
        int reference_id
        text created_at
    }

    app_config {
        int id PK
        text shop_name
        text owner_name
        text address
        text email            /* Added email support */
        text phone
        text gst_number
        text printer_name
        text paper_size
        int gst_enabled
        int round_off_enabled
        int gst_percentage
        int show_logo
        int show_customer_details
        text footer_message
        int print_copies
        int auto_print
        int billing_only
        int gst_exclusive_mode  /* 1 = Force Exclusive, 0 = Standard */
        int customers_enabled
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
- `sale_price`: Selling price in Rupees (required, ≥ 0)
- `purchase_price`: Cost price in Rupees (optional, for profit tracking)
- `gst_percent`: GST percentage (e.g., 18.0 for 18%)
- `stock_qty`: Current inventory count (default: 0)
- `low_stock_alert`: Threshold for low stock warning
- `is_gst_inclusive`: Flag for tax-inclusive (MRP) pricing (1 = True, 0 = False)
- `is_active`: Soft delete flag (1 = active, 0 = inactive/deactivated)

---

### 2. `customers`

**Purpose:** Customer records with balance tracking

**Key Fields:**

- `id`: Auto-incrementing primary key
- `name`: Customer name (required)
- `phone`: Phone number (unique)
- `email`: Customer email address
- `address`: Detailed physical address
- `balance_due`: Current unpaid amount in Rupees (default: 0)
- `is_active`: Soft delete flag
- `updated_at`: Last synchronization timestamp

---

### 2a. `customer_ledger`

**Purpose:** Transaction audit trail for each customer

**Key Fields:**

- `id`: Primary key
- `customer_id`: Reference to customer
- `amount`: Absolute transaction value in Rupees
- `type`: Category of entry (`SALE`, `PAYMENT_IN`, `PAYMENT_OUT`, `OPENING_BALANCE`)
- `reference_id`: Link to source table (e.g., `bill_id` for sales)
- `notes`: Descriptive reason or manual entry notes

---

### 3. `bills` (Legacy name: `sales`)

**Purpose:** Sale transactions

**Key Fields:**

- `id`: Auto-incrementing primary key
- `bill_number`: Unique bill number (e.g., SK-2025-0001)
- `customer_id`: Foreign key to customers (optional)
- `subtotal`: Sum of line items in Rupees (required)
- `gst_total`: Total GST in Rupees
- `discount_amount`: Total discount in Rupees
- `grand_total`: Final amount in Rupees (required)
- `payment_mode`: Payment type ('cash', 'upi', 'mixed')
- `created_at`: Transaction timestamp
- **Reporting Note**: The `gst_total` field is vital for profit calculation; if `gst_total > 0`, the reporting system treats items on this bill as taxable and subtracts GST from the gross profit to find the net taxable profit.

---

### 4. `bill_items` (Legacy name: `sale_items`)

**Purpose:** Line items for each bill

**Key Fields:**

- `id`: Auto-incrementing primary key
- `bill_id`: Foreign key to bills (required)
- `product_id`: Foreign key to products (required)
- `product_name_snapshot`: Name at time of sale
- `quantity`: Quantity sold (required, > 0)
- `unit_price`: Price at time of sale in Rupees
- `purchase_price`: Cost price at time of sale in Rupees (**snapshot for profit tracking**)
- `gst_percent`: GST rate at time of sale in percentage
- `line_total`: Line total in Rupees
- **Reporting Note**: Profit is calculated per item as `(line_total - line_gst) - (purchase_price * quantity)`, provided a `purchase_price` snapshot is present.

---

### 5. `app_config`

**Purpose:** Application configuration (singleton)

**Key Fields:**

- `id`: Primary key (must be 1)
- `shop_name`: Name of the shop (default: "SmartKhata Shop")
- `gst_percentage`: Default GST rate (5, 12, or 18)
- `billing_only`: Feature toggle for inventory tracking bypass
- `gst_exclusive_mode`: Global master switch for forced exclusive pricing (1 = Force, 0 = Standard)
- `customers_enabled`: Feature toggle for customer management
- `updated_at`: Last modification timestamp

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
- Use `is_active = 0` for deactivation (soft delete) instead

---

## Data Flow Example

### Creating a Sale

```sql
-- 1. Insert sale header
INSERT INTO bills (customer_id, subtotal, gst_total, discount_amount, grand_total, payment_mode)
VALUES (5, 1000.00, 180.00, 50.00, 1130.00, 'cash');
-- Returns sale_id = 42

-- 2. Insert sale items (with snapshots)
INSERT INTO bill_items (bill_id, product_id, product_name_snapshot, quantity, unit_price, purchase_price, gst_percent, line_total)
VALUES
  (42, 10, 'Product A', 2, 300, 200, 18.0, 600),
  (42, 15, 'Product B', 1, 400, 300, 5.0, 400);

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
| `app_config`     | Configuration     | None                | None                           |
| `license`        | Licensing         | None                | None                           |

**Total Tables:** 7  
**Total Foreign Keys:** 5

---

**The schema is production-ready and follows SQLite best practices!**
