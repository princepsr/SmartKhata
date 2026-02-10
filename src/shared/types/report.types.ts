/**
 * Report Data Structures
 * Shared between Main and Renderer processes
 */

export interface DateRange {
  startDate: string; // ISO Date string (YYYY-MM-DD)
  endDate: string; // ISO Date string (YYYY-MM-DD)
}

export interface ReportFilter {
  dateRange: DateRange;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Trend comparison data
export interface ComparisonTrend {
  change: number; // Percentage change (e.g., 12.5)
  trend: 'up' | 'down' | 'neutral';
}

// 1. Daily Sales Summary
export interface DailySalesSummary {
  date: string;
  totalSales: number; // Gross Sales (Subtotal + GST)
  totalSubtotal: number; // Sum of subtotal
  totalGst: number; // Sum of gst_total
  totalDiscount: number; // Sum of discount_amount
  netSales: number; // Grand Total (Revenue)
  billCount: number; // Count of bills
  comparison?: {
    totalSales?: ComparisonTrend;
    netSales?: ComparisonTrend;
    totalDiscount?: ComparisonTrend;
    billCount?: ComparisonTrend;
  };
}

// 2. Payment Mode Summary
export interface PaymentModeSummary {
  mode: 'cash' | 'upi' | 'mixed';
  count: number;
  totalAmount: number;
}

// 3. GST Summary
export interface GstTaxSlab {
  gstPercent: number; // e.g., 1800 (18%)
  taxableAmount: number; // Sum of line_subtotal
  gstAmount: number; // Sum of line_gst
  totalAmount: number; // Sum of line_total
}

export interface GstReport {
  slabs: GstTaxSlab[];
  totalTaxable: number;
  totalGst: number;
  totalAmount: number;
}

// 4. Stock Summary
export interface StockItem {
  id: number;
  name: string;
  sku: string | null;
  stockQty: number;
  lowStockAlert: number;
  salePrice: number;
}

export interface StockSummary {
  totalItems: number; // Distinct products
  totalStockValue: number; // Sum of (stock * purchase_price)
  lowStockCount: number;
  items: StockItem[];
}

// 5. Bill Summary (for Bill-wise report)
export interface BillSummary {
  id: number;
  billNumber: string;
  date: string;
  customerName?: string;
  itemCount: number;
  total: number;
  paymentMode: string;
}
// 6. Analytics & Trends
export interface AnalyticsPeriod {
  period: string; // e.g., "Jan", "Week 12"
  totalSales: number;
  netSales: number;
  billCount: number;
  growth: number; // % change from prev period
}

export interface TrendAnalytics {
  startDate: string;
  endDate: string;
  granularity: 'day' | 'week' | 'month';
  totalSales: number;
  totalNet: number;
  totalBills: number;
  periods: AnalyticsPeriod[];
}
