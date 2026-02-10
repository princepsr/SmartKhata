/**
 * Report API Service
 *
 * Wrapper around IPC calls for fetching report data.
 * Uses ipcClient for consistent error handling and typing.
 */

import { ipcClient } from '../utils/ipc';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import type {
  DailySalesSummary,
  PaymentModeSummary,
  GstReport,
  StockSummary,
  BillSummary,
  DateRange,
  PaginatedResult,
  TrendAnalytics,
} from '@shared/types/report.types';

export const reportApi = {
  /**
   * Get Daily Sales Summary
   */
  getDailySalesSummary: async (dateRange: DateRange): Promise<DailySalesSummary | null> => {
    const result = await ipcClient.call<DailySalesSummary>(
      IPC_CHANNELS.REPORT_DAILY_SALES,
      dateRange
    );
    return result.data;
  },

  /**
   * Get Payment Mode Summary
   */
  getPaymentModeSummary: async (dateRange: DateRange): Promise<PaymentModeSummary[] | null> => {
    const result = await ipcClient.call<PaymentModeSummary[]>(
      IPC_CHANNELS.REPORT_PAYMENT_MODE,
      dateRange
    );
    return result.data;
  },

  /**
   * Get GST Breakdown Summary
   */
  getGstSummary: async (dateRange: DateRange): Promise<GstReport | null> => {
    const result = await ipcClient.call<GstReport>(IPC_CHANNELS.REPORT_GST, dateRange);
    return result.data;
  },

  /**
   * Get Stock Summary (Current State)
   */
  getStockSummary: async (filter: 'all' | 'low_stock' = 'all'): Promise<StockSummary | null> => {
    const result = await ipcClient.call<StockSummary>(IPC_CHANNELS.REPORT_STOCK, filter);
    return result.data;
  },

  /**
   * Get Bill-wise Sales List
   */
  getBillwiseSales: async (
    dateRange: DateRange,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResult<BillSummary> | null> => {
    const result = await ipcClient.call<PaginatedResult<BillSummary>>(
      IPC_CHANNELS.REPORT_BILL_WISE,
      { ...dateRange, page, limit }
    );
    return result.data; // Note: ipcClient.call returns { success, data, error }, so result.data is the PaginatedResult
  },

  /**
   * Get Trend Analytics
   */
  getTrendAnalytics: async (
    startDate: string,
    endDate: string,
    granularity: 'day' | 'week' | 'month'
  ): Promise<TrendAnalytics | null> => {
    const result = await ipcClient.call<TrendAnalytics>(IPC_CHANNELS.REPORT_ANALYTICS, {
      startDate,
      endDate,
      granularity,
    });
    return result.data;
  },

  /**
   * Print Report
   */
  printReport: async (
    type: 'sales' | 'gst' | 'stock' | 'analytics',
    data: any,
    dateRange: string
  ): Promise<boolean> => {
    const result = await ipcClient.call<boolean>(IPC_CHANNELS.REPORT_PRINT, {
      type,
      data,
      dateRange,
    });
    return result.data || false;
  },

  /**
   * Export Report as PDF
   */
  exportPdf: async (
    type: 'sales' | 'gst' | 'stock' | 'analytics',
    data: any,
    dateRange: string
  ): Promise<boolean> => {
    const result = await ipcClient.call<boolean>(IPC_CHANNELS.REPORT_EXPORT_PDF, {
      type,
      data,
      dateRange,
    });
    return result.data || false;
  },

  /**
   * Export Report as Excel (CSV)
   */
  exportExcel: async (
    type: 'sales' | 'gst' | 'stock' | 'analytics',
    data: any,
    dateRange: string
  ): Promise<boolean> => {
    const result = await ipcClient.call<boolean>(IPC_CHANNELS.REPORT_EXPORT_EXCEL, {
      type,
      data,
      dateRange,
    });
    return result.data || false;
  },
};
