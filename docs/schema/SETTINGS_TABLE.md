# Settings Table Design

## Overview

The `settings` table provides a **flexible key-value store** for application configuration. No schema changes are needed to add new settings.

---

## Table Definition

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Column Specifications

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `key` | TEXT | PRIMARY KEY | Setting identifier (unique) |
| `value` | TEXT | NOT NULL | Setting value (stored as TEXT) |
| `updated_at` | TEXT | NOT NULL | Last update timestamp |

---

## Design Choices

### 1. Key-Value Structure

**Why simple key-value:**
- ✅ No schema changes for new settings
- ✅ Flexible (add settings without migrations)
- ✅ Fast lookups (primary key on `key`)
- ✅ Easy to understand and maintain

**Alternative considered:**
- Separate columns per setting: ❌ Requires schema changes
- JSON blob: ❌ Harder to query individual settings

---

### 2. All Values as TEXT

**Rationale:**
- SQLite has dynamic typing (TEXT can store anything)
- Application layer handles type conversion
- Simplifies schema (no need for multiple value columns)

**Type Conversion Examples:**

| Setting | Stored Value | Application Type | Conversion |
|---------|--------------|------------------|------------|
| `shop_name` | `"My Shop"` | string | Direct use |
| `gst_enabled` | `"true"` | boolean | `value === 'true'` |
| `default_gst_rate` | `"1800"` | number | `parseInt(value)` |
| `printer_config` | `"{...}"` | object | `JSON.parse(value)` |

---

### 3. Primary Key on `key`

**Benefits:**
- Fast lookups: `SELECT value FROM settings WHERE key = 'shop_name'`
- Prevents duplicate keys
- Automatic index

---

## Example Settings

### Shop Information

```sql
INSERT INTO settings (key, value) VALUES
  ('shop_name', 'Ramesh General Store'),
  ('shop_address', '123 Main Street, Mumbai'),
  ('shop_phone', '9876543210'),
  ('shop_gstin', '27XXXXX1234X1Z5');
```

---

### GST Configuration

```sql
INSERT INTO settings (key, value) VALUES
  ('gst_enabled', 'true'),
  ('default_gst_rate', '1800');  -- 18%
```

**Usage:**
```typescript
const gstEnabled = getSetting('gst_enabled') === 'true';
const defaultGstRate = parseInt(getSetting('default_gst_rate')); // 1800
```

---

### Printer Configuration

```sql
INSERT INTO settings (key, value) VALUES
  ('printer_enabled', 'true'),
  ('printer_name', 'Epson TM-T82'),
  ('printer_paper_width', '80');  -- 80mm
```

**Complex Configuration (JSON):**
```sql
INSERT INTO settings (key, value) VALUES
  ('printer_config', '{"name": "Epson TM-T82", "port": "USB001", "baudRate": 9600}');
```

**Usage:**
```typescript
const printerConfig = JSON.parse(getSetting('printer_config'));
console.log(printerConfig.name); // "Epson TM-T82"
```

---

### Receipt Configuration

```sql
INSERT INTO settings (key, value) VALUES
  ('receipt_header', 'Thank you for shopping with us!'),
  ('receipt_footer', 'Visit again!'),
  ('receipt_show_gstin', 'true');
```

---

### Language & Localization

```sql
INSERT INTO settings (key, value) VALUES
  ('language', 'en'),  -- 'en' or 'hi'
  ('currency', 'INR');
```

**Usage:**
```typescript
const language = getSetting('language'); // 'en' or 'hi'
const currencySymbol = getSetting('currency') === 'INR' ? '₹' : '$';
```

---

### Billing Settings

```sql
INSERT INTO settings (key, value) VALUES
  ('bill_prefix', 'BILL'),
  ('auto_print_receipt', 'false'),
  ('allow_discount', 'true'),
  ('max_discount_percent', '2000');  -- 20%
```

---

## Access Patterns

### Get Setting

```typescript
function getSetting(key: string): string {
  const result = db.queryOne(`
    SELECT value FROM settings WHERE key = ?
  `, [key]);
  
  return result?.value || '';
}

// Usage
const shopName = getSetting('shop_name');
const gstEnabled = getSetting('gst_enabled') === 'true';
```

---

### Set Setting

```typescript
function setSetting(key: string, value: string): void {
  db.execute(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = datetime('now')
  `, [key, value]);
}

// Usage
setSetting('shop_name', 'New Shop Name');
setSetting('gst_enabled', 'false');
```

---

### Get All Settings

```typescript
function getAllSettings(): Record<string, string> {
  const rows = db.queryAll(`SELECT key, value FROM settings`);
  
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {} as Record<string, string>);
}

// Usage
const settings = getAllSettings();
console.log(settings.shop_name);
console.log(settings.gst_enabled);
```

---

### Get Settings by Prefix

```typescript
function getSettingsByPrefix(prefix: string): Record<string, string> {
  const rows = db.queryAll(`
    SELECT key, value FROM settings WHERE key LIKE ?
  `, [`${prefix}%`]);
  
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {} as Record<string, string>);
}

// Usage
const printerSettings = getSettingsByPrefix('printer_');
// { printer_enabled: 'true', printer_name: 'Epson TM-T82', ... }
```

---

## Type-Safe Settings Helper

```typescript
// Define setting types
type SettingKey = 
  | 'shop_name'
  | 'gst_enabled'
  | 'default_gst_rate'
  | 'language'
  | 'printer_enabled';

type SettingValue<K extends SettingKey> = 
  K extends 'gst_enabled' | 'printer_enabled' ? boolean :
  K extends 'default_gst_rate' ? number :
  string;

// Type-safe getter
function getTypedSetting<K extends SettingKey>(key: K): SettingValue<K> {
  const value = getSetting(key);
  
  // Boolean settings
  if (key === 'gst_enabled' || key === 'printer_enabled') {
    return (value === 'true') as SettingValue<K>;
  }
  
  // Number settings
  if (key === 'default_gst_rate') {
    return parseInt(value) as SettingValue<K>;
  }
  
  // String settings
  return value as SettingValue<K>;
}

// Usage (type-safe!)
const shopName: string = getTypedSetting('shop_name');
const gstEnabled: boolean = getTypedSetting('gst_enabled');
const gstRate: number = getTypedSetting('default_gst_rate');
```

---

## Adding New Settings

**No schema changes needed!**

```typescript
// Just insert a new row
setSetting('new_feature_enabled', 'true');
setSetting('new_config_value', '42');

// Or via SQL
db.execute(`
  INSERT OR IGNORE INTO settings (key, value) VALUES ('new_setting', 'value')
`);
```

---

## Summary

| Aspect | Design Choice | Rationale |
|--------|---------------|-----------|
| **Structure** | Key-value (TEXT, TEXT) | Flexible, no schema changes |
| **Value type** | All TEXT | Application handles conversion |
| **Primary key** | `key` | Fast lookups, prevents duplicates |
| **Extensibility** | Add rows, not columns | No migrations needed |
| **Access pattern** | Get/Set by key | Simple, fast |

**The settings table is production-ready and infinitely extensible!**
