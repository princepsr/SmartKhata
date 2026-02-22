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

- **Day**: `strftime('%Y-%m-%d', created_at, 'localtime')`
- **Week**: `strftime('%Y-%W', created_at, 'localtime')`
- **Month**: `strftime('%Y-%m', created_at, 'localtime')`

It calculates growth by comparing the `totalSales` of the current index with `index - 1` in the result set.

### Currency Handling

All calculations in the repository are performed in **Rupees (REAL)** for direct consistency with the UI. The repository ensures that decimal precision is maintained for GST and final totals.

## IPC Integration

Reports are fetched via the following IPC channels:

- `report:sales`: Returns gross sales, net sales, and comparisons.
- `report:gst`: Returns GST slabs and totals.
- `report:analytics`: Returns periodic data for charts (Day/Week/Month).
- `report:bills`: Returns a paginated list of individual bills.
- `report:stock`: Returns low stock item summaries.

## Exporting

Data from any report can be exported via **`ExportService`**, which generates high-quality distribution documents:

- **Excel (.xlsx)**: Full data grid with optimized column widths.
- **PDF (.pdf)**: Formal business documents with shop branding, headers, and footer notes.
- **CSV (.csv)**: Raw data for external processing.

---

**Last updated:** 2026-02-22  
**Status:** ✅ Advanced analytics and multi-format exports verified
