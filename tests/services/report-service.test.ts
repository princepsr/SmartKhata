import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReportService } from '../../src/main/services/report-service';
import { BillingService } from '../../src/main/services/billing-service';
import { SettingsService } from '../../src/main/services/settings-service';
import { CreditNoteService } from '../../src/main/services/credit-note-service';
import { PurchaseService } from '../../src/main/services/purchase-service';

import { createTestDatabase, resetTestDatabase, seedTestData, getLocalToday, SqlJsDatabase } from '../utils/test-db';

describe('ReportService Integration Tests', () => {
  let db: SqlJsDatabase;
  let reportService: ReportService;
  let billingService: BillingService;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    // Use exclusive GST mode so test expectations hold (price + GST on top)
    db.exec(`UPDATE app_config SET gst_exclusive_mode = 1 WHERE id = 1`);
    SettingsService.getInstance().reloadCache();
    reportService = new ReportService();
    billingService = new BillingService();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  // Helper: create a bill and update its date using the bill ID
  const generateBill = async (
    items: { productId: number; quantity: number }[],
    mode: 'cash' | 'upi' = 'cash',
    discount: number = 0,
    date?: string // Optional date format 'YYYY-MM-DD'
  ) => {
    const result = await billingService.finalizeBill({
      billNumber: `BILL-GENERATED`,
      items,
      paymentMode: mode,
      discountAmount: discount,
    });

    const targetDate = date || getLocalToday();
    db.exec(`UPDATE bills SET created_at = '${targetDate} 12:00:00' WHERE id = ${result.bill.id}`);

    return result;
  };

  it('should generate correct Daily Sales Summary with Discounts', async () => {
    // Bill 1: 1 Coke (40, 5% GST excl = 42). Discount 0.
    await generateBill([{ productId: 1, quantity: 1 }], 'cash', 0);

    // Bill 2: 2 Lays (20, 12% GST excl = 22.4 each = 44.8 total). Discount 4.80. Net = 40.0.
    await generateBill([{ productId: 2, quantity: 2 }], 'cash', 4.8);

    const today = getLocalToday();
    const summary = reportService.getDailySalesSummary(today, today);

    expect(summary).toBeDefined();
    expect(summary.billCount).toBe(2);

    // Gross Sales = Sum(GrandTotal + Discount)
    // Bill 1: 1 Coke excl 5%: 42+0=42. Bill 2: 2 Lays excl 12%, gross=40, net=35.2, gst=4.22, grandTotal=39.42
    // totalSales = 42 + (39.42+4.8) = 42 + 44.22 = 86.22
    expect(summary.totalSales).toBeCloseTo(86.22, 1);

    // Total Discount = 0 + 4.80 = 4.80
    expect(summary.totalDiscount).toBeCloseTo(4.8, 1);

    // Net Sales = Sum(GrandTotal) = 42.00 + 39.42 = 81.42
    expect(summary.netSales).toBeCloseTo(81.42, 1);
  });

  it('should generate correct Payment Mode Summary', async () => {
    await generateBill([{ productId: 1, quantity: 1 }], 'cash'); // 42.00
    await generateBill([{ productId: 1, quantity: 1 }], 'cash'); // 42.00
    await generateBill([{ productId: 2, quantity: 1 }], 'upi'); // 22.40

    const today = getLocalToday();
    const modes = reportService.getPaymentModeSummary(today, today);

    expect(modes).toHaveLength(2);

    const cashMode = modes.find((m) => m.mode === 'cash');
    const upiMode = modes.find((m) => m.mode === 'upi');

    expect(cashMode).toBeDefined();
    expect(cashMode?.count).toBe(2);
    expect(cashMode?.totalAmount).toBeCloseTo(84.0, 1); // 42.00 * 2

    expect(upiMode).toBeDefined();
    expect(upiMode?.count).toBe(1);
    expect(upiMode?.totalAmount).toBeCloseTo(22.4, 1);
  });

  it('should generate correct GST Summary', async () => {
    // Bill 1: 5% item (10 Coke = 10*40=400 taxable base excl, 10*2=20 GST, 10*42=420 total)
    await generateBill([{ productId: 1, quantity: 10 }], 'cash');

    // Bill 2: 12% item (10 Lays = 10*20=200 taxable, 10*2.4=24 GST, 10*22.4=224 total)
    await generateBill([{ productId: 2, quantity: 10 }], 'cash');

    const today = getLocalToday();
    const report = reportService.getGstSummary({ startDate: today, endDate: today });

    expect(report.totalTaxable).toBeCloseTo(600.0, 2); // 400.00 + 200.00
    expect(report.totalGst).toBeCloseTo(44.0, 2); // 20.00 + 24.00
    expect(report.totalAmount).toBeCloseTo(644.0, 2); // 600.00 + 44.00

    const slab5 = report.slabs.find((s) => s.gstPercent === 5);
    const slab12 = report.slabs.find((s) => s.gstPercent === 12);

    expect(slab5).toBeDefined();
    expect(slab5?.taxableAmount).toBeCloseTo(400.0, 2);
    expect(slab5?.gstAmount).toBeCloseTo(20.0, 2);

    expect(slab12).toBeDefined();
    expect(slab12?.taxableAmount).toBeCloseTo(200.0, 2);
    expect(slab12?.gstAmount).toBeCloseTo(24.0, 2);
  });

  it('should identify low stock items', () => {
    db.exec(`UPDATE products SET stock_qty = 2, low_stock_alert = 5 WHERE id = 1`);
    db.exec(`UPDATE products SET stock_qty = 100, low_stock_alert = 5 WHERE id = 2`);

    const summaryAll = reportService.getStockSummary('all');
    expect(summaryAll.lowStockCount).toBeGreaterThanOrEqual(1);

    const summaryLow = reportService.getStockSummary('low_stock');
    const lowItem = summaryLow.items.find((i) => i.id === 1);
    expect(lowItem).toBeDefined();
    expect(lowItem?.stockQty).toBe(2);
  });

  it('should return empty summary for date range with no sales', () => {
    const futureDate = '2030-01-01';
    const summary = reportService.getDailySalesSummary(futureDate, futureDate);
    expect(summary.billCount).toBe(0);
    expect(summary.totalSales).toBe(0);
  });

  it('should calculate profit and coverage accurately', () => {
    const todayStr = getLocalToday();

    db.exec(`
      INSERT INTO bills (bill_number, subtotal, gst_total, discount_amount, grand_total, payment_mode, created_at)
      VALUES ('REPORT-1', 60, 4.4, 0, 64.4, 'cash', '${todayStr}')
    `);
    const billRow = db.prepare("SELECT id FROM bills WHERE bill_number = 'REPORT-1'").get() as {
      id: number;
    };
    const billId = billRow.id;

    db.exec(`
      INSERT INTO bill_items (bill_id, product_id, product_name_snapshot, quantity, unit_price, purchase_price, gst_percent, line_total)
      VALUES 
        (${billId}, 1, 'Coke', 1, 40, 30, 5, 42),
        (${billId}, 2, 'Lays', 1, 20, 15, 12, 22.4)
    `);

    const summary = reportService.getDailySalesSummary(todayStr, todayStr);
    expect(summary.totalProfit).toBeCloseTo(15, 2);
    expect(summary.salesWithCost).toBeCloseTo(60, 2);
  });

  it('should maintain historical cost integrity', () => {
    const todayStr = getLocalToday();
    const initialSummary = reportService.getDailySalesSummary(todayStr, todayStr);
    const initialProfit = initialSummary.totalProfit || 0;
    db.exec('UPDATE products SET purchase_price = 100 WHERE id = 1');
    const freshSummary = reportService.getDailySalesSummary(todayStr, todayStr);
    expect(freshSummary.totalProfit).toBe(initialProfit);
  });

  it('should calculate profit correctly for bills with zero GST', () => {
    const todayStr = getLocalToday();
    db.exec(`
      INSERT INTO bills (bill_number, subtotal, gst_total, discount_amount, grand_total, payment_mode, created_at)
      VALUES ('GST-ZERO-1', 42, 0, 0, 42, 'cash', '${todayStr}')
    `);
    const billRow2 = db.prepare("SELECT id FROM bills WHERE bill_number = 'GST-ZERO-1'").get() as {
      id: number;
    };
    const billId2 = billRow2.id;
    db.exec(`
      INSERT INTO bill_items (bill_id, product_id, product_name_snapshot, quantity, unit_price, purchase_price, gst_percent, line_total)
      VALUES (${billId2}, 1, 'Coke', 1, 42, 30, 0, 42)
    `);
    const summary = reportService.getDailySalesSummary(todayStr, todayStr);
    expect(summary.totalProfit).toBeCloseTo(12, 1);
  });
});

