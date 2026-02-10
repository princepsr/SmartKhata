import { BaseRepository } from './base-repository';
import {
  DailySalesSummary,
  PaymentModeSummary,
  GstReport,
  GstTaxSlab,
  StockSummary,
  StockItem,
  BillSummary,
  PaginatedResult,
  TrendAnalytics,
  AnalyticsPeriod,
} from '../../shared/types/report.types';

export class ReportRepository extends BaseRepository {
  /**
   * Get Daily Sales Summary for a date range
   */
  public getDailySalesSummary(startDate: string, endDate: string): DailySalesSummary {
    const query = `
      SELECT 
        COUNT(id) as billCount,
        COALESCE(SUM(grand_total + discount_amount), 0) as totalSales,
        COALESCE(SUM(grand_total), 0) as netSales,
        COALESCE(SUM(subtotal), 0) as totalSubtotal,
        COALESCE(SUM(gst_total), 0) as totalGst,
        COALESCE(SUM(discount_amount), 0) as totalDiscount
      FROM bills
      WHERE date(created_at, 'localtime') BETWEEN date(?) AND date(?)
    `;

    const result = this.db.prepare(query).get(startDate, endDate) as any;

    // Calculate previous period for comparison
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const prevEnd = new Date(start.getTime() - 86400000); // 1 day before startDate
    const prevStart = new Date(prevEnd.getTime() - (diffDays - 1) * 86400000);

    const prevResult = this.db
      .prepare(query)
      .get(prevStart.toISOString().split('T')[0], prevEnd.toISOString().split('T')[0]) as any;

    const calculateTrend = (current: number, previous: number) => {
      if (previous === 0) {
        return { change: 0, trend: 'neutral' as const };
      }
      const change = ((current - previous) / previous) * 100;
      return {
        change: Math.abs(Math.round(change * 10) / 10),
        trend: change > 0 ? ('up' as const) : change < 0 ? ('down' as const) : ('neutral' as const),
      };
    };

    return {
      date: startDate === endDate ? startDate : `${startDate} to ${endDate}`,
      billCount: result.billCount,
      totalSales: result.totalSales / 100,
      netSales: result.netSales / 100,
      totalSubtotal: result.totalSubtotal / 100,
      totalGst: result.totalGst / 100,
      totalDiscount: result.totalDiscount / 100,
      comparison: {
        totalSales: calculateTrend(result.totalSales, prevResult.totalSales),
        netSales: calculateTrend(result.netSales, prevResult.netSales),
        totalDiscount: calculateTrend(result.totalDiscount, prevResult.totalDiscount),
        billCount: calculateTrend(result.billCount, prevResult.billCount),
      },
    };
  }

  /**
   * Get Payment Mode Summary
   */
  public getPaymentModeSummary(startDate: string, endDate: string): PaymentModeSummary[] {
    const query = `
      SELECT 
        payment_mode as mode,
        COUNT(id) as count,
        COALESCE(SUM(grand_total), 0) as totalAmount
      FROM bills
      WHERE date(created_at, 'localtime') BETWEEN date(?) AND date(?)
      GROUP BY payment_mode
    `;

    const results = this.db.prepare(query).all(startDate, endDate) as any[];

    return results.map((row) => ({
      mode: row.mode,
      count: row.count,
      totalAmount: row.totalAmount / 100, // Paise -> Rupees
    }));
  }

  /**
   * Get GST Breakdown Summary
   */
  public getGstSummary(startDate: string, endDate: string): GstReport {
    const query = `
      SELECT 
        bi.gst_percent as gstPercent,
        COALESCE(SUM(bi.quantity * bi.unit_price), 0) as taxableAmount,
        COALESCE(SUM(bi.line_total - (bi.quantity * bi.unit_price)), 0) as gstAmount, 
        COALESCE(SUM(bi.line_total), 0) as totalAmount
      FROM bill_items bi
      JOIN bills b ON b.id = bi.bill_id
      WHERE date(b.created_at, 'localtime') BETWEEN date(?) AND date(?)
      GROUP BY bi.gst_percent
      ORDER BY bi.gst_percent ASC
    `;

    const slabs = this.db.prepare(query).all(startDate, endDate) as GstTaxSlab[];

    let totalTaxable = 0;
    let totalGst = 0;
    let totalAmount = 0;

    slabs.forEach((slab) => {
      totalTaxable += slab.taxableAmount;
      totalGst += slab.gstAmount;
      totalAmount += slab.totalAmount;
    });

    return {
      slabs: slabs.map((s) => ({
        ...s,
        taxableAmount: s.taxableAmount / 100, // Paise -> Rupees
        gstAmount: s.gstAmount / 100,
        totalAmount: s.totalAmount / 100,
      })),
      totalTaxable: totalTaxable / 100,
      totalGst: totalGst / 100,
      totalAmount: totalAmount / 100,
    };
  }

