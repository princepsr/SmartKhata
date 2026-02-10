import { dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import { logger } from '../utils/logger';

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
    type: 'sales' | 'gst' | 'stock',
    data: any,
    dateRange: string
  ): Promise<boolean> {
    logger.info(`Starting excel export for report: ${type}`);

    try {
      const csvContent = this.generateCsvContent(type, data, dateRange);

      const { filePath } = await dialog.showSaveDialog({
        title: `Export ${type.toUpperCase()} Report`,
        defaultPath: `SmartKhata_${type}_report_${new Date().toISOString().split('T')[0]}.csv`,
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
  private generateCsvContent(type: string, data: any, dateRange: string): string {
    const rows: string[][] = [];

    // Header Metadata
    rows.push(['SmartKhata Report']);
    rows.push(['Type', type.toUpperCase()]);
    rows.push(['Date Range', dateRange]);
    rows.push(['Generated At', new Date().toLocaleString('en-IN')]);
    rows.push([]); // Empty row

    if (type === 'sales') {
      const { summary, modes } = data;
      rows.push(['SALES OVERVIEW']);
      rows.push(['Total Bills', summary.billCount.toString()]);
      rows.push(['Total Sales', summary.totalSales.toFixed(2)]);
      rows.push(['Total Discount', summary.totalDiscount.toFixed(2)]);
      rows.push(['NET SALES', summary.netSales.toFixed(2)]);
      rows.push([]);

      rows.push(['PAYMENT MODES']);
      rows.push(['Mode', 'Count', 'Amount']);
      modes.forEach((m: any) => {
        rows.push([m.mode.toUpperCase(), m.count.toString(), m.totalAmount.toFixed(2)]);
      });
    } else if (type === 'gst') {
      rows.push(['GST SUMMARY']);
      rows.push(['GST Rate (%)', 'Taxable Amount', 'GST Amount', 'Total Amount']);
      data.slabs.forEach((s: any) => {
        rows.push([
          s.gstPercent.toFixed(0),
          s.taxableAmount.toFixed(2),
          s.gstAmount.toFixed(2),
          s.totalAmount.toFixed(2),
        ]);
      });
      rows.push([]);
      rows.push([
        'TOTALS',
        data.totalTaxable.toFixed(2),
        data.totalGst.toFixed(2),
        data.totalAmount.toFixed(2),
      ]);
    } else if (type === 'stock') {
      rows.push(['STOCK SUMMARY']);
      rows.push(['Total Items', data.totalItems.toString()]);
      rows.push(['Total StockValue', data.totalStockValue.toFixed(2)]);
      rows.push(['Low Stock Items', data.lowStockCount.toString()]);
      rows.push([]);

      if (data.items && data.items.length > 0) {
        rows.push(['ITEM LIST']);
        rows.push(['SKU', 'Name', 'Current Stock', 'Low Stock Alert', 'Sale Price']);
        data.items.forEach((item: any) => {
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
            const stringVal = val.toString();
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