describe('ReportService New API Tests', () => {
  let db: SqlJsDatabase;
  let reportService: ReportService;
  let billingService: BillingService;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    // Use exclusive GST mode so test expectations hold (price + GST on top)
    db.exec(`UPDATE app_config SET gst_exclusive_mode = 1 WHERE id = 1`);
    SettingsService.getInstance().reloadCache();
    reportService = new ReportService();
    billingService = new BillingService();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  const generateBill = async (
    items: { productId: number; quantity: number }[],
    mode: 'cash' | 'upi' = 'cash',
    discount: number = 0
  ) => {
    const result = await billingService.finalizeBill({
      billNumber: 'GENERATED',
      items,
      paymentMode: mode,
      discountAmount: discount,
    });
    const today = getLocalToday();
    db.exec(`UPDATE bills SET created_at = '${today} 12:00:00' WHERE id = ${result.bill.id}`);
    return result;
  };

  it('getSalesSummary should accept DateRange object', async () => {
    await generateBill([{ productId: 1, quantity: 1 }], 'cash');
    const today = getLocalToday();
    const summary = reportService.getSalesSummary({ startDate: today, endDate: today });
    expect(summary).toBeDefined();
    expect(summary.billCount).toBeGreaterThan(0);
  });

  it('getBills should return list of bills for DateRange', async () => {
    const result = await generateBill([{ productId: 1, quantity: 1 }], 'cash');
    const today = getLocalToday();

    const billList = reportService.getBills({ startDate: today, endDate: today });
    expect(billList.data).toHaveLength(1);
    expect(billList.total).toBe(1);
    // Verify the bill number matches the auto-generated pattern
    expect(billList.data[0].billNumber).toMatch(/^BILL-\d{8}-\d{3}$/);
    expect(billList.data[0].id).toBe(result.bill.id);
  });

  it('getGstSummary should accept DateRange object', async () => {
    await generateBill([{ productId: 1, quantity: 1 }], 'cash');
    const today = getLocalToday();
    const report = reportService.getGstSummary({ startDate: today, endDate: today });
    expect(report).toBeDefined();
    expect(report.totalTaxable).toBeGreaterThan(0);
  });

  it('getBills should support pagination', async () => {
    for (let i = 1; i <= 5; i++) {
      await generateBill([{ productId: 1, quantity: 1 }], 'cash');
    }
    const today = getLocalToday();

    const page1 = reportService.getBills({ startDate: today, endDate: today }, 1, 2);
    expect(page1.data).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page1.page).toBe(1);

    const page2 = reportService.getBills({ startDate: today, endDate: today }, 2, 2);
    expect(page2.data).toHaveLength(2);

    const page3 = reportService.getBills({ startDate: today, endDate: today }, 3, 2);
    expect(page3.data).toHaveLength(1);
  });

  it('should validate date range', () => {
    const today = getLocalToday();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    expect(() => reportService.getDailySalesSummary(today, yesterday)).toThrow(
      'Start date cannot be after end date'
    );
    expect(() => reportService.getDailySalesSummary('', '')).toThrow(
      'Start date and end date are required'
    );
  });
});

