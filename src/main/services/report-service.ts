import { BaseService } from './base-service';
import { ReportRepository } from '../repositories/report-repository';
import {
  DailySalesSummary,
  PaymentModeSummary,
  GstReport,
  StockSummary,
  BillSummary,
  DateRange,
  PaginatedResult,
  TrendAnalytics,
} from '../../shared/types/report.types';
import { ValidationError } from './errors/service-errors';

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export class ReportService extends BaseService {
  private reportRepo: ReportRepository;

  constructor() {
    super();
    this.reportRepo = new ReportRepository();
  }

  public getDailySalesSummary(startDate: string, endDate: string): DailySalesSummary {
    this.validateDateRange(startDate, endDate);

    // 1. Fetch current data
    const current = this.reportRepo.getDailySalesSummary(startDate, endDate);

    // 2. Determine previous period
    const prevRange = this.getPreviousPeriod(startDate, endDate);

    // 3. Fetch previous data
    const previous = this.reportRepo.getDailySalesSummary(prevRange.startDate, prevRange.endDate);

    // 4. Calculate comparisons
    current.comparison = {
      totalSales: this.calculateTrend(current.totalSales, previous.totalSales),
      netSales: this.calculateTrend(current.netSales, previous.netSales),
      totalDiscount: this.calculateTrend(current.totalDiscount, previous.totalDiscount),
      billCount: this.calculateTrend(current.billCount, previous.billCount),
    };

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
    return this.reportRepo.getTrendAnalytics(startDate, endDate, granularity);
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
