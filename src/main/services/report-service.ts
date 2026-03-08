import { BaseService } from './base-service';
import { ReportRepository } from '../repositories/report-repository';
import {
  DailySalesSummary,
  PaymentModeSummary,
  GstReport,
  StockSummary,
  StockItem,
  BillSummary,
  DateRange,
  PaginatedResult,
  TrendAnalytics,
} from '../../shared/types/report.types';
import { ValidationError } from './errors/service-errors';
import { ExpenseRepository } from '../repositories/expense-repository';
import { ProductRepository } from '../repositories/product-repository';

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export class ReportService extends BaseService {
  private reportRepo: ReportRepository;
  private expenseRepo: ExpenseRepository;
  private productRepo: ProductRepository;

  constructor() {
    super();
    this.reportRepo = new ReportRepository();
    this.expenseRepo = new ExpenseRepository();
    this.productRepo = new ProductRepository();
  }

  public getDailySalesSummary(startDate: string, endDate: string): DailySalesSummary {
    this.validateDateRange(startDate, endDate);

    // 1. Fetch current data
    const current = this.reportRepo.getDailySalesSummary(startDate, endDate);

    // 2. Determine previous period
    const prevRange = this.getPreviousPeriod(startDate, endDate);

    // 3. Fetch previous data
    const previous = this.reportRepo.getDailySalesSummary(prevRange.startDate, prevRange.endDate);

    // 4. Fetch Expenses
    const currentExpenses = this.expenseRepo.getTotalExpenses(startDate, endDate);
    const previousExpenses = this.expenseRepo.getTotalExpenses(
      prevRange.startDate,
      prevRange.endDate
    );

    // 5. Calculate comparisons
    const currentTrueNetProfit = Math.round((current.totalProfit - currentExpenses) * 100) / 100;
    const previousTrueNetProfit = Math.round((previous.totalProfit - previousExpenses) * 100) / 100;

    current.comparison = {
      totalSales: this.calculateTrend(current.totalSales, previous.totalSales),
      netSales: this.calculateTrend(current.netSales, previous.netSales),
      totalDiscount: this.calculateTrend(current.totalDiscount, previous.totalDiscount),
      totalProfit: this.calculateTrend(current.totalProfit, previous.totalProfit),
      trueNetProfit: this.calculateTrend(currentTrueNetProfit, previousTrueNetProfit),
      totalExpenses: this.calculateTrend(currentExpenses, previousExpenses),
    };

    // 6. True Net Profit (Gross Profit - Expenses)
    current.totalExpenses = currentExpenses;
    current.trueNetProfit = currentTrueNetProfit;

    return current;
  }

  public getSalesSummary(dateRange: DateRange): DailySalesSummary {
    return this.getDailySalesSummary(dateRange.startDate, dateRange.endDate);
  }

  private getPreviousPeriod(
    startDate: string,
    endDate: string
  ): { startDate: string; endDate: string } {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Calculate duration in days (inclusive)
    const durationMs = end.getTime() - start.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // Previous period ends the day before start
    const prevEnd = new Date(start.getTime() - oneDayMs);
    const prevStart = new Date(prevEnd.getTime() - durationMs);

    return {
      startDate: toLocalDateString(prevStart),
      endDate: toLocalDateString(prevEnd),
    };
  }

  private calculateTrend(
    current: number,
    previous: number
  ): { change: number; trend: 'up' | 'down' | 'neutral' } {
    if (previous === 0) {
      if (current === 0) {
        return { change: 0, trend: 'neutral' };
      }
      return { change: 100, trend: 'up' }; // technically infinity, but 100% is a safe visual
    }

    const change = ((current - previous) / previous) * 100;
    const roundedChange = Math.abs(Math.round(change * 10) / 10); // round to 1 decimal place

    let trend: 'up' | 'down' | 'neutral' = 'neutral';
    if (change > 0.05) {
      trend = 'up';
    } else if (change < -0.05) {
      trend = 'down';
    }

    return {
      change: roundedChange,
      trend,
    };
  }

  public getPaymentModeSummary(startDate: string, endDate: string): PaymentModeSummary[] {
    this.validateDateRange(startDate, endDate);
    return this.reportRepo.getPaymentModeSummary(startDate, endDate);
  }

  public getGstSummary(dateRange: DateRange): GstReport {
    this.validateDateRange(dateRange.startDate, dateRange.endDate);
    return this.reportRepo.getGstSummary(dateRange.startDate, dateRange.endDate);
  }

  // Overload for backward compatibility if needed, or just keep the new one
  public getGstSummaryLegacy(startDate: string, endDate: string): GstReport {
    this.validateDateRange(startDate, endDate);
    return this.reportRepo.getGstSummary(startDate, endDate);
  }

  public getStockSummary(filter: 'all' | 'low_stock' = 'all'): StockSummary {
    return this.reportRepo.getStockSummary(filter);
  }

  public getNearExpiryReport(daysAhead: number = 60): StockItem[] {
    return this.reportRepo.getNearExpiryReport(daysAhead);
  }

  public getBillwiseSales(
    startDate: string,
    endDate: string,
    page: number = 1,
    limit: number = 50
  ): PaginatedResult<BillSummary> {
    this.validateDateRange(startDate, endDate);
    return this.reportRepo.getBillwiseSales(startDate, endDate, page, limit);
  }

  public getBills(
    dateRange: DateRange,
    page: number = 1,
    limit: number = 50
  ): PaginatedResult<BillSummary> {
    this.validateDateRange(dateRange.startDate, dateRange.endDate);
    return this.reportRepo.getBillwiseSales(dateRange.startDate, dateRange.endDate, page, limit);
  }

  public getTrendAnalytics(
    startDate: string,
    endDate: string,
    granularity: 'day' | 'week' | 'month'
  ): TrendAnalytics {
    this.validateDateRange(startDate, endDate);
    if (!['day', 'week', 'month'].includes(granularity)) {
      throw new ValidationError('Invalid granularity');
    }
    const trends = this.reportRepo.getTrendAnalytics(startDate, endDate, granularity);

    let dateFormat = '%Y-%m-%d';
    if (granularity === 'week') {
      dateFormat = '%Y-%W';
    }
    if (granularity === 'month') {
      dateFormat = '%Y-%m';
    }

    const expenses = this.expenseRepo.getExpensesByPeriod(startDate, endDate, dateFormat);
    const expenseMap = new Map(expenses.map((e) => [e.periodId, e.total]));

    let runningExpenses = 0;
    trends.periods.forEach((p) => {
      const exp = expenseMap.get(p.periodId) || 0;
      p.totalExpenses = exp;
      p.trueNetProfit = Math.round(((p.totalProfit || 0) - exp) * 100) / 100;
      runningExpenses += exp;
    });

    trends.totalExpenses = runningExpenses;
    return trends;
  }

  /**
   * Generate a WhatsApp-friendly plain text summary
   */
  public async generateWhatsAppSummary(startDate: string, endDate: string): Promise<string> {
    const summary = this.getDailySalesSummary(startDate, endDate);
    const payments = this.getPaymentModeSummary(startDate, endDate);
    const udhaar = this.reportRepo.getUdhaarSummary(startDate, endDate);

    const cash = payments.find((p) => p.mode === 'cash')?.totalAmount || 0;
    const upi = payments.find((p) => p.mode === 'upi')?.totalAmount || 0;
    const mixed = payments.find((p) => p.mode === 'mixed')?.totalAmount || 0;

    const dateStr = startDate === endDate ? startDate : `${startDate} to ${endDate}`;

    let text = `📊 *SmartKhata Daily Sales Summary*\n`;
    text += `📅 Date: ${dateStr}\n`;
    text += `--------------------------------\n`;
    text += `💰 *Total Sales:* ₹${summary.totalSales.toLocaleString('en-IN')}\n`;
    if (cash > 0) {
      text += `💵 *Cash Collected:* ₹${cash.toLocaleString('en-IN')}\n`;
    }
    if (upi > 0) {
      text += `📱 *UPI Collected:* ₹${upi.toLocaleString('en-IN')}\n`;
    }
    if (mixed > 0) {
      text += `⚖️ *Mixed Payment:* ₹${mixed.toLocaleString('en-IN')}\n`;
    }
    text += `--------------------------------\n`;
    text += `🤝 *Udhar Given:* ₹${udhaar.creditGiven.toLocaleString('en-IN')}\n`;
    text += `📥 *Udhar Received:* ₹${udhaar.paymentsReceived.toLocaleString('en-IN')}\n`;
    text += `📉 *Total Expenses:* ₹${summary.totalExpenses.toLocaleString('en-IN')}\n`;
    text += `--------------------------------\n`;
    text += `✅ *Net Profit:* ₹${summary.trueNetProfit.toLocaleString('en-IN')}\n`;
    text += `--------------------------------\n`;
    text += `🔢 Total Bills: ${summary.billCount}\n`;
    text += `\n_Generated via SmartKhata POS_`;

    return text;
  }

  /**
   * Get Stock Aging Report (Items not sold in N days)
   */
  public getStockAgingReport(days: number = 30): any[] {
    const products = this.productRepo.findAll(false);
    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(now.getDate() - days);

    return products
      .filter((p) => {
        if (!p.trackInventory || p.stockQty <= 0) {
          return false;
        }
        // If never sold, check creation date
        const lastSale = p.lastSaleDate ? new Date(p.lastSaleDate) : p.createdAt;
        return lastSale < thresholdDate;
      })
      .map((p) => {
        const lastSale = p.lastSaleDate ? new Date(p.lastSaleDate) : p.createdAt;
        const idleDays = Math.floor((now.getTime() - lastSale.getTime()) / (1000 * 3600 * 24));
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          stockQty: p.stockQty,
          lastActionDate: lastSale.toISOString().split('T')[0],
          idleDays,
          stockValue: p.stockQty * (p.purchasePrice || 0),
        };
      })
      .sort((a, b) => b.idleDays - a.idleDays);
  }

  private validateDateRange(startDate: string, endDate: string) {
    if (!startDate || !endDate) {
      throw new ValidationError('Start date and end date are required');
    }
    if (new Date(startDate) > new Date(endDate)) {
      throw new ValidationError('Start date cannot be after end date');
    }
  }
}
