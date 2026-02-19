import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReportService } from '../../src/main/services/report-service';
import { BillingService } from '../../src/main/services/billing-service';

import {
  createTestDatabase,
  resetTestDatabase,
  seedTestData,
  type BetterSqliteCompatibleDatabase,
} from '../utils/test-db';

describe('ReportService Integration Tests', () => {
  let db: BetterSqliteCompatibleDatabase;
  let reportService: ReportService;
  let billingService: BillingService;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    reportService = new ReportService();
    billingService = new BillingService();
    // productRepo = new ProductRepository(); // Not used directly in most tests anymore
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  const generateBill = (
    items: { productId: number; quantity: number }[],
    mode: 'cash' | 'upi' = 'cash',
    billNoSuffix: string,
    discount: number = 0,
    date?: string // Optional date format 'YYYY-MM-DD'
  ) => {
    const billNumber = `BILL-TEST-${billNoSuffix}`;
    billingService.finalizeBill({
      billNumber,
      items,
      paymentMode: mode,
      discountAmount: discount,
    });

    const targetDate = date || new Date().toISOString().split('T')[0];
    db.exec(
      `UPDATE bills SET created_at = '${targetDate} 12:00:00' WHERE bill_number = '${billNumber}'`
    );
  };

  it('should generate correct Daily Sales Summary with Discounts', () => {
    // seeded products:
    // 1: Coca Cola 500ml (Price: 4000 (Paise) -> 40.00 Rs, GST: 18%) -> Total: 47.20 Rs
    // 2: Lays Chips (Price: 2000 (Paise) -> 20.00 Rs, GST: 12%) -> Total: 22.40 Rs

    // Bill 1: 1 Coke. Total 47.20. Discount 0.
    generateBill([{ productId: 1, quantity: 1 }], 'cash', '001', 0);

    // Bill 2: 2 Lays. Total 44.80. Discount 4.80. Net = 40.00.
    // Gross for this bill = 44.80.
    generateBill([{ productId: 2, quantity: 2 }], 'cash', '002', 4.8);

    const today = new Date().toISOString().split('T')[0];
    const summary = reportService.getDailySalesSummary(today, today);

    expect(summary).toBeDefined();
    expect(summary.billCount).toBe(2);

    // Gross Sales = Sum(GrandTotal + Discount) = (47.20 + 0) + (40.00 + 4.80) = 47.20 + 44.80 = 92.00
    expect(summary.totalSales).toBe(92.0);

    // Total Discount = 0 + 4.80 = 4.80
    expect(summary.totalDiscount).toBe(4.8);

    // Net Sales = Sum(GrandTotal) = 47.20 + 40.00 = 87.20
    expect(summary.netSales).toBe(87.2);

    expect(summary.totalSubtotal).toBe(80.0); // 40.00 + 40.00
    expect(summary.totalGst).toBe(12.0); // 7.20 + 4.80
  });

  it('should generate correct Payment Mode Summary', () => {
    generateBill([{ productId: 1, quantity: 1 }], 'cash', '001'); // 47.20
    generateBill([{ productId: 1, quantity: 1 }], 'cash', '002'); // 47.20
    generateBill([{ productId: 2, quantity: 1 }], 'upi', '003'); // 22.40

    const today = new Date().toISOString().split('T')[0];
    const modes = reportService.getPaymentModeSummary(today, today);

    expect(modes).toHaveLength(2);

    const cashMode = modes.find((m) => m.mode === 'cash');
    const upiMode = modes.find((m) => m.mode === 'upi');

    expect(cashMode).toBeDefined();
    expect(cashMode?.count).toBe(2);
    expect(cashMode?.totalAmount).toBe(94.4); // 47.20 * 2

    expect(upiMode).toBeDefined();
    expect(upiMode?.count).toBe(1);
    expect(upiMode?.totalAmount).toBe(22.4);
  });

  it('should generate correct GST Summary', () => {
    // Bill 1: 18% item
    generateBill([{ productId: 1, quantity: 10 }], 'cash', '001'); // 10 * 40.00 = 400.00 taxable, 72.00 GST

    // Bill 2: 12% item
    generateBill([{ productId: 2, quantity: 10 }], 'cash', '002'); // 10 * 20.00 = 200.00 taxable, 24.00 GST

    const today = new Date().toISOString().split('T')[0];
    const report = reportService.getGstSummary({ startDate: today, endDate: today });

    expect(report.totalTaxable).toBe(600.0); // 400.00 + 200.00
    expect(report.totalGst).toBe(96.0); // 72.00 + 24.00

    const slab18 = report.slabs.find((s) => s.gstPercent === 18);
    const slab12 = report.slabs.find((s) => s.gstPercent === 12);

    expect(slab18).toBeDefined();
    expect(slab18?.taxableAmount).toBe(400.0);
    expect(slab18?.gstAmount).toBe(72.0);

    expect(slab12).toBeDefined();
    expect(slab12?.taxableAmount).toBe(200.0);
    expect(slab12?.gstAmount).toBe(24.0);
  });

  it('should identify low stock items', () => {
    // seeded data might need update to trigger low stock
    // Update product 1 to have low stock (Stock 2, Alert 5)
    // Update product 2 to have high stock (Stock 100, Alert 5)

    // We need to use update method which might not be exposed on repo in this test setup easily if not mocked,
    // but we can use db.exec directly or productRepo.update if available.
    // Assuming productRepo.update works on the test db instance.
    // Actually productRepo in test is a real instance connected to test db.

    // Force update via DB directly to be sure
    db.exec(`UPDATE products SET stock_qty = 2, low_stock_alert = 5 WHERE id = 1`);
    db.exec(`UPDATE products SET stock_qty = 100, low_stock_alert = 5 WHERE id = 2`);

    // Test 'all' filter
    const summaryAll = reportService.getStockSummary('all');
    expect(summaryAll.lowStockCount).toBe(1);
    expect(summaryAll.items.length).toBeGreaterThan(1); // Should have at least 2 items

    const lowItemInAll = summaryAll.items.find((i) => i.id === 1);
    expect(lowItemInAll).toBeDefined();
    expect(lowItemInAll?.stockQty).toBe(2);

    // Test 'low_stock' filter
    const summaryLow = reportService.getStockSummary('low_stock');
    expect(summaryLow.items.length).toBe(1);
    expect(summaryLow.items[0].id).toBe(1);
  });

  it('should return empty summary for date range with no sales', () => {
    const futureDate = '2030-01-01';
    const summary = reportService.getDailySalesSummary(futureDate, futureDate);

    expect(summary.billCount).toBe(0);
    expect(summary.totalSales).toBe(0);
  });
});