describe('ReportService Trend Analytics', () => {
  let db: SqlJsDatabase;
  let reportService: ReportService;
  let billingService: BillingService;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    // Use exclusive GST mode so test expectations hold (price + GST on top)
    db.exec(`UPDATE app_config SET gst_exclusive_mode = 1 WHERE id = 1`);
    SettingsService.getInstance().reloadCache();
    reportService = new ReportService();
    billingService = new BillingService();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  const generateBillOnDate = async (
    items: { productId: number; quantity: number }[],
    mode: 'cash' | 'upi' = 'cash',
    date: string
  ) => {
    const result = await billingService.finalizeBill({
      billNumber: 'GENERATED',
      items,
      paymentMode: mode,
    });
    // Update with local date string (no UTC 'Z')
    db.exec(`UPDATE bills SET created_at = '${date} 12:00:00' WHERE id = ${result.bill.id}`);
    return result;
  };

  it('should return trend analytics with day granularity', async () => {
    const today = getLocalToday();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    await generateBillOnDate([{ productId: 1, quantity: 1 }], 'cash', yesterday);
    await generateBillOnDate([{ productId: 1, quantity: 2 }], 'cash', today);

    const result = reportService.getTrendAnalytics(yesterday, today, 'day');

    expect(result.periods).toHaveLength(2);
    expect(result.periods[0].periodId).toBe(yesterday);
    expect(result.periods[0].totalSales).toBeCloseTo(42.0, 1); // 1 * 42
    expect(result.periods[1].periodId).toBe(today);
    expect(result.periods[1].totalSales).toBeCloseTo(84.0, 1); // 2 * 42
    expect(result.periods[1].growth).toBe(100); // (84 - 42) / 42 = 100%
  });

  it('should return trend analytics with month granularity', async () => {
    const today = getLocalToday();
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthStr = lastMonth.toISOString().split('T')[0];

    await generateBillOnDate([{ productId: 1, quantity: 1 }], 'cash', lastMonthStr);
    await generateBillOnDate([{ productId: 1, quantity: 2 }], 'cash', today);

    const result = reportService.getTrendAnalytics(lastMonthStr, today, 'month');

    expect(result.periods.length).toBeGreaterThanOrEqual(2);
    // Check we have two different months
    const months = result.periods.map((p) => p.periodId);
    expect(months[0]).not.toBe(months[months.length - 1]);
  });

  it('should calculate previous period comparison correctly in getDailySalesSummary', async () => {
    const today = getLocalToday();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Current period: today. 2 Coke bills.
    await generateBillOnDate([{ productId: 1, quantity: 2 }], 'cash', today); // 84.0

    // Previous period: yesterday (will be auto-compared)
    await generateBillOnDate([{ productId: 1, quantity: 1 }], 'cash', yesterday); // 42.0

    const summary = reportService.getDailySalesSummary(today, today);
    expect(summary.totalSales).toBeCloseTo(84.0, 1);
    // Comparison should show increase from 42 to 84 = 100%
    expect(summary.comparison?.totalSales?.change).toBe(100);
    expect(summary.comparison?.totalSales?.trend).toBe('up');
  });

  it('should handle negative profit when cost exceeds revenue', async () => {
    // 1 Coke at 40, 5% GST → 42. Discount 20 → Net 22. Taxable = 22/1.05 = 20.95. Cost = 30. Profit = -9.05
    await billingService.finalizeBill({
      billNumber: 'NEG-PROFIT',
      items: [{ productId: 1, quantity: 1 }],
      discountAmount: 20,
      paymentMode: 'cash',
    });

    const summary = reportService.getDailySalesSummary(
      getLocalToday(),
      getLocalToday()
    );

    expect(summary.totalProfit).toBeLessThan(0);
    expect(summary.marginPercent).toBeLessThan(0);
  });

  it('should return clean zeros for range with no sales', () => {
    const summary = reportService.getDailySalesSummary('2099-01-01', '2099-01-01');
    expect(summary.billCount).toBe(0);
    expect(summary.totalSales).toBe(0);
    expect(summary.totalProfit).toBe(0);
    expect(summary.marginPercent).toBe(0);
    expect(summary.totalProfit).toBe(0);
    expect(summary.marginPercent).toBe(0);
    expect(summary.totalItemSales).toBe(0);
  });

  it('should correctly compare April (30 days) with full March (31 days)', async () => {
    // March 2026: 31 days
    // April 2026: 30 days
    const march1 = '2026-03-01';
    const march31 = '2026-03-31';
    const april1 = '2026-04-01';
    const april30 = '2026-04-30';

    // Sale on March 1st (42.0)
    await generateBillOnDate([{ productId: 1, quantity: 1 }], 'cash', march1);
    // Sale on March 31st (42.0)
    await generateBillOnDate([{ productId: 1, quantity: 1 }], 'cash', march31);

    // Total March Sales = 42 + 42 = 84.0

    // Sale on April 15th (84.0)
    await generateBillOnDate([{ productId: 1, quantity: 2 }], 'cash', '2026-04-15');

    // Total April Sales = 84.0

    const summary = reportService.getDailySalesSummary(april1, april30);

    // If it correctly identifies March 1-31 as previous period:
    // current (84) vs previous (84) = 0% change.
    expect(summary.totalSales).toBeCloseTo(84.0, 1);
    expect(summary.comparison?.totalSales?.change).toBe(0);
    expect(summary.comparison?.totalSales?.trend).toBe('neutral');

    // If it used fixed 30-day duration (March 2 to March 31):
    // current (84) vs previous (42) [missed March 1] = 100% change.
  });
});

