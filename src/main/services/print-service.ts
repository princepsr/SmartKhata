import { BrowserWindow, dialog } from 'electron';
import fs from 'fs';
import { APP_CONSTANTS } from '@shared/constants/app-constants';
import { logger } from '../utils/logger';
import { SettingsService } from './settings-service';
import { StabilityService } from './stability-service';
import { BillWithItems } from '../repositories/bill-repository';

/**
 * Print Service
 *
 * Handles silent thermal printing using a hidden BrowserWindow.
 * Generates HTML receipt and sends it to the default system printer.
 */
const printLogger = logger.forModule('PRINT');

/**
 * Print Service
 *
 * Handles silent thermal printing using a hidden BrowserWindow.
 * Generates HTML receipt and sends it to the default system printer.
 */
export class PrintService {
  /**
   * Print a bill by ID
   * @param billData Complete bill with items (rupee values)
   * @param printerName Target printer name
   */
  async printBill(billData: BillWithItems, printerName: string = ''): Promise<boolean> {
    printLogger.info(
      `Starting print job for bill #${billData.bill.billNumber} on printer: ${printerName || 'Default'}`
    );

    const printWindow: BrowserWindow | null = new BrowserWindow({
      show: false,
      width: 400,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        spellcheck: false,
        sandbox: true,
      },
    });

    // Track for leak prevention
    StabilityService.getInstance().trackWindow(printWindow);

