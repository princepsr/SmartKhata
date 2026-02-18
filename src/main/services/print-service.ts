import { BrowserWindow, dialog } from 'electron';
import fs from 'fs';
import { APP_CONSTANTS } from '@shared/constants/app-constants';
import { logger } from '../utils/logger';
import { PrinterError } from './errors/service-errors';
import { SettingsService } from './settings-service';
import { StabilityService } from './stability-service';
import { BaseService } from './base-service';
import { BillWithItems } from '../repositories/bill-repository';
import { BillingService } from './billing-service';
import {
  DailySalesSummary,
  PaymentModeSummary,
  GstReport,
  StockSummary,
} from '@shared/types/report.types';

type ReportData =
  | { summary: DailySalesSummary; modes: PaymentModeSummary[] }
  | GstReport
  | StockSummary;

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
export class PrintService extends BaseService {
  private static instance: PrintService;
  private static poolWindow: BrowserWindow | null = null;
  private static isPrinting = false;

  constructor() {
    super();
  }

  /**
   * Get Singleton Instance
   */
  public static getInstance(): PrintService {
    if (!PrintService.instance) {
      PrintService.instance = new PrintService();
    }
    return PrintService.instance;
  }

  /**
   * Helper to get or create the pooled print window
   */
  private _getPrintWindow(): BrowserWindow {
    if (PrintService.poolWindow && !PrintService.poolWindow.isDestroyed()) {
      return PrintService.poolWindow;
    }

    PrintService.poolWindow = new BrowserWindow({
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
    StabilityService.getInstance().trackWindow(PrintService.poolWindow);

    return PrintService.poolWindow;
  }

  /**
   * Helper to get printable width based on paper size
   */
  private _getPaperWidth(paperSize: '58mm' | '80mm'): string {
    return paperSize === '80mm' ? '78mm' : '54mm';
  }

  /**
   * Print a bill by ID or data
   * @param billInput Bill ID (number) or complete bill data (BillWithItems)
   * @param printerName Optional target printer override
   */
  async printBill(billInput: number | BillWithItems, printerName?: string): Promise<boolean> {
    // 1. Resolve data if ID is passed
    let billData: BillWithItems;
    if (typeof billInput === 'number') {
      const billingService = new BillingService();
      billData = billingService.getBillById(billInput);
    } else {
      billData = billInput;
    }

    const config = SettingsService.getInstance().getConfig();
    let targetPrinter = printerName || config.printerName || '';
    const paperSize = config.paperSize || '58mm';

    // Normalize "Default" to empty string for Electron to use system default
    printLogger.debug(`DEBUG: Raw targetPrinter before normalization: "${targetPrinter}"`);
    if (targetPrinter && targetPrinter.toLowerCase().trim() === 'default') {
      printLogger.debug('DEBUG: Normalizing "default" printer name to ""');
      targetPrinter = '';
    }

    printLogger.info(
      `Starting print job for bill #${billData.bill.billNumber} on printer: ${targetPrinter || 'System Default'} (${paperSize})`
    );

    if (PrintService.isPrinting) {
      throw new PrinterError('Printer is busy with another job');
    }

    PrintService.isPrinting = true;
    let printWindow: BrowserWindow;

    try {
      printWindow = this._getPrintWindow();
      const htmlContent = this.generateReceiptHtml(billData, paperSize);

      printLogger.info(`Awaiting print promise (30s timeout)...`);
      // Add a safety timeout for the entire print operation (30s)
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Print operation timed out after 30 seconds'));
        }, 30000);

        const runPrint = async (): Promise<void> => {
          if (printWindow.isDestroyed()) {
            throw new Error('Window lost or destroyed');
          }

          printLogger.info(`Loading bill HTML (length: ${htmlContent.length})...`);
          await printWindow.loadURL(
            `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`
          );
          printLogger.info('Bill HTML loaded successfully');

          // Wait for DOM to be fully ready and layout to stabilize
          // Increased delay significantly for virtual/PDF printers
          await new Promise((r) => setTimeout(r, 500));

          // Ensure window is still alive
          if (printWindow.isDestroyed()) {
            throw new Error('Window destroyed during layout wait');
          }

          const copies = config.printCopies || 1;
          printLogger.info(`Printing ${copies} copies...`);

          for (let i = 0; i < copies; i++) {
            if (printWindow.isDestroyed()) {
              throw new Error(`Window destroyed during copy ${i + 1}`);
            }

            await new Promise<void>((resolveCopy, rejectCopy) => {
              const printOptions: any = {
                silent: true,
                printBackground: true,
                deviceName: targetPrinter,
                color: false,
                margins: { marginType: targetPrinter ? 'printableArea' : 'default' },
              };

              // Virtual/Default printers often fail with "empty content" if pageSize is omitted
              if (!targetPrinter || targetPrinter.toLowerCase().includes('pdf')) {
                printOptions.pageSize = 'A4';
              }

              printWindow.webContents.print(printOptions, (success, failureReason) => {
                if (success) {
                  printLogger.info(`Copy ${i + 1}/${copies} sent to spooler`);
                  resolveCopy();
                } else {
                  rejectCopy(new PrinterError(failureReason || 'Print failed'));
                }
              });
            });

            // Small gap between copies to prevent spooler congestion
            if (i < copies - 1) {
              await new Promise((r) => setTimeout(r, 500));
            }
          }
        };

        runPrint()
          .then(() => {
            clearTimeout(timeoutId);
            printLogger.info('Print operation completed successfully');
            resolve();
          })
          .catch((err) => {
            clearTimeout(timeoutId);
            printLogger.error('Print operation failed or timed out', err);
            // If it's a timeout, destroy the window to be safe
            if (err.message && err.message.includes('timeout')) {
              printLogger.warn('Destroying pooled window due to timeout/hang');
              if (PrintService.poolWindow && !PrintService.poolWindow.isDestroyed()) {
                PrintService.poolWindow.destroy();
                PrintService.poolWindow = null;
              }
            }
            reject(err);
          });
      });

