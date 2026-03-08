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
      WITH BillSet AS (
        SELECT id, grand_total, discount_amount, subtotal, gst_total
        FROM bills
        WHERE date(created_at, 'localtime') BETWEEN date(?) AND date(?)
      ),
      ItemAggs AS (
        SELECT 
          COALESCE(SUM(
            CASE 
              WHEN bi.purchase_price IS NOT NULL AND bi.purchase_price > 0 
              THEN (
                CASE 
                  WHEN b.gst_total = 0 THEN bi.line_total 
                  ELSE ROUND(bi.line_total / (1 + bi.gst_percent / 100.0), 2)
                END
              ) - (bi.quantity * bi.purchase_price)
              ELSE 0 
            END
          ), 0) as totalProfit,
          COALESCE(SUM(
            CASE 
              WHEN bi.purchase_price IS NOT NULL AND bi.purchase_price > 0 
              THEN (
                CASE 
                  WHEN b.gst_total = 0 THEN bi.line_total 
                  ELSE ROUND(bi.line_total / (1 + bi.gst_percent / 100.0), 2)
                END
              )
              ELSE 0 
            END
          ), 0) as salesWithCost,
          COALESCE(SUM(
            CASE 
              WHEN b.gst_total = 0 THEN bi.line_total 
              ELSE ROUND(bi.line_total / (1 + bi.gst_percent / 100.0), 2)
            END
          ), 0) as totalItemSales
        FROM bill_items bi
        JOIN bills b ON b.id = bi.bill_id
        WHERE bi.bill_id IN (SELECT id FROM BillSet)
      )
      SELECT 
        (SELECT COUNT(*) FROM BillSet) as billCount,
        (SELECT COALESCE(SUM(grand_total + discount_amount), 0) FROM BillSet) as totalSales,
        (SELECT COALESCE(SUM(grand_total), 0) FROM BillSet) as netSales,
        (SELECT COALESCE(SUM(subtotal), 0) FROM BillSet) as totalSubtotal,
        (SELECT COALESCE(SUM(gst_total), 0) FROM BillSet) as totalGst,
        (SELECT COALESCE(SUM(discount_amount), 0) FROM BillSet) as totalDiscount,
        totalProfit,
        salesWithCost,
        totalItemSales
      FROM ItemAggs
    `;

    const result = this.db.prepare(query).get(startDate, endDate) as {
      billCount: number;
      totalSales: number;
      netSales: number;
      totalSubtotal: number;
      totalGst: number;
      totalDiscount: number;
      totalProfit: number;
      salesWithCost: number;
      totalItemSales: number;
    };

    const marginPercent =
      result.totalSubtotal > 0
        ? Math.round((result.totalProfit / result.totalSubtotal) * 10000) / 100
        : 0;

    // Calculate previous period for comparison
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const prevEnd = new Date(start.getTime() - 86400000); // 1 day before startDate
    const prevStart = new Date(prevEnd.getTime() - (diffDays - 1) * 86400000);

    const toLocalISO = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    const prevResult = this.db.prepare(query).get(toLocalISO(prevStart), toLocalISO(prevEnd)) as {
      totalSales: number;
      totalDiscount: number;
      billCount: number;
      netSales: number;
      totalProfit: number;
      salesWithCost: number;
      totalItemSales: number;
    };

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
      totalSales: result.totalSales,
      netSales: result.netSales,
      totalSubtotal: result.totalSubtotal,
      totalGst: result.totalGst,
      totalDiscount: result.totalDiscount,
      totalProfit: result.totalProfit,
      totalExpenses: 0,
      trueNetProfit: 0,
      marginPercent: marginPercent,
      salesWithCost: result.salesWithCost,
      totalItemSales: result.totalItemSales,
      comparison: {
        totalSales: calculateTrend(result.totalSales, prevResult.totalSales),
        netSales: calculateTrend(result.netSales, prevResult.netSales),
        totalDiscount: calculateTrend(result.totalDiscount, prevResult.totalDiscount),
        totalProfit: calculateTrend(result.totalProfit, prevResult.totalProfit),
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

    const results = this.db.prepare(query).all(startDate, endDate) as {
      mode: 'cash' | 'upi' | 'mixed';
      count: number;
      totalAmount: number;
    }[];

    return results.map((row) => ({
      mode: row.mode,
      count: row.count,
      totalAmount: row.totalAmount, // Direct Rupees
    }));
  }

  /**
   * Get GST Breakdown Summary — includes CGST/SGST/IGST from bills table
   */
  public getGstSummary(startDate: string, endDate: string): GstReport {
    // Get supply type from settings to determine CGST/SGST vs IGST split
    const configRow = this.db.prepare(`SELECT supply_type FROM app_config LIMIT 1`).get() as
      | { supply_type: string }
      | undefined;
    const supplyType = configRow?.supply_type || 'intrastate';
    const isIntrastate = supplyType !== 'interstate';

    // Aggregate CGST/SGST/IGST directly from bills table (already computed at billing time)
    const billTotalsQuery = `
      SELECT
        COALESCE(SUM(cgst_amount), 0) as totalCgst,
        COALESCE(SUM(sgst_amount), 0) as totalSgst,
        COALESCE(SUM(igst_amount), 0) as totalIgst
      FROM bills
      WHERE date(created_at, 'localtime') BETWEEN date(?) AND date(?)
    `;
    const billTotals = this.db.prepare(billTotalsQuery).get(startDate, endDate) as {
      totalCgst: number;
      totalSgst: number;
      totalIgst: number;
    };

    // --- NEW: FETCH CREDIT NOTE RETURNS ---
    const cnQuery = `
      SELECT COALESCE(SUM(gst_total), 0) as totalCnGst
      FROM credit_notes
      WHERE date(created_at, 'localtime') BETWEEN date(?) AND date(?)
    `;
    const cnResult = this.db.prepare(cnQuery).get(startDate, endDate) as {
      totalCnGst: number;
    };

    // --- NEW: FETCH PURCHASE ITC ---
    const purchaseQuery = `
      SELECT COALESCE(SUM(gst_total), 0) as totalItc
      FROM purchases
      WHERE date(invoice_date) BETWEEN date(?) AND date(?)
    `;
    const purchaseResult = this.db.prepare(purchaseQuery).get(startDate, endDate) as {
      totalItc: number;
    };

    // Slab-level query (taxable / gst / total per GST rate)
    const query = `
      SELECT 
        bi.gst_percent as gstPercent,
        COALESCE(SUM(
          CASE 
            WHEN b.gst_total = 0 THEN bi.line_total
            WHEN bi.line_total > (bi.quantity * bi.unit_price) + 0.01 THEN bi.quantity * bi.unit_price
            ELSE ROUND(bi.line_total / (1 + bi.gst_percent / 100.0), 2)
          END
        ), 0) as taxableAmount,
        COALESCE(SUM(
          CASE 
            WHEN b.gst_total = 0 THEN 0
            WHEN bi.line_total > (bi.quantity * bi.unit_price) + 0.01 THEN bi.line_total - (bi.quantity * bi.unit_price)
            ELSE ROUND(bi.line_total - (bi.line_total / (1 + bi.gst_percent / 100.0)), 2)
          END
        ), 0) as gstAmount, 
        COALESCE(SUM(bi.line_total), 0) as totalAmount
      FROM bill_items bi
      JOIN bills b ON b.id = bi.bill_id
      WHERE date(b.created_at, 'localtime') BETWEEN date(?) AND date(?)
      GROUP BY bi.gst_percent
      ORDER BY bi.gst_percent ASC
    `;

    const rawSlabs = this.db.prepare(query).all(startDate, endDate) as {
      gstPercent: number;
      taxableAmount: number;
      gstAmount: number;
      totalAmount: number;
    }[];

    let totalTaxable = 0;
    let totalAmount = 0;

    rawSlabs.forEach((slab) => {
      totalTaxable += slab.taxableAmount;
      totalAmount += slab.totalAmount;
    });

    // Build typed slabs with CGST/SGST/IGST split per slab
    const slabs: GstTaxSlab[] = rawSlabs.map((s) => ({
      gstPercent: s.gstPercent,
      taxableAmount: s.taxableAmount,
      gstAmount: s.gstAmount,
      cgstAmount: isIntrastate ? Math.round((s.gstAmount / 2) * 100) / 100 : 0,
      sgstAmount: isIntrastate ? Math.round((s.gstAmount / 2) * 100) / 100 : 0,
      igstAmount: isIntrastate ? 0 : s.gstAmount,
      totalAmount: s.totalAmount,
    }));

    const grossGst = billTotals.totalCgst + billTotals.totalSgst + billTotals.totalIgst;
    const netGstPayable = Math.max(0, grossGst - cnResult.totalCnGst - purchaseResult.totalItc);

    return {
      slabs,
      totalTaxable,
      totalGst: grossGst,
      totalCgst: billTotals.totalCgst,
      totalSgst: billTotals.totalSgst,
      totalIgst: billTotals.totalIgst,
      totalCreditNoteGst: cnResult.totalCnGst,
      totalPurchaseItc: purchaseResult.totalItc,
      netGstPayable: Math.round(netGstPayable * 100) / 100,
      totalAmount,
      supplyType,
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
    const aggResult = this.db.prepare(aggQuery).get() as {
      totalItems: number;
      totalStockValue: number;
      lowStockCount: number;
    };

    let listQuery = `
      SELECT id, name, sku, stock_qty as stockQty, low_stock_alert as lowStockAlert, sale_price as salePrice, batch_number as batchNumber, expiry_date as expiryDate
      FROM products
      WHERE is_active = 1
    `;

    if (filter === 'low_stock') {
      listQuery += ` AND stock_qty <= low_stock_alert`;
    }

    listQuery += ` ORDER BY name ASC`;

    const items = this.db.prepare(listQuery).all() as (StockItem & { salePrice: number })[];

    return {
      totalItems: aggResult.totalItems,
      totalStockValue: aggResult.totalStockValue, // Direct Rupees
      lowStockCount: aggResult.lowStockCount || 0,
      items: items.map((item) => ({
        ...item,
        salePrice: item.salePrice,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
      })),
    };
  }

  /**
   * Get Near Expiry Report
   */
  public getNearExpiryReport(daysAhead: number = 60): StockItem[] {
    const query = `
      SELECT id, name, sku, stock_qty as stockQty, low_stock_alert as lowStockAlert, sale_price as salePrice, batch_number as batchNumber, expiry_date as expiryDate
      FROM products
      WHERE is_active = 1 
      AND expiry_date IS NOT NULL 
      AND expiry_date != ''
      AND date(expiry_date) <= date('now', '+' || ? || ' days')
      AND date(expiry_date) >= date('now')
      ORDER BY expiry_date ASC
    `;

    const items = this.db.prepare(query).all(daysAhead) as StockItem[];
    return items;
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

    const rows = this.db.prepare(query).all(startDate, endDate, limit, offset) as {
      id: number;
      billNumber: string;
      date: string;
      total: number;
      paymentMode: string;
      customerName: string;
      itemCount: number;
    }[];

    const data = rows.map((row) => ({
      id: row.id,
      billNumber: row.billNumber,
      date: row.date,
      customerName: row.customerName,
      itemCount: row.itemCount,
      total: row.total, // Direct Rupees
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
        periodId,
        COUNT(id) as billCount,
        COALESCE(SUM(totalSales), 0) as totalSales,
        COALESCE(SUM(netSales), 0) as netSales,
        COALESCE(SUM(totalProfit), 0) as totalProfit,
        COALESCE(SUM(salesWithCost), 0) as salesWithCost,
        COALESCE(SUM(totalItemSales), 0) as totalItemSales
      FROM (
        SELECT 
           strftime('${dateFormat}', b.created_at, 'localtime') as periodId,
           b.id,
           b.grand_total + b.discount_amount as totalSales,
            b.grand_total as netSales,
            COALESCE(SUM(
             CASE 
               WHEN bi.purchase_price IS NOT NULL AND bi.purchase_price > 0 
               THEN (
                 CASE 
                   WHEN b.gst_total = 0 THEN bi.line_total 
                   ELSE ROUND(bi.line_total / (1 + bi.gst_percent / 100.0), 2)
                 END
               ) - (bi.quantity * bi.purchase_price)
               ELSE 0 
             END
           ), 0) as totalProfit,
           COALESCE(SUM(
             CASE 
               WHEN bi.purchase_price IS NOT NULL AND bi.purchase_price > 0 
               THEN (
                 CASE 
                   WHEN b.gst_total = 0 THEN bi.line_total 
                   ELSE ROUND(bi.line_total / (1 + bi.gst_percent / 100.0), 2)
                 END
               )
               ELSE 0 
             END
           ), 0) as salesWithCost,
           COALESCE(SUM(
             CASE 
               WHEN b.gst_total = 0 THEN bi.line_total 
               ELSE ROUND(bi.line_total / (1 + bi.gst_percent / 100.0), 2)
             END
           ), 0) as totalItemSales
         FROM bills b
         LEFT JOIN bill_items bi ON b.id = bi.bill_id
         WHERE date(b.created_at, 'localtime') BETWEEN date(?) AND date(?)
         GROUP BY b.id
       )
      GROUP BY periodId
      ORDER BY periodId ASC
    `;

    const rows = this.db.prepare(query).all(startDate, endDate) as {
      periodId: string;
      billCount: number;
      totalSales: number;
      netSales: number;
      totalProfit: number;
      salesWithCost: number;
      totalItemSales: number;
    }[];

    let runningTotalSales = 0;
    let runningNetSales = 0;
    let runningBills = 0;
    let runningProfit = 0;

    const periods: AnalyticsPeriod[] = rows.map((row, index) => {
      const currentSales = row.totalSales;
      runningTotalSales += currentSales;
      runningNetSales += row.netSales;
      runningBills += row.billCount;
      runningProfit += row.totalProfit;

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
        // Force local interpretation of YYYY-MM-DD by replacing hyphens or using parts
        const [y, m, d] = row.periodId.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        label = date.toLocaleDateString('default', { day: 'numeric', month: 'short' });
      }

      return {
        periodId: row.periodId,
        period: label,
        totalSales: row.totalSales,
        netSales: row.netSales,
        totalProfit: row.totalProfit,
        totalExpenses: 0,
        trueNetProfit: 0,
        salesWithCost: row.salesWithCost,
        totalItemSales: row.totalItemSales,
        marginPercent:
          row.totalItemSales > 0
            ? Math.round((row.totalProfit / row.totalItemSales) * 1000) / 10
            : 0,
        billCount: row.billCount,
        growth,
      };
    });

    return {
      startDate,
      endDate,
      granularity,
      totalSales: runningTotalSales,
      totalNet: runningNetSales,
      totalExpenses: 0,
      totalProfit: runningProfit,
      totalBills: runningBills,
      periods,
    };
  }

  /**
   * Get Udhaar (Credit) Summary for a date range
   * Fetches total credit given (SALE) and total payments received (PAYMENT_IN) from customer_ledger
   */
  public getUdhaarSummary(
    startDate: string,
    endDate: string
  ): { creditGiven: number; paymentsReceived: number } {
    const query = `
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'SALE' THEN amount ELSE 0 END), 0) as creditGiven,
        COALESCE(SUM(CASE WHEN type = 'PAYMENT_IN' THEN amount ELSE 0 END), 0) as paymentsReceived
      FROM customer_ledger
      WHERE date(created_at, 'localtime') BETWEEN date(?) AND date(?)
    `;

    const result = this.db.prepare(query).get(startDate, endDate) as {
      creditGiven: number;
      paymentsReceived: number;
    };

    return result;
  }
}