    try {
      const htmlContent = this.generateReceiptHtml(billData);

      // Add a safety timeout for the entire print operation (30s)
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Print operation timed out after 30 seconds'));
        }, 30000);

        const runPrint = async (): Promise<void> => {
          try {
            if (!printWindow || printWindow.isDestroyed()) {
              return reject(new Error('Window lost or destroyed'));
            }

            await printWindow.loadURL(
              `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`
            );

            // Small delay for layout engine
            await new Promise((r) => setTimeout(r, 800));

            if (!printWindow || printWindow.isDestroyed()) {
              return reject(new Error('Window destroyed before print'));
            }

            printWindow.webContents.print(
              {
                silent: true,
                printBackground: true,
                deviceName: printerName,
                pageSize: 'A4',
                margins: {
                  marginType: 'printableArea',
                },
              },
              (success, failureReason) => {
                clearTimeout(timeoutId);
                if (success) {
                  printLogger.info('Print job sent to printer');
                  resolve();
                } else {
                  printLogger.error(`Print failed: ${failureReason}`);
                  reject(new Error(failureReason));
                }
              }
            );
          } catch (err) {
            clearTimeout(timeoutId);
            reject(err as Error);
          }
        };

        runPrint().catch((err) => {
          clearTimeout(timeoutId);
          reject(err);
        });
      });

      return true;
    } catch (error) {
      printLogger.error('Error in print service', error);
      throw error;
    } finally {
      if (printWindow && !printWindow.isDestroyed()) {
        printWindow.destroy(); // Stronger than close() for background windows
      }
    }
  }

  /**
   * Print a report (Sales, GST, Stock)
   */
  async printReport(
    type: 'sales' | 'gst' | 'stock',
    data: unknown,
    dateRange: string,
    printerName: string = ''
  ): Promise<boolean> {
    printLogger.info(
      `Starting print job for report: ${type} on printer: ${printerName || 'Default'}`
    );

    const printWindow: BrowserWindow = new BrowserWindow({
      show: false,
      width: 400,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        spellcheck: false,
        sandbox: true,
      },
    });

    // Track for leak prevention
    StabilityService.getInstance().trackWindow(printWindow);

    try {
      const htmlContent = this.generateReportHtml(type, data, dateRange);

      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Report print timed out'));
        }, 30000);

        const timerId = setTimeout(() => {
          if (printWindow.isDestroyed()) {
            clearTimeout(timeoutId);
            return reject(new Error('Window closed'));
          }

          printWindow.webContents.print(
            {
              silent: true,
              printBackground: true,
              deviceName: printerName,
              pageSize: 'A4',
              margins: { marginType: 'printableArea' },
            },
            (success, failureReason) => {
              clearTimeout(timeoutId);
              clearTimeout(timerId);
              if (success) {
                printLogger.info('Report print job sent');
                resolve();
              } else {
                printLogger.error(`Report print failed: ${failureReason}`);
                reject(new Error(failureReason));
              }
            }
          );
        }, 1000);
      });

      return true;
    } catch (error) {
      printLogger.error('Error in print service (report)', error);
      throw error;
    } finally {
      if (!printWindow.isDestroyed()) {
        printWindow.destroy();
      }
    }
  }

  async exportReportPdf(
    type: 'sales' | 'gst' | 'stock',
    data: unknown,
    dateRange: string
  ): Promise<boolean> {
    printLogger.info(`Starting PDF export for report: ${type}`);

    const printWindow: BrowserWindow = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        spellcheck: false,
        sandbox: true,
      },
    });

    // Track for leak prevention
    StabilityService.getInstance().trackWindow(printWindow);

    try {
      const htmlContent = this.generateReportHtml(type, data, dateRange);

      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      // Wait a bit for layout
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (printWindow.isDestroyed()) {
        throw new Error('Window destroyed during PDF generation');
      }

      const pdfBuffer = await printWindow.webContents.printToPDF({
        margins: {
          marginType: 'default',
        },
        pageSize: 'A4',
        printBackground: true,
      });

      const { filePath } = await dialog.showSaveDialog({
        title: `Save ${type.toUpperCase()} Report as PDF`,
        defaultPath: `SmartKhata_${type}_report_${new Date().toISOString().split('T')[0]}.pdf`,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      });

      if (filePath) {
        fs.writeFileSync(filePath, pdfBuffer);
        printLogger.info(`PDF saved successfully to: ${filePath}`);
        return true;
      }

      return false;
    } catch (error) {
      printLogger.error('Error in PDF export service', error);
      throw error;
    } finally {
      if (!printWindow.isDestroyed()) {
        printWindow.destroy();
      }
    }
  }

  /**
   * Get list of available printers
   */
  async getPrinters(): Promise<Electron.PrinterInfo[]> {
    const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (window) {
      return await window.webContents.getPrintersAsync();
    }
    return [];
  }

  /**
   * Test Print
   */
  async testPrint(printerName: string = '', paperSize: '58mm' | '80mm' = '58mm'): Promise<boolean> {
    printLogger.info(`Starting test print on printer: ${printerName || 'Default'} (${paperSize})`);

    let printWindow: BrowserWindow | null = new BrowserWindow({
      show: false,
      width: 400,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    try {
      const htmlContent = this.generateTestReceiptHtml(paperSize);

      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      await new Promise<void>((resolve, reject) => {
        if (!printWindow) {
          return reject(new Error('Window closed'));
        }

        setTimeout(() => {
          if (!printWindow) {
            return reject(new Error('Window closed'));
          }

          printWindow.webContents.print(
            {
              silent: true,
              printBackground: true,
              deviceName: printerName,
              pageSize: 'A4', // Electron print pageSize is often ignored for custom widths, but we set margins
              margins: { marginType: 'printableArea' },
            },
            (success, failureReason) => {
              if (success) {
                printLogger.info('Test print sent successfully');
                resolve();
              } else {
                printLogger.error(`Test print failed: ${failureReason}`);
                reject(new Error(failureReason));
              }
            }
          );
        }, 500);
      });

      return true;
    } catch (error) {
      printLogger.error('Error in test print', error);
      throw error;
    } finally {
      if (printWindow) {
        printWindow.close();
        printWindow = null;
      }
    }
  }

  /**
   * Generates HTML for a test receipt
   */
  private generateTestReceiptHtml(paperSize: '58mm' | '80mm'): string {
    const width = paperSize === '80mm' ? '78mm' : '54mm';
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const settings = SettingsService.getInstance().getConfig();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: 'Courier New', monospace; 
            font-size: 12px; 
            margin: 0; 
            padding: 5px; 
            width: ${width}; 
            color: #000; 
            background: #fff; 
          }
          .header { text-align: center; margin-bottom: 10px; }
          .logo-placeholder { 
            border: 1px dashed #ccc; 
            padding: 10px; 
            margin-bottom: 10px; 
            display: ${settings.showLogo ? 'block' : 'none'}; 
            font-size: 10px;
            color: #666;
          }
          .header h1 { margin: 0; font-size: 18px; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .content { text-align: center; }
          .footer { text-align: center; margin-top: 15px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-placeholder">LOGO SPACE</div>
          <h1>TEST PRINT</h1>
          <p>${settings.shopName || 'SmartKhata POS'}</p>
        </div>
        <div class="divider"></div>
        <div class="content">
          <p>Printer: Standard Thermal</p>
          <p>Paper Size: ${paperSize}</p>
          <p>Status: ONLINE</p>
          <p>If you can read this, your printer is correctly configured.</p>
        </div>
        <div class="divider"></div>
        <div class="footer">
          <p>${settings.footerMessage}</p>
          <p>${timestamp}</p>
          <p>-- End of Test --</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generates the HTML for a 3-inch (80mm) thermal receipt
   */
  private generateReceiptHtml(data: BillWithItems): string {
    const { bill, items } = data;
    const settings = SettingsService.getInstance().getConfig();

    const date = new Date(bill.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
    const time = new Date(bill.createdAt).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${bill.billNumber}</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 5px; width: 78mm; color: #000; background: #fff; }
          .header { text-align: center; margin-bottom: 10px; }
          .header h1 { margin: 0; font-size: 18px; font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          .meta-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { text-align: left; border-bottom: 1px dashed #000; padding: 2px 0; }
          td { padding: 2px 0; vertical-align: top; }
          .qty { width: 15%; text-align: center; }
          .item { width: 55%; }
          .price { width: 30%; text-align: right; }
          .totals { margin-top: 10px; text-align: right; }
          .totals-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .grand-total { font-size: 16px; font-weight: bold; margin-top: 5px; border-top: 1px dashed #000; padding-top: 5px; }
          .footer { text-align: center; margin-top: 15px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-placeholder">LOGO SPACE</div>
          <h1>${settings.shopName}</h1>
          <p>General Store & Provisions</p>
          <p>Phone: ${settings.phone || '-'}</p>
        </div>
        <div class="divider"></div>
        <div class="meta-row">
          <span>Bill No: ${bill.billNumber}</span>
          <span>${date} ${time}</span>
        </div>
        ${bill.customerId && settings.showCustomerDetails ? `<div class="meta-row"><span>Customer ID: ${bill.customerId}</span></div>` : ''}
        <div class="divider"></div>
        <table>
          <thead>
            <tr>
              <th class="item">Item</th>
              <th class="qty">Qty</th>
              <th class="price">Amt</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (item) => `
              <tr>
                <td class="item">${item.productNameSnapshot}</td>
                <td class="qty">${item.quantity}</td>
                <td class="price">${item.lineTotal.toFixed(2)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
        <div class="divider"></div>
        <div class="totals">
          <div class="totals-row">
            <span>Subtotal:</span>
            <span>${bill.subtotal.toFixed(2)}</span>
          </div>
          <div class="totals-row">
            <span>GST:</span>
            <span>${bill.gstTotal.toFixed(2)}</span>
          </div>
          ${
            bill.discountAmount > 0
              ? `
            <div class="totals-row">
              <span>Discount:</span>
              <span>-${bill.discountAmount.toFixed(2)}</span>
            </div>
          `
              : ''
          }
          <div class="totals-row grand-total">
            <span>Total:</span>
            <span>${bill.grandTotal.toFixed(2)}</span>
          </div>
          <div class="totals-row" style="margin-top:2px; font-size:10px;">
            <span>Mode: ${bill.paymentMode.toUpperCase()}</span>
          </div>
        </div>
        <div class="footer">
          <p>${settings.footerMessage}</p>
          <p>No Exchange / No Refund</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generates HTML for Reports
   */
  private generateReportHtml(type: string, data: any, dateRange: string): string {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    let content = '';
    let title = '';

    if (type === 'sales') {
      title = 'SALES SUMMARY';
      content = this.generateSalesContent(data);
    } else if (type === 'gst') {
      title = 'GST REPORT';
      content = this.generateGstContent(data);
    } else if (type === 'stock') {
      title = 'STOCK SUMMARY';
      content = this.generateStockContent(data);
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 5px; width: 78mm; color: #000; background: #fff; }
          .header { text-align: center; margin-bottom: 10px; }
          .header h1 { margin: 0; font-size: 18px; font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          .meta-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .section-title { font-weight: bold; margin-top: 10px; margin-bottom: 5px; text-decoration: underline; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { text-align: left; border-bottom: 1px dashed #000; padding: 2px 0; }
          td { padding: 2px 0; vertical-align: top; }
          .right { text-align: right; }
          .center { text-align: center; }
          .footer { text-align: center; margin-top: 20px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${APP_CONSTANTS.APP_NAME}</h1>
          <p>General Store & Provisions</p>
        </div>
        <div class="divider"></div>
        <div class="header">
          <p style="font-weight:bold; font-size:14px;">${title}</p>
          <p>${dateRange}</p>
        </div>
        <div class="divider"></div>
        <div class="meta-row">
          <span>Printed: ${timestamp}</span>
        </div>
        <div class="divider"></div>
        ${content}
        <div class="footer">
          <p>-- End of Report --</p>
        </div>
      </body>
      </html>
    `;
  }

  private generateSalesContent(data: any): string {
    const { summary, modes } = data;
    return `
      <div class="section-title">Overview</div>
      <div class="meta-row"><span>Total Bills:</span><span>${summary.billCount}</span></div>
      <div class="meta-row"><span>Total Sales:</span><span>${summary.totalSales.toFixed(2)}</span></div>
      <div class="meta-row"><span>Total Discount:</span><span>${summary.totalDiscount.toFixed(2)}</span></div>
      <div class="divider"></div>
      <div class="meta-row" style="font-weight:bold; font-size:14px;"><span>NET SALES:</span><span>${summary.netSales.toFixed(2)}</span></div>
      <div class="divider"></div>
      <div class="section-title">Payment Modes</div>
      <table>
        <thead><tr><th>Mode</th><th class="right">Count</th><th class="right">Amount</th></tr></thead>
        <tbody>
          ${modes.map((m: any) => `<tr><td>${m.mode.toUpperCase()}</td><td class="right">${m.count}</td><td class="right">${m.totalAmount.toFixed(2)}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
  }

  private generateGstContent(data: any): string {
    return `
      <div class="section-title">GST Summary</div>
      <table>
        <thead><tr><th>Rate</th><th class="right">Taxable</th><th class="right">GST</th><th class="right">Total</th></tr></thead>
        <tbody>
          ${data.slabs.map((s: any) => `<tr><td>${s.gstPercent.toFixed(0)}%</td><td class="right">${s.taxableAmount.toFixed(2)}</td><td class="right">${s.gstAmount.toFixed(2)}</td><td class="right">${s.totalAmount.toFixed(2)}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="divider"></div>
      <div class="meta-row"><span>Total Taxable:</span><span>${data.totalTaxable.toFixed(2)}</span></div>
      <div class="meta-row"><span>Total GST:</span><span>${data.totalGst.toFixed(2)}</span></div>
      <div class="meta-row" style="font-weight:bold;"><span>Total Amount:</span><span>${data.totalAmount.toFixed(2)}</span></div>
    `;
  }

  private generateStockContent(data: any): string {
    return `
      <div class="section-title">Stock Overview</div>
      <div class="meta-row"><span>Total Items:</span><span>${data.totalItems}</span></div>
      <div class="meta-row"><span>Stock Value:</span><span>${data.totalStockValue.toFixed(2)}</span></div>
      <div class="meta-row"><span>Low Stock Alerts:</span><span>${data.lowStockCount}</span></div>
      ${
        data.items && data.items.length > 0
          ? `
        <div class="divider"></div>
        <div class="section-title">Low Stock / Items List</div>
        <table>
          <thead><tr><th>Item</th><th class="right">Qty</th></tr></thead>
          <tbody>
            ${data.items
              .slice(0, 100)
              .map(
                (item: any) =>
                  `<tr><td>${item.name.substring(0, 20)}</td><td class="right">${item.stockQty}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>
        ${data.items.length > 100 ? '<p class="center">... (List truncated) ...</p>' : ''}
      `
          : ''
      }
    `;
  }
}
