import { dialog } from 'electron';
import fs from 'fs';
import { logger } from '../utils/logger';
import {
  DailySalesSummary,
  PaymentModeSummary,
  GstReport,
  StockSummary,
} from '../../shared/types/report.types';

type ExportData =
  | { summary: DailySalesSummary; modes: PaymentModeSummary[] }
  | GstReport
  | StockSummary;

/**
 * Export Service
 *
 * Handles exporting report data to CSV/Excel format.
 */
export class ExportService {
  /**
   * Export data to CSV/Excel
   */
  async exportToExcel(
    type: 'sales' | 'gst' | 'stock' | 'analytics',
    data: ExportData | any,
    dateRange: string
  ): Promise<boolean> {
    logger.info(`Starting excel export for report: ${type}`);

    try {
      const csvContent = this.generateCsvContent(type, data, dateRange);

      const localDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
      const { filePath } = await dialog.showSaveDialog({
        title: `Export ${type.toUpperCase()} Report`,
        defaultPath: `SmartKhata_${type}_report_${localDate}.csv`,
        filters: [
          { name: 'CSV (Comma Separated Values)', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!filePath) {
        logger.info('Excel export cancelled by user');
        return false;
      }

      fs.writeFileSync(filePath, csvContent, 'utf-8');
      logger.info(`Excel export successful: ${filePath}`);
      return true;
    } catch (error) {
      logger.error('Error in excel export service', { error });
      throw error;
    }
  }

  /**
   * Generates CSV string based on report type
   */
  private generateCsvContent(type: string, data: ExportData, dateRange: string): string {
    const rows: string[][] = [];

    // Header Metadata
    rows.push(['SmartKhata Report']);
    rows.push(['Type', type.toUpperCase()]);
    rows.push(['Date Range', dateRange]);
    rows.push(['Generated At', new Date().toLocaleString('en-IN')]);
    rows.push([]); // Empty row

    if (type === 'sales') {
      const { summary, modes } = data as {
        summary: DailySalesSummary;
        modes: PaymentModeSummary[];
      };
      rows.push(['SALES OVERVIEW']);
      rows.push(['Total Bills', summary.billCount.toString()]);
      rows.push(['Total Sales', summary.totalSales.toFixed(2)]);
      rows.push(['Total Discount', summary.totalDiscount.toFixed(2)]);
      rows.push(['NET SALES', summary.netSales.toFixed(2)]);
      rows.push([]);

      rows.push(['PAYMENT MODES']);
      rows.push(['Mode', 'Count', 'Amount']);
      modes.forEach((m: PaymentModeSummary) => {
        rows.push([m.mode.toUpperCase(), m.count.toString(), m.totalAmount.toFixed(2)]);
      });
    } else if (type === 'gst') {
      const gst = data as GstReport;
      rows.push(['GST SUMMARY (GSTR-1 Breakdown)']);
      rows.push(['Supply Type', gst.supplyType.toUpperCase()]);
      rows.push([]);
      rows.push([
        'GST Rate (%)',
        'Taxable Amount',
        'CGST',
        'SGST',
        'IGST',
        'Total GST',
        'Total (Incl. Tax)',
      ]);
      gst.slabs.forEach((s) => {
        rows.push([
          s.gstPercent.toFixed(0),
          s.taxableAmount.toFixed(2),
          s.cgstAmount.toFixed(2),
          s.sgstAmount.toFixed(2),
          s.igstAmount.toFixed(2),
          s.gstAmount.toFixed(2),
          s.totalAmount.toFixed(2),
        ]);
      });
      rows.push([]);
      rows.push([
        'TOTALS',
        gst.totalTaxable.toFixed(2),
        gst.totalCgst.toFixed(2),
        gst.totalSgst.toFixed(2),
        gst.totalIgst.toFixed(2),
        gst.totalGst.toFixed(2),
        gst.totalAmount.toFixed(2),
      ]);
    } else if (type === 'stock') {
      const stock = data as StockSummary;
      rows.push(['STOCK SUMMARY']);
      rows.push(['Total Items', stock.totalItems.toString()]);
      rows.push(['Total StockValue', stock.totalStockValue.toFixed(2)]);
      rows.push(['Low Stock Items', stock.lowStockCount.toString()]);
      rows.push([]);

      if (stock.items && stock.items.length > 0) {
        rows.push(['ITEM LIST']);
        rows.push(['SKU', 'Name', 'Current Stock', 'Low Stock Alert', 'Sale Price']);
        stock.items.forEach((item) => {
          rows.push([
            item.sku || '',
            item.name,
            item.stockQty.toString(),
            item.lowStockAlert.toString(),
            item.salePrice.toFixed(2),
          ]);
        });
      }
    }

    // Convert rows to CSV string, handling commas in values
    return rows
      .map((row) =>
        row
          .map((val) => {
            const stringVal = val?.toString() || '';
            if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
              return `"${stringVal.replace(/"/g, '""')}"`;
            }
            return stringVal;
          })
          .join(',')
      )
      .join('\n');
  }
}
