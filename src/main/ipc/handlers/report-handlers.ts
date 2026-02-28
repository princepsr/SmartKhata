import { IPCHandler } from '../ipc-handler';
import { ReportService } from '../../services/report-service';
import { getUserFriendlyMessage } from '../../services/errors/service-errors';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { PrintService } from '../../services/print-service';
import { ExportService } from '../../services/export-service';

/**
 * Register All Report Handlers
 */
export function registerReportHandlers(): void {
  const reportService = new ReportService();
  const printService = new PrintService();
  const exportService = new ExportService();

  // ============================================
  // DAILY SALES SUMMARY
  // ============================================
  IPCHandler.handle<{ startDate: string; endDate: string }, any>(
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
  IPCHandler.handle<{ startDate: string; endDate: string }, any>(
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
  IPCHandler.handle<{ startDate: string; endDate: string }, any>(
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
  IPCHandler.handle<'all' | 'low_stock', any>(
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
  IPCHandler.handle<{ startDate: string; endDate: string; page?: number; limit?: number }, any>(
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
  IPCHandler.handle<{ type: 'sales' | 'gst' | 'stock'; data: any; dateRange: string }, boolean>(
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
  IPCHandler.handle<{ type: 'sales' | 'gst' | 'stock'; data: any; dateRange: string }, boolean>(
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
  IPCHandler.handle<{ type: 'sales' | 'gst' | 'stock'; data: any; dateRange: string }, boolean>(
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
    any
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
  IPCHandler.handle<number, any[]>(
    IPC_CHANNELS.REPORT_STOCK_AGING,
    async (days) => {
      return reportService.getStockAgingReport(days);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );
}
