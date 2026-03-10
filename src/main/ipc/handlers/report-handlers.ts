import { IPCHandler } from '../ipc-handler';
import { ReportService } from '../../services/report-service';
import { getUserFriendlyMessage } from '../../services/errors/service-errors';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { PrintService } from '../../services/print-service';
import { ExportService } from '../../services/export-service';
import { 
  DailySalesSummary, 
  PaymentModeSummary, 
  GstReport, 
  StockSummary, 
  BillSummary, 
  PaginatedResult, 
  TrendAnalytics, 
  StockAgingItem, 
  StockItem,
  ReportData
} from '../../../shared/types/report.types';

/**
 * Register All Report Handlers
 */
export function registerReportHandlers(): void {
  const reportService = new ReportService();
  const printService = PrintService.getInstance();
  const exportService = new ExportService();

  // ============================================
  // DAILY SALES SUMMARY
  // ============================================
  IPCHandler.handle<{ startDate: string; endDate: string }, DailySalesSummary>(
    IPC_CHANNELS.REPORT_DAILY_SALES,
    async ({ startDate, endDate }) => {
      return reportService.getDailySalesSummary(startDate, endDate);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // PAYMENT MODE SUMMARY
  // ============================================
  IPCHandler.handle<{ startDate: string; endDate: string }, PaymentModeSummary[]>(
    IPC_CHANNELS.REPORT_PAYMENT_MODE,
    async ({ startDate, endDate }) => {
      return reportService.getPaymentModeSummary(startDate, endDate);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // GST SUMMARY
  // ============================================
  IPCHandler.handle<{ startDate: string; endDate: string }, GstReport>(
    IPC_CHANNELS.REPORT_GST,
    async (dateRange) => {
      return reportService.getGstSummary(dateRange);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // STOCK SUMMARY
  // ============================================
  IPCHandler.handle<'all' | 'low_stock', StockSummary>(
    IPC_CHANNELS.REPORT_STOCK,
    async (filter) => {
      return reportService.getStockSummary(filter);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // BILL-WISE SALES
  // ============================================
  IPCHandler.handle<
    { startDate: string; endDate: string; page?: number; limit?: number },
    PaginatedResult<BillSummary>
  >(
    IPC_CHANNELS.REPORT_BILL_WISE,
    async ({ startDate, endDate, page, limit }) => {
      return reportService.getBillwiseSales(startDate, endDate, page, limit);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // PRINT REPORT
  // ============================================
  IPCHandler.handle<
    { type: 'sales' | 'gst' | 'stock'; data: ReportData; dateRange: string },
    boolean
  >(
    IPC_CHANNELS.REPORT_PRINT,
    async ({ type, data, dateRange }) => {
      return printService.printReport(type, data, dateRange);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // EXPORT PDF
  // ============================================
  IPCHandler.handle<
    { type: 'sales' | 'gst' | 'stock'; data: ReportData; dateRange: string },
    boolean
  >(
    IPC_CHANNELS.REPORT_EXPORT_PDF,
    async ({ type, data, dateRange }) => {
      return printService.exportReportPdf(type, data, dateRange);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // EXPORT EXCEL (CSV)
  // ============================================
  IPCHandler.handle<
    { type: 'sales' | 'gst' | 'stock'; data: ReportData; dateRange: string },
    boolean
  >(
    IPC_CHANNELS.REPORT_EXPORT_EXCEL,
    async ({ type, data, dateRange }) => {
      return exportService.exportToExcel(type, data, dateRange);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // TREND ANALYTICS
  // ============================================
  IPCHandler.handle<
    { startDate: string; endDate: string; granularity: 'day' | 'week' | 'month' },
    TrendAnalytics
  >(
    IPC_CHANNELS.REPORT_ANALYTICS,
    async ({ startDate, endDate, granularity }) => {
      return reportService.getTrendAnalytics(startDate, endDate, granularity);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // WHATSAPP SUMMARY
  // ============================================
  IPCHandler.handle<{ startDate: string; endDate: string }, string>(
    IPC_CHANNELS.REPORT_WHATSAPP_SUMMARY,
    async ({ startDate, endDate }) => {
      return reportService.generateWhatsAppSummary(startDate, endDate);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // STOCK AGING
  // ============================================
  IPCHandler.handle<number, StockAgingItem[]>(
    IPC_CHANNELS.REPORT_STOCK_AGING,
    async (days) => {
      return reportService.getStockAgingReport(days);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // NEAR EXPIRY
  // ============================================
  IPCHandler.handle<number, StockItem[]>(
    IPC_CHANNELS.REPORT_NEAR_EXPIRY,
    async (days) => {
      return reportService.getNearExpiryReport(days);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );
}
