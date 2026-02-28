# Expenses Table Design

## Overview

The `expenses` table tracks daily operational expenditures (Overheads). This is critical for generating true **Net Profit** reports that account for both COGS and running costs (Rent, Salaries, Electricity).

---

## Table Definition

```sql
CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount >= 0),
  date TEXT NOT NULL,
  payment_mode TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Column Specifications

### Categorization

| Column     | Type | Constraints | Description                                   |
| ---------- | ---- | ----------- | --------------------------------------------- |
| `category` | TEXT | NOT NULL    | Salary, Rent, Bill, Misc, Opening Capital     |

**Common Categories:**

- **Salary/Staff**: Weekly or monthly worker payouts.
- **Rent**: Shop premises lease.
- **Utilities**: Electricity, Water, Internet bills.
- **Others**: Repairs, cleaning, etc.

---

### Financial Tracking

| Column         | Type | Constraints | Description                              |
| -------------- | ---- | ----------- | ---------------------------------------- |
| `amount`       | REAL | NOT NULL    | Value spent in Rupees                   |
| `payment_mode` | TEXT | NOT NULL    | Source of funds (Cash, UPI, Wallet)      |

---

### Audit Data

| Column       | Type | Constraints | Description                               |
| ------------ | ---- | ----------- | ----------------------------------------- |
| `date`       | TEXT | NOT NULL    | The actual date expense occurred (YYYY-MM-DD)|
| `created_at` | TEXT | DEFAULT(now)| System punch-in time                      |

---

## Design Choices

### 1. P&L Impact
Unlike `bills` (which generate revenue), `expenses` are pure outflows. The `ReportService` subtracts the sum of this table from the Gross Margin to arrive at **Net Profit**.

### 2. Timezone Stability
The `date` field is stored as a simple `YYYY-MM-DD` string. This prevents timezone shifts from moving a late-night expense into the next business day's report unfairly.

---

## Indexes

```sql
-- Fast sorting for daily/monthly expense reports
CREATE INDEX idx_expenses_date ON expenses(date);

-- Grouping for pie-chart visualizations (Spending breakdown)
CREATE INDEX idx_expenses_category ON expenses(category);
```

---

## Usage Examples

### Monthly Net Profit Formula

```typescript
// Calculation in ReportService
const netProfit = (TotalRevenue - TotalGst - TotalCogs) - TotalExpenses;
```

---

## Summary

| Aspect              | Design Choice                 | Rationale                                |
| ------------------- | ----------------------------- | ---------------------------------------- |
| **Simplicity**      | Flat category strings         | Easy to expand without schema changes    |
| **Reporting**       | Rupee (REAL) storage          | Math parity with sales and purchases     |
| **Integrity**       | CHECK(amount >= 0)            | Prevents accidental negative expense bugs|

**The expenses table ensures your business profit reporting accounts for every rupee spent!**
