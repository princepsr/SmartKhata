# App Config Table Design

## Overview

The `app_config` table is a **singleton table** (exactly one row) that stores all application-wide configuration. This approach provides strict structure and type safety compared to a generic key-value store.

---

## Table Definition

```sql
CREATE TABLE app_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  shop_name TEXT NOT NULL DEFAULT 'SmartKhata Shop',
  owner_name TEXT,
  address TEXT,
  phone TEXT,
  gst_number TEXT,
  printer_name TEXT,
  paper_size TEXT CHECK(paper_size IN ('58mm', '80mm')) DEFAULT '58mm',
  gst_enabled INTEGER DEFAULT 1 CHECK(gst_enabled IN (0, 1)),
  round_off_enabled INTEGER DEFAULT 1 CHECK(round_off_enabled IN (0, 1)),
  gst_percentage INTEGER DEFAULT 18 CHECK(gst_percentage IN (5, 12, 18)),
  show_logo INTEGER DEFAULT 0 CHECK(show_logo IN (0, 1)),
  show_customer_details INTEGER DEFAULT 1 CHECK(show_customer_details IN (0, 1)),
  footer_message TEXT DEFAULT 'Thank you! Visit Again',
  print_copies INTEGER DEFAULT 1 CHECK(print_copies BETWEEN 1 AND 5),
  auto_print INTEGER DEFAULT 1 CHECK(auto_print IN (0, 1)),
  billing_only INTEGER DEFAULT 0 CHECK(billing_only IN (0, 1)),
  customers_enabled INTEGER DEFAULT 1 CHECK(customers_enabled IN (0, 1)),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

---

## Column Specifications

| Column                  | Type    | Default           | Description               |
| ----------------------- | ------- | ----------------- | ------------------------- |
| `id`                    | INTEGER | 1                 | Primary key (must be 1)   |
| `shop_name`             | TEXT    | 'SmartKhata Shop' | Name of the shop          |
| `owner_name`            | TEXT    | NULL              | Owner's name              |
| `address`               | TEXT    | NULL              | Shop address              |
| `phone`                 | TEXT    | NULL              | Shop phone number         |
| `gst_number`            | TEXT    | NULL              | Shop GSTIN                |
| `printer_name`          | TEXT    | NULL              | System printer name       |
| `paper_size`            | TEXT    | '58mm'            | '58mm' or '80mm'          |
| `gst_enabled`           | INTEGER | 1                 | Boolean (0/1)             |
| `round_off_enabled`     | INTEGER | 1                 | Boolean (0/1)             |
| `gst_percentage`        | INTEGER | 18                | Default GST rate          |
| `show_logo`             | INTEGER | 0                 | Boolean (0/1)             |
| `show_customer_details` | INTEGER | 1                 | Boolean (0/1)             |
| `footer_message`        | TEXT    | 'Thank you!'      | Message on receipt footer |
| `print_copies`          | INTEGER | 1                 | Number of copies (1-5)    |
| `auto_print`            | INTEGER | 1                 | Boolean (0/1)             |
| `billing_only`          | INTEGER | 0                 | Boolean (0/1)             |
| `customers_enabled`     | INTEGER | 1                 | Boolean (0/1)             |
| `updated_at`            | TEXT    | now               | Timestamp                 |

---

## Design Choices

### 1. Singleton Pattern

**Why singleton (`id = 1`):**

- ✅ Ensures exactly one configuration exists.
- ✅ Simplifies queries: `SELECT * FROM app_config`.
- ✅ No ambiguity about which setting applies.

### 2. Structured Columns

**Rationale:**

- ✅ Native SQLite data types for each setting.
- ✅ `CHECK` constraints for strict validation.
- ✅ Clear documentation of available settings.

---

## Access Patterns

### Get Config (TypeScript)

```typescript
public getConfig(): AppConfig {
  const sql = `SELECT * FROM app_config WHERE id = 1`;
  return this.queryOne(sql);
}
```

### Update Config (TypeScript)

```typescript
public updateConfig(config: Partial<AppConfig>): void {
  // Map to snake_case and update row id=1
}
```

---

## Summary

| Aspect          | Design Choice     | Rationale                             |
| --------------- | ----------------- | ------------------------------------- |
| **Structure**   | Singleton Table   | Strict structure, one source of truth |
| **Integrity**   | CHECK Constraints | DB-level validation                   |
| **Performance** | Direct Columns    | No parsing overhead, fast lookups     |
