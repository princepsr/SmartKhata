# Reports & Analytics Architecture

This document describes the design and data flow of the reporting system in SmartKhata POS.

## Overview

The reporting system provide real-time insights into sales, GST, inventory, and business trends. It follows the standard layered architecture (`UI → IPC → Service → Repository`).

## Key Components

### 1. `ReportService` (Main Process)

- **Purpose**: High-level business logic for reports.
- **Logic**:
  - Validates date ranges.
  - Calculates trend percentages (Growth/Decline).
  - Determines "Previous Period" automatically for comparisons.
  - Orchestrates data from `ReportRepository`.

### 2. `ReportRepository` (Main Process)

- **Purpose**: Optimized SQL queries for data aggregation.
- **Queries**:
  - **Daily Sales**: Aggregates `bills` and `bill_items` by date.
  - **GST Summary**: Groups items by tax slab (e.g., 5%, 12%, 18%).
  - **Trend Analytics**: Uses SQLite `strftime` to group data by Day, Week, or Month.
  - **Stock Summary**: Identifies products below their `low_stock_alert` threshold.

## Data Aggregation Logic

### Trend Analytics

The trend analytics engine groups sales data based on granularity:

- **Day**: `strftime('%Y-%m-%d', created_at)`
- **Week**: `strftime('%Y-%W', created_at)`
- **Month**: `strftime('%Y-%m', created_at)`

It calculates growth by comparing the `totalSales` of the current index with `index - 1` in the result set.

### Currency Handling

All calculations in the repository are performed in **Paisa (Integer)** to avoid rounding errors. The service layer converts these to **Rupees (Decimal)** before sending them to the UI.

## IPC Integration

Reports are fetched via the following IPC channels:

- `report:getDailySummary`: Returns gross sales, net sales, and comparisons.
- `report:getGstSummary`: Returns GST slabs and totals.
- `report:getTrendAnalytics`: Returns periodic data for charts.
- `report:getBillwise`: Returns a paginated list of individual bills.

## Exporting

Data from any report can be exported via `ExportService`, which generates a CSV file and prompts the user for a save location using Electron's `dialog.showSaveDialog`.