describe('ReportService New API Tests', () => {
  let db: BetterSqliteCompatibleDatabase;
  let reportService: ReportService;
  let billingService: BillingService;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    reportService = new ReportService();
    billingService = new BillingService();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  const generateBill = (
    items: { productId: number; quantity: number }[],
    mode: 'cash' | 'upi' = 'cash',
    billNoSuffix: string,
    discount: number = 0
  ) => {
    const billNumber = `BILL-TEST-${billNoSuffix}`;
    billingService.finalizeBill({
      billNumber,
      items,
      paymentMode: mode,
      discountAmount: discount,
    });
    const today = new Date().toISOString().split('T')[0];
    db.exec(
      `UPDATE bills SET created_at = '${today} 12:00:00' WHERE bill_number = '${billNumber}'`
    );
  };

  it('getSalesSummary should accept DateRange object', () => {
    generateBill([{ productId: 1, quantity: 1 }], 'cash', '001');
    const today = new Date().toISOString().split('T')[0];

    // New API test
    const summary = reportService.getSalesSummary({ startDate: today, endDate: today });

    expect(summary).toBeDefined();
    expect(summary.billCount).toBeGreaterThan(0);
  });

  it('getBills should return list of bills for DateRange', () => {
    generateBill([{ productId: 1, quantity: 1 }], 'cash', '001');
    const today = new Date().toISOString().split('T')[0];

    // New API test
    const result = reportService.getBills({ startDate: today, endDate: today });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.data[0].billNumber).toContain('BILL-TEST-001');
  });

  it('getGstSummary should accept DateRange object', () => {
    generateBill([{ productId: 1, quantity: 1 }], 'cash', '001');
    const today = new Date().toISOString().split('T')[0];

    // New API test
    const report = reportService.getGstSummary({ startDate: today, endDate: today });

    expect(report).toBeDefined();
    expect(report.totalTaxable).toBeGreaterThan(0);
  });

  it('getBills should support pagination', () => {
    // Generate 5 bills
    for (let i = 1; i <= 5; i++) {
      generateBill([{ productId: 1, quantity: 1 }], 'cash', `PAG-${i}`);
    }
    const today = new Date().toISOString().split('T')[0];

    const page1 = reportService.getBills({ startDate: today, endDate: today }, 1, 2);
    expect(page1.data).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page1.page).toBe(1);

    const page2 = reportService.getBills({ startDate: today, endDate: today }, 2, 2);
    expect(page2.data).toHaveLength(2);
    expect(page2.page).toBe(2);

    const page3 = reportService.getBills({ startDate: today, endDate: today }, 3, 2);
    expect(page3.data).toHaveLength(1);
    expect(page3.page).toBe(3);
  });

  it('should validate date range', () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Invalid: start > end
    expect(() => reportService.getDailySalesSummary(today, yesterday)).toThrow(
      'Start date cannot be after end date'
    );

    // Invalid: missing dates
    expect(() => reportService.getDailySalesSummary('', '')).toThrow(
      'Start date and end date are required'
    );
  });
});

