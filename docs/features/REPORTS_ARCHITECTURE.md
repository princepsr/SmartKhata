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

### Trend Visualization (Trend Analysis)

The system provides a dynamic bar-graph visualization of performance metrics:

- **Interactive Selection**: Users can toggle between **Total Sales**, **Revenue**, **Gross Profit**, **Expenses**, and **Net Profit** to visualize trends.
- **Visual Presentation**:
  - **Centered Alignment**: Bars are centered in the view even with sparse data points.
  - **Live Labels**: Values are displayed directly above bars for immediate readability.
  - **Directional Feedback**: Bars expand upwards for positive values and downwards for negative values (Expenses/Losses).
- **Label Standardization**: Chart labels are synchronized with Summary Cards (e.g., "Gross Sales" is consistently labeled as **Total Sales**) to ensure cognitive consistency.

---

## 2. Professional Reporting Modules

### A. Sales & Profitability

- **Total Sales**: Gross revenue including taxes and before discounts.
- **Net Sales**: Final revenue received after proportional discounts and returns.
- **True Net Profit**: `(Gross Profit - Operating Expenses)`. This requires the system to cross-reference the `expenses` table for the same date range.
- **WhatsApp Summary**: A specialized formatter generates a markdown-optimized plain text summary for quick sharing via mobile messaging.
- **Udhaar Insights**: Detailed tracking of credit sales (`SALE`) and payments received (`PAYMENT_IN`) from the customer ledger for same-day reporting.

### C. Automated Daily Reports (Meta API)

SmartKhata includes a background automation engine that delivers sales summaries directly via the WhatsApp Business API.

- **Background Daemon**: `WhatsAppAutoReportService` (Main Process) checks every 30 mins for report triggers.
- **Reporting Trigger**: Configurable "Shop Closing" time (default 20:00). If the app is offline at the trigger time, it queues the report.
- **Resilience**: Integrated with `ConnectivityService` to automatically deliver missed reports immediately upon internet restoration.
- **Privacy First**: Securely uses system environment variables for API authentication, ensuring sensitive tokens are never exposed in user logs or settings exports.

### B. GST Compliance (GSTR-1 Alignment)

Aggregates sales by HSN-linked tax slabs (0%, 5%, 12%, 18%, 28%).

- **Calculation**: Tax is derived from the **Net Taxable Subtotal** (Post-Discount) to ensure legal compliance.
- **Splitting**: Automatically calculates `CGST/SGST` (Intrastate) or `IGST` (Interstate) based on the `supply_type` metadata.

---

## 3. Stock Health & Aging View

### A. UI Presentation

The Stock View utilizes a modern **Pill-style navigation** system for switching between sub-tabs, ensuring a consistent design language with the rest of the application.

### B. Current Stock

Real-time view of inventory levels, highlighting low-stock items based on user-defined alerts.

### C. Stock Aging (Dead Stock)

Identifies "Dead Stock" or slow-moving items:

- **Idle Days**: Calculates `currentDate - lastSaleDate`.
- **Threshold**: Defaults to 30 days of inactivity.
- **Valuation**: `stockQty * purchasePrice`. Helps owners identify capital tied up in non-performing inventory.

---

## 4. Data Flow & Aggregation Logic

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