      printLogger.info('Print promise resolved, returning true');
      return true;
    } catch (error) {
      const billNum = billData?.bill?.billNumber || 'Unknown';
      printLogger.error(`Error in print service for bill #${billNum}`, error);
      throw error;
    } finally {
      PrintService.isPrinting = false;
      // Do NOT destroy the pooled window.
      // Instead, clear it for the next job if it's still healthy.
      if (PrintService.poolWindow && !PrintService.poolWindow.isDestroyed()) {
        PrintService.poolWindow.loadURL('about:blank').catch(() => {});
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
    printerName?: string
  ): Promise<boolean> {
    const config = SettingsService.getInstance().getConfig();
    const targetPrinter = printerName || config.printerName || '';
    const paperSize = config.paperSize || '58mm';

    printLogger.info(
      `Starting print job for report: ${type} on printer: ${targetPrinter || 'Default'} (${paperSize})`
    );

    if (PrintService.isPrinting) {
      throw new PrinterError('Printer is busy with another job');
    }

    PrintService.isPrinting = true;
    const printWindow: BrowserWindow = this._getPrintWindow();

    try {
      const htmlContent = this.generateReportHtml(type, data as ReportData, dateRange, paperSize);

      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Report print timed out after 30 seconds'));
        }, 30000);

        const runPrint = async (): Promise<void> => {
          try {
            // Minimal delay for layout engine (reduced for performance)
            await new Promise((r) => setTimeout(r, 100));

            if (printWindow.isDestroyed()) {
              clearTimeout(timeoutId);
              return reject(new Error('Window destroyed before report print'));
            }

            printWindow.webContents.print(
              {
                silent: true,
                printBackground: true,
                deviceName: targetPrinter,
                color: false, // Essential for thermal printers
                margins: { marginType: 'printableArea' },
              },
              (success, failureReason) => {
                clearTimeout(timeoutId);
                if (success) {
                  printLogger.info(`Report print job (${type}) sent successfully`);
                  resolve();
                } else {
                  printLogger.error(`Report print failed: ${failureReason}`);
                  // Wrap in PrinterError so IPC layer can map it correctly
                  reject(new PrinterError(failureReason || 'Report print failed'));
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
      printLogger.error(`Error in print service for report: ${type}`, error);
      throw error;
    } finally {
      PrintService.isPrinting = false;
      if (PrintService.poolWindow && !PrintService.poolWindow.isDestroyed()) {
        PrintService.poolWindow.loadURL('about:blank').catch(() => {});
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
      const config = SettingsService.getInstance().getConfig();
      const paperSize = config.paperSize || '80mm';
      const htmlContent = this.generateReportHtml(type, data as ReportData, dateRange, paperSize);

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
   * Get list of available printers with default flag
   */
  async getPrinters(): Promise<Electron.PrinterInfo[]> {
    const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (window) {
      const printers = await window.webContents.getPrintersAsync();
      return printers;
    }
    return [];
  }

  /**
   * Validate that the saved printer in settings exists in the system.
   * If not found, log a warning and return false.
   */
  async validateSavedPrinter(): Promise<{
    isValid: boolean;
    configuredPrinter: string | null;
    availablePrinters: string[];
  }> {
    const config = SettingsService.getInstance().getConfig();
    const savedPrinter = config.printerName;

    if (!savedPrinter) {
      printLogger.info('No printer configured in settings');
      return { isValid: true, configuredPrinter: null, availablePrinters: [] };
    }

    const printers = await this.getPrinters();
    const printerNames = printers.map((p) => p.name);
    const exists = printerNames.includes(savedPrinter);

    if (!exists) {
      printLogger.warn(`CONFIGURED PRINTER NOT FOUND: "${savedPrinter}"`, {
        available: printerNames,
      });
      return {
        isValid: false,
        configuredPrinter: savedPrinter,
        availablePrinters: printerNames,
      };
    }

    printLogger.info(`Printer validation successful: "${savedPrinter}"`);
    return {
      isValid: true,
      configuredPrinter: savedPrinter,
      availablePrinters: printerNames,
    };
  }

  /**
   * Initialize Print Service and run startup checks
   */
  async initialize(): Promise<void> {
    printLogger.info('Initializing Print Service...');

    // Warm up the print window pool
    this._getPrintWindow();

    const validation = await this.validateSavedPrinter();

    if (!validation.isValid && validation.configuredPrinter) {
      // In a real kirana shop, the printer might be switched off.
      // We don't block the app, but we log it clearly.
      printLogger.warn(
        `Printer "${validation.configuredPrinter}" is missing. Printing will fail until reconnected or reconfigured.`
      );
    }
  }

  /**
   * Test Print
   */
  async testPrint(printerName?: string, paperSize?: '58mm' | '80mm'): Promise<boolean> {
    const config = SettingsService.getInstance().getConfig();
    let targetPrinter = printerName || config.printerName || '';
    const targetSize = paperSize || config.paperSize || '58mm';

    if (targetPrinter.toLowerCase() === 'default') {
      targetPrinter = '';
    }

    printLogger.info(
      `Starting test print on printer: ${targetPrinter || 'System Default'} (${targetSize})`
    );

    if (PrintService.isPrinting) {
      throw new Error('Printer is busy with another job');
    }

    PrintService.isPrinting = true;
    const printWindow: BrowserWindow = this._getPrintWindow();

    try {
      const htmlContent = this.generateTestReceiptHtml(targetSize);

      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Test print timed out after 30 seconds'));
        }, 30000);

        // Wait for layout
        setTimeout(() => {
          if (printWindow.isDestroyed()) {
            clearTimeout(timeoutId);
            return reject(new Error('Window destroyed before test print'));
          }

          printLogger.info('Sending test print command...');
          printWindow.webContents.print(
            {
              silent: true,
              printBackground: true,
              deviceName: targetPrinter,
              pageSize: 'A4',
              margins: { marginType: targetPrinter ? 'printableArea' : 'default' },
            },
            (success, failureReason) => {
              clearTimeout(timeoutId);
              if (success) {
                printLogger.info('Test print sent successfully');
                resolve();
              } else {
                printLogger.error(`Test print failed: ${failureReason}`);
                reject(new Error(failureReason || 'unknown-error'));
              }
            }
          );
        }, 500); // Increased from 100ms
      });

      return true;
    } catch (error) {
      printLogger.error('Error in test print', error);
      throw error;
    } finally {
      PrintService.isPrinting = false;
      if (PrintService.poolWindow && !PrintService.poolWindow.isDestroyed()) {
        PrintService.poolWindow.loadURL('about:blank').catch(() => {});
      }
    }
  }

  /**
   * Generates HTML for a test receipt
   */
  private generateTestReceiptHtml(paperSize: '58mm' | '80mm'): string {
    const width = this._getPaperWidth(paperSize);
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
            font-size: 11px; 
            margin: 0; 
            padding: 2px; 
            width: ${width}; 
            min-height: 100px;
            color: #000; 
            background: #fff; 
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .header h1 { margin: 0; font-size: 16px; text-transform: uppercase; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          .footer { margin-top: 15px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header center">
          <h1>TEST PRINT</h1>
          <p>${settings.shopName}</p>
          ${settings.address ? `<p>${settings.address}</p>` : ''}
          ${settings.gstNumber ? `<p>GSTIN: ${settings.gstNumber}</p>` : ''}
        </div>
        <div class="divider"></div>
        <div class="content center">
          <p class="bold">Printer: Standard Thermal</p>
          <p>Paper Size: ${paperSize}</p>
          <p>Status: <span class="bold">ONLINE</span></p>
          <p style="margin: 10px 0;">If you can read this, your printer is correctly configured for SmartKhata.</p>
        </div>
        <div class="divider"></div>
        <div class="footer center">
          <p>${settings.footerMessage || 'Thank you! Visit Again'}</p>
          <p>${timestamp}</p>
          <p>-- End of Test --</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generates the HTML for a thermal receipt
   */
  private generateReceiptHtml(data: BillWithItems, paperSize: '58mm' | '80mm'): string {
    const { bill, items } = data;
    const settings = SettingsService.getInstance().getConfig();
    const width = this._getPaperWidth(paperSize);

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

    // 58mm specialized layout (Condensed)
    if (paperSize === '58mm') {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: 'Courier New', Courier, monospace; 
              font-size: 11px; 
              margin: 0; 
              padding: 2px; 
              width: ${width}; 
              min-height: 100px;
              color: #000; 
              background: #fff; 
              overflow: hidden;
              line-height: 1.2;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .header h1 { margin: 0; font-size: 15px; text-transform: uppercase; }
            .header p { margin: 1px 0; font-size: 10px; }
            .divider { border-top: 1px dashed #000; margin: 4px 0; }
            .info-row { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 1px; }
            
            /* Item Layout: 2 lines for 58mm */
            .item-container { margin-bottom: 5px; }
            .item-name { display: block; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: bold; }
            .item-details { display: flex; justify-content: space-between; }
            
            .totals { margin-top: 5px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 1px; }
            .grand-total { font-size: 14px; margin-top: 4px; border-top: 1px dashed #000; padding-top: 4px; }
            .footer { margin-top: 10px; font-size: 9px; line-height: 1.1; }
          </style>
        </head>
        <body>
          <div class="header center">
            <h1>${settings.shopName}</h1>
            ${settings.address ? `<p>${settings.address}</p>` : ''}
            ${settings.phone ? `<p>PH: ${settings.phone}</p>` : ''}
            ${settings.gstNumber ? `<p>GSTIN: ${settings.gstNumber}</p>` : ''}
          </div>
          <div class="divider"></div>
          <div class="info-row">
            <span>#${bill.billNumber}</span>
            <span>${date} ${time}</span>
          </div>
          <div class="divider"></div>
          
          <div class="items">
            ${items
              .map(
                (item) => `
              <div class="item-container">
                <span class="item-name">${item.productNameSnapshot}</span>
                <div class="item-details">
                  <span>${item.quantity} x ${item.unitPrice.toFixed(2)}</span>
                  <span class="bold">${item.lineTotal.toFixed(2)}</span>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
          
          <div class="divider"></div>
          <div class="totals">
            <div class="total-row"><span>Subtotal:</span><span>${bill.subtotal.toFixed(2)}</span></div>
            <div class="total-row"><span>GST:</span><span>${bill.gstTotal.toFixed(2)}</span></div>
            ${
              bill.discountAmount > 0
                ? `<div class="total-row"><span>Discount:</span><span>-${bill.discountAmount.toFixed(2)}</span></div>`
                : ''
            }
            <div class="total-row bold grand-total">
              <span>TOTAL:</span>
              <span>₹${bill.grandTotal.toFixed(2)}</span>
            </div>
            <div class="total-row" style="font-size: 9px; margin-top: 2px;">
              <span>Mode: ${bill.paymentMode.toUpperCase()}</span>
            </div>
          </div>
          
          <div class="footer center">
            <p>${settings.footerMessage || 'Thank you! Visit Again'}</p>
            <p>SmartKhata POS</p>
          </div>
        </body>
        </html>
      `;
    }

    // 80mm standard layout (Professional Single-line)
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${bill.billNumber}</title>
        <style>
          body { 
            font-family: 'Courier New', Courier, monospace; 
            font-size: 13px; 
            margin: 0; 
            padding: 5px; 
            width: ${width}; 
            min-height: 100px;
            color: #000; 
            background: #fff; 
            overflow: hidden;
            line-height: 1.4;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          
          .header h1 { margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase; }
          .header p { margin: 2px 0; font-size: 12px; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .meta-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; }
          
          /* Table Layout for 80mm (Spacious) */
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th { text-align: left; border-bottom: 1px dashed #000; padding: 4px 0; font-size: 12px; }
          td { padding: 6px 0; vertical-align: top; font-size: 13px; }
          
          .col-name { width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .col-qty { width: 12%; text-align: center; }
          .col-rate { width: 18%; text-align: right; }
          .col-total { width: 25%; text-align: right; }

          .totals { margin-top: 15px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
          .grand-total { font-size: 18px; font-weight: bold; margin-top: 8px; border-top: 1px dashed #000; padding-top: 8px; }
          
          .footer { text-align: center; margin-top: 25px; font-size: 11px; }
          .logo-placeholder { 
            border: 1px dashed #ccc; padding: 10px; margin-bottom: 10px; 
            display: ${settings.showLogo ? 'block' : 'none'}; font-size: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header center">
          <div class="logo-placeholder">LOGO SPACE</div>
          <h1>${settings.shopName}</h1>
          <p>${settings.address || 'SmartKhata Retail Solution'}</p>
          <p>PH: ${settings.phone || '-'}</p>
          ${settings.gstNumber ? `<p>GSTIN: ${settings.gstNumber}</p>` : ''}
        </div>
        
        <div class="divider"></div>
        
        <div class="meta-row">
          <span>Bill No: ${bill.billNumber}</span>
          <span>${date} ${time}</span>
        </div>
        ${bill.customerId && settings.showCustomerDetails ? `<div class="meta-row"><span>Customer: ${bill.customerId}</span></div>` : ''}
        
        <div class="divider"></div>
        
        <table>
          <thead>
            <tr>
              <th class="col-name">ITEM</th>
              <th class="col-qty">QTY</th>
              <th class="col-rate">RATE</th>
              <th class="col-total">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (item) => `
              <tr>
                <td class="col-name">${item.productNameSnapshot}</td>
                <td class="col-qty">${item.quantity}</td>
                <td class="col-rate">${item.unitPrice.toFixed(2)}</td>
                <td class="col-total bold">${item.lineTotal.toFixed(2)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
        
        <div class="divider"></div>
        
        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>${bill.subtotal.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>GST:</span>
            <span>${bill.gstTotal.toFixed(2)}</span>
          </div>
          ${
            bill.discountAmount > 0
              ? `
            <div class="total-row">
              <span>Discount:</span>
              <span style="color: #000;">-${bill.discountAmount.toFixed(2)}</span>
            </div>
          `
              : ''
          }
          <div class="total-row grand-total">
            <span>NET TOTAL:</span>
            <span>₹${bill.grandTotal.toFixed(2)}</span>
          </div>
          <div class="total-row" style="margin-top:4px; font-size:11px;">
            <span>Payment Mode: ${bill.paymentMode.toUpperCase()}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>${settings.footerMessage || 'Thank you for shopping with us!'}</p>
          <p>Visit again!</p>
          <p style="font-size: 9px; margin-top: 10px;">Generated by SmartKhata POS</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generates HTML for Reports
   */
  private generateReportHtml(
    type: string,
    data: ReportData,
    dateRange: string,
    paperSize: '58mm' | '80mm'
  ): string {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const width = this._getPaperWidth(paperSize);
    const fontSize = paperSize === '80mm' ? '12px' : '10px';
    const headerSize = paperSize === '80mm' ? '18px' : '14px';

    let content = '';
    let title = '';

    if (type === 'sales') {
      title = 'SALES SUMMARY';
      content = this.generateSalesContent(
        data as { summary: DailySalesSummary; modes: PaymentModeSummary[] }
      );
    } else if (type === 'gst') {
      title = 'GST REPORT';
      content = this.generateGstContent(data as GstReport);
    } else if (type === 'stock') {
      title = 'STOCK SUMMARY';
      content = this.generateStockContent(data as StockSummary);
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          body { 
            font-family: 'Courier New', monospace; 
            font-size: ${fontSize}; 
            margin: 0; 
            padding: 5px; 
            width: ${width}; 
            color: #000; 
            background: #fff; 
            overflow: hidden;
          }
          .header { text-align: center; margin-bottom: 10px; }
          .header h1 { margin: 0; font-size: ${headerSize}; font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          .meta-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .section-title { font-weight: bold; margin-top: 10px; margin-bottom: 5px; text-decoration: underline; }
          table { width: 100%; border-collapse: collapse; font-size: ${fontSize}; }
          th { text-align: left; border-bottom: 1px dashed #000; padding: 2px 0; }
          td { padding: 2px 0; vertical-align: top; }
          .right { text-align: right; }
          .center { text-align: center; }
          .footer { text-align: center; margin-top: 20px; font-size: calc(${fontSize} - 2px); }
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

  private generateSalesContent(data: {
    summary: DailySalesSummary;
    modes: PaymentModeSummary[];
  }): string {
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
          ${modes
            .map(
              (m: PaymentModeSummary) =>
                `<tr><td>${m.mode.toUpperCase()}</td><td class="right">${m.count}</td><td class="right">${m.totalAmount.toFixed(2)}</td></tr>`
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  private generateGstContent(data: GstReport): string {
    return `
      <div class="section-title">GST Summary</div>
      <table>
        <thead><tr><th>Rate</th><th class="right">Taxable</th><th class="right">GST</th><th class="right">Total</th></tr></thead>
        <tbody>
          ${data.slabs
            .map(
              (s) =>
                `<tr><td>${s.gstPercent.toFixed(0)}%</td><td class="right">${s.taxableAmount.toFixed(2)}</td><td class="right">${s.gstAmount.toFixed(2)}</td><td class="right">${s.totalAmount.toFixed(2)}</td></tr>`
            )
            .join('')}
        </tbody>
      </table>
      <div class="divider"></div>
      <div class="meta-row"><span>Total Taxable:</span><span>${data.totalTaxable.toFixed(2)}</span></div>
      <div class="meta-row"><span>Total GST:</span><span>${data.totalGst.toFixed(2)}</span></div>
      <div class="meta-row" style="font-weight:bold;"><span>Total Amount:</span><span>${data.totalAmount.toFixed(2)}</span></div>
    `;
  }

  private generateStockContent(data: StockSummary): string {
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
                (item) =>
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