  /**
   * Get Stock Summary (Current State)
   */
  public getStockSummary(filter: 'all' | 'low_stock' = 'all'): StockSummary {
    const aggQuery = `
      SELECT 
        COUNT(id) as totalItems,
        COALESCE(SUM(stock_qty * purchase_price), 0) as totalStockValue,
        SUM(CASE WHEN stock_qty <= low_stock_alert THEN 1 ELSE 0 END) as lowStockCount
      FROM products
      WHERE is_active = 1
    `;
    const aggResult = this.db.prepare(aggQuery).get() as any;

    let listQuery = `
      SELECT id, name, sku, stock_qty as stockQty, low_stock_alert as lowStockAlert, sale_price as salePrice
      FROM products
      WHERE is_active = 1
    `;

    if (filter === 'low_stock') {
      listQuery += ` AND stock_qty <= low_stock_alert`;
    }

    listQuery += ` ORDER BY name ASC`;

    const items = this.db.prepare(listQuery).all() as any[];

    return {
      totalItems: aggResult.totalItems,
      totalStockValue: aggResult.totalStockValue / 100, // Paise -> Rupees
      lowStockCount: aggResult.lowStockCount || 0,
      items: items.map((item) => ({
        ...item,
        salePrice: item.salePrice / 100,
      })),
    };
  }

  /**
   * Get Bill-wise Sales List with Pagination
   */
  public getBillwiseSales(
    startDate: string,
    endDate: string,
    page: number = 1,
    limit: number = 50
  ): PaginatedResult<BillSummary> {
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM bills
      WHERE date(created_at, 'localtime') BETWEEN date(?) AND date(?)
    `;
    const totalResult = this.db.prepare(countQuery).get(startDate, endDate) as { total: number };
    const total = totalResult.total;

    const query = `
      SELECT 
        b.id,
        b.bill_number as billNumber,
        b.created_at as date,
        b.grand_total as total,
        b.payment_mode as paymentMode,
        c.name as customerName,
        (SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = b.id) as itemCount
      FROM bills b
      LEFT JOIN customers c ON b.customer_id = c.id
      WHERE date(b.created_at, 'localtime') BETWEEN date(?) AND date(?)
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = this.db.prepare(query).all(startDate, endDate, limit, offset) as any[];

    const data = rows.map((row) => ({
      id: row.id,
      billNumber: row.billNumber,
      date: row.date,
      customerName: row.customerName,
      itemCount: row.itemCount,
      total: row.total / 100, // Paise -> Rupees
      paymentMode: row.paymentMode,
    }));

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Get Yearly Analytics Breakdown
   */
  /**
   * Get Trend Analytics (Daily, Weekly, Monthly)
   */
  public getTrendAnalytics(
    startDate: string,
    endDate: string,
    granularity: 'day' | 'week' | 'month'
  ): TrendAnalytics {
    let dateFormat = '%Y-%m-%d';
    if (granularity === 'week') {
      dateFormat = '%Y-%W';
    }
    if (granularity === 'month') {
      dateFormat = '%Y-%m';
    }

    const query = `
      SELECT 
        strftime('${dateFormat}', created_at, 'localtime') as periodId,
        COUNT(id) as billCount,
        COALESCE(SUM(grand_total + discount_amount), 0) as totalSales,
        COALESCE(SUM(grand_total), 0) as netSales
      FROM bills
      WHERE date(created_at, 'localtime') BETWEEN date(?) AND date(?)
      GROUP BY periodId
      ORDER BY periodId ASC
    `;

    const rows = this.db.prepare(query).all(startDate, endDate) as any[];

    let runningTotalSales = 0;
    let runningNetSales = 0;
    let runningBills = 0;

    const periods: AnalyticsPeriod[] = rows.map((row, index) => {
      const currentSales = row.totalSales;
      runningTotalSales += currentSales;
      runningNetSales += row.netSales;
      runningBills += row.billCount;

      let growth = 0;
      if (index > 0) {
        const prevSales = rows[index - 1].totalSales;
        if (prevSales > 0) {
          growth = Math.round(((currentSales - prevSales) / prevSales) * 1000) / 10;
        }
      }

      // Format label based on granularity
      let label = row.periodId;
      if (granularity === 'month') {
        const [y, m] = row.periodId.split('-');
        const date = new Date(parseInt(y), parseInt(m) - 1, 1);
        label = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      } else if (granularity === 'week') {
        const [y, w] = row.periodId.split('-');
        label = `W${w} '${y.slice(2)}`;
      } else {
        // Daily: "DD Mon"
        const date = new Date(row.periodId);
        label = date.toLocaleDateString('default', { day: 'numeric', month: 'short' });
      }

      return {
        periodId: row.periodId,
        period: label,
        totalSales: row.totalSales / 100,
        netSales: row.netSales / 100,
        billCount: row.billCount,
        growth,
      };
    });

    return {
      startDate,
      endDate,
      granularity,
      totalSales: runningTotalSales / 100,
      totalNet: runningNetSales / 100,
      totalBills: runningBills,
      periods,
    };
  }
}
