# Reports & Analytics Architecture (Business Intelligence Engine)

SmartKhata's reporting system is designed for high-performance, real-time data aggregation directly from the local SQLite database. It provides multi-dimensional insights into sales, tax, and inventory health.

---

## 1. Comparative Analysis Engine

The `ReportService` implements a reactive comparison engine that automatically evaluates business performance against historical data.

### Automatic Previous Period Mapping
To provide growth context, the service dynamically derives a comparison range:
- **Duration**: `inclusiveDays = (EndDate - StartDate)`.
- **Mapping**: `PrevEndDate = StartDate - 1 day` and `PrevStartDate = PrevEndDate - duration`.
- **Example**: A report for "This Week" (7 days) will automatically be compared against "Last Week" (the preceding 7 days).

### Trend Calculation Logic
Growth/Decline percentages are calculated using the standard formula:
`Trend % = ((CurrentValue - PreviousValue) / PreviousValue) * 100`
- **Threshold**: Changes within **±0.05%** are classified as `neutral`. Anything above `0.05%` is `up`, and below `-0.05%` is `down`.
- **Zero-Guard**: If the previous value is `0`, a `100% up` trend is reported to prevent division-by-zero errors while providing visual feedback of new growth.

---

## 2. Professional Reporting Modules

### A. Sales & Profitability
- **Total Sales**: Gross revenue including taxes and before discounts.
- **Net Sales**: Final revenue received after proportional discounts and returns.
- **True Net Profit**: `(Gross Profit - Operating Expenses)`. This requires the system to cross-reference the `expenses` table for the same date range.
- **WhatsApp Summary**: A specialized formatter generates a markdown-optimized plain text summary for quick sharing via mobile messaging.

### B. GST Compliance (GSTR-1 Alignment)
Aggregates sales by HSN-linked tax slabs (0%, 5%, 12%, 18%, 28%).
- **Calculation**: Tax is derived from the **Net Taxable Subtotal** (Post-Discount) to ensure legal compliance.
- **Splitting**: Automatically calculates `CGST/SGST` (Intrastate) or `IGST` (Interstate) based on the `supply_type` metadata.

### C. Inventory Health (Stock Aging)
Identifies "Dead Stock" or slow-moving items:
- **Idle Days**: Calculates `currentDate - lastSaleDate`.
- **Threshold**: Defaults to 30 days of inactivity.
- **Valuation**: `stockQty * purchasePrice`. Helps owners identify capital tied up in non-performing inventory.

---

## 3. Data Flow & Aggregation Logic

### SQLite Date Modifiers
All time-based reports use the `localtime` modifier to ensure that UTC-stored timestamps are correctly grouped by the shop's local business day:
`GROUP BY date(created_at, 'localtime')`

### Granular Analytics
The system supports three levels of temporal grouping:
- **Day**: `strftime('%Y-%m-%d')` for daily performance.
- **Week**: `strftime('%Y-%W')` for operational cycles.
- **Month**: `strftime('%Y-%m')` for high-level fiscal tracking.

---

## Technical Reference
- **Main Service**: `src/main/services/report-service.ts`
- **Aggregation Layer**: `src/main/repositories/report-repository.ts` (Native SQL optimization).
- **Type Definitions**: `src/shared/types/report.types.ts`.