describe('ReportService Trend Analytics', () => {
  let db: BetterSqliteCompatibleDatabase;
  let reportService: ReportService;
  let billingService: BillingService;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    reportService = new ReportService();
    billingService = new BillingService();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  const generateBill = (
    items: { productId: number; quantity: number }[],
    mode: 'cash' | 'upi' = 'cash',
    billNoSuffix: string,
    date: string
  ) => {
    const billNumber = `BILL-TREND-${billNoSuffix}`;
    billingService.finalizeBill({
      billNumber,
      items,
      paymentMode: mode,
    });
    db.exec(`UPDATE bills SET created_at = '${date} 12:00:00' WHERE bill_number = '${billNumber}'`);
  };

  it('should return trend analytics with day granularity', () => {
    generateBill([{ productId: 1, quantity: 1 }], 'cash', 'D1', '2025-01-01');
    generateBill([{ productId: 1, quantity: 2 }], 'cash', 'D2', '2025-01-02');

    const result = reportService.getTrendAnalytics('2025-01-01', '2025-01-10', 'day');

    expect(result.periods).toHaveLength(2);
    expect(result.periods[0].periodId).toBe('2025-01-01');
    expect(result.periods[0].totalSales).toBe(47.2); // 1 * 47.20
    expect(result.periods[1].totalSales).toBe(94.4); // 2 * 47.20
    expect(result.periods[1].growth).toBe(100); // (94.4 - 47.2) / 47.2 = 100%
  });

  it('should return trend analytics with month granularity', () => {
    generateBill([{ productId: 1, quantity: 1 }], 'cash', 'M1', '2025-01-15');
    generateBill([{ productId: 1, quantity: 2 }], 'cash', 'M2', '2025-02-15');

    const result = reportService.getTrendAnalytics('2025-01-01', '2025-03-01', 'month');

    expect(result.periods).toHaveLength(2);
    expect(result.periods[0].periodId).toBe('2025-01');
    expect(result.periods[1].periodId).toBe('2025-02');
  });

  it('should calculate previous period comparison correctly in getDailySalesSummary', () => {
    // Current period: Feb 10, 2025. 1 Bill.
    generateBill([{ productId: 1, quantity: 2 }], 'cash', 'CUR', '2025-02-10'); // 94.4

    // Previous period: Feb 9, 2025. 1 Bill.
    generateBill([{ productId: 1, quantity: 1 }], 'cash', 'PREV', '2025-02-09'); // 47.2

    const summary = reportService.getDailySalesSummary('2025-02-10', '2025-02-10');

    expect(summary.totalSales).toBe(94.4);
    expect(summary.comparison?.totalSales.change).toBe(100);
    expect(summary.comparison?.totalSales.trend).toBe('up');
  });
});