describe('ReportService GST Robustness', () => {
  let db: SqlJsDatabase;
  let reportService: ReportService;
  let billingService: BillingService;
  let creditNoteService: CreditNoteService;
  let purchaseService: PurchaseService;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    db.exec(`UPDATE app_config SET gst_exclusive_mode = 1 WHERE id = 1`);
    SettingsService.getInstance().reloadCache();
    reportService = new ReportService();
    billingService = new BillingService();
    creditNoteService = new CreditNoteService();
    purchaseService = new PurchaseService();
  });

  it('should calculate accurate net payable GST with returns and ITC', async () => {
    const today = getLocalToday();

    // 1. Sale: 10 Coke (400 base + 20 GST = 420 total)
    const sale = await billingService.finalizeBill({
      billNumber: 'SALE-1',
      items: [{ productId: 1, quantity: 10 }],
      paymentMode: 'cash',
    });

    // 2. Return: 2 Coke (Base 80 + GST 4 = 84 total)
    creditNoteService.createCreditNote({
      originalBillId: sale.bill.id,
      items: [{ productId: 1, quantity: 2, unitPrice: 42, gstPercent: 5 }],
      reason: 'DEFECTIVE',
    });

    // 3. Purchase: ITC item (Price 100 + GST 18 = 118)
    purchaseService.recordPurchase({
      supplierName: 'Supplier X',
      invoiceDate: today,
      items: [{ productName: 'Raw Material', quantity: 1, unitPrice: 100, gstPercent: 18 }],
    });

    const report = reportService.getGstSummary({ startDate: today, endDate: today });

    // Output GST = 20
    // Returns GST = 4
    // ITC = 18
    // Net Payable = Max(0, 20 - 4 - 18) = Max(0, -2) = 0

    expect(report.totalGst).toBe(20);
    expect(report.totalCreditNoteGst).toBe(4);
    expect(report.totalPurchaseItc).toBe(18);
    expect(report.netGstPayable).toBe(0);
  });

  it('should calculate net payable when Output > (Returns + ITC)', async () => {
    const today = getLocalToday();

    // Sale: 20 Coke (800 base + 40 GST = 840)
    await billingService.finalizeBill({
      billNumber: 'SALE-2',
      items: [{ productId: 1, quantity: 20 }],
      paymentMode: 'cash',
    });

    // Purchase: 10 GST
    purchaseService.recordPurchase({
      supplierName: 'Supp',
      invoiceDate: today,
      items: [{ productName: 'M1', quantity: 1, unitPrice: 100, gstPercent: 10 }],
    });

    const report = reportService.getGstSummary({ startDate: today, endDate: today });

    // Output 40, Returns 0, ITC 10
    // Net = 40 - 10 = 30
    expect(report.netGstPayable).toBe(30);
  });
});
