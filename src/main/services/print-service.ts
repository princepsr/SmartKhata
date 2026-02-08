import { BrowserWindow } from 'electron';
import { APP_CONSTANTS } from '@shared/constants/app-constants';
import { logger } from '../utils/logger';

/**
 * Print Service
 * 
 * Handles silent thermal printing using a hidden BrowserWindow.
 * Generates HTML receipt and sends it to the default system printer.
 */
export class PrintService {
  
  /**
   * Print a bill by ID
   * (Fetches bill data should be done by caller, this accepts the data)
   */
  async printBill(billData: any, printerName: string = ''): Promise<boolean> {
    logger.info(`Starting print job for bill #${billData.bill.billNumber} on printer: ${printerName || 'Default'}`);

    let printWindow: BrowserWindow | null = new BrowserWindow({
      show: false, // Hidden window
      width: 400, // Approx 80mm
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        spellcheck: false, // Disable spellcheck
        sandbox: true // Enable sandbox for better isolation
      }
    });

    try {
      const htmlContent = this.generateReceiptHtml(billData);
      
      // Load HTML and wait for render
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      // Print
      await new Promise<void>((resolve, reject) => {
        if (!printWindow) return reject('Window closed');
        
        // Use a slight delay to ensure styles are applied (thermal printers can be picky)
        setTimeout(() => {
            if (!printWindow) return reject('Window closed');
            
            printWindow.webContents.print({
              silent: true,
              printBackground: true,
              deviceName: printerName, // Use provided printer name
              // Fix for "content size empty" on some drivers:
              pageSize: 'A4', 
              margins: {
                marginType: 'printableArea'
              }
            }, (success, failureReason) => {
              if (success) {
                logger.info('Print job sent to printer');
                resolve();
              } else {
                logger.error(`Print failed: ${failureReason}`);
                reject(new Error(failureReason));
              }
            });
        }, 500);
      });

      return true;

    } catch (error) {
      logger.error('Error in print service', { error });
      throw error;
    } finally {
      // Cleanup
      if (printWindow) {
        printWindow.close();
        printWindow = null;
      }
    }
  }

  /**
   * Get list of available printers
   */
  async getPrinters(): Promise<Electron.PrinterInfo[]> {
    // We need a BrowserWindow to access getPrintersAsync
    // We can use the focused window or create a temporary one if needed
    const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    
    if (window) {
      return await window.webContents.getPrintersAsync();
    }
    
    return [];
  }

  /**
   * Generates the HTML for a 3-inch (80mm) thermal receipt
   */
  private generateReceiptHtml(data: { bill: any, items: any[] }): string {
    const { bill, items } = data;

    // Date formatting
    const date = new Date(bill.createdAt).toLocaleDateString();
    const time = new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${bill.billNumber}</title>
        <style>
          body {
            font-family: 'Courier New', monospace; /* Monospace for alignment */
            font-size: 12px;
            margin: 0;
            padding: 5px;
            width: 78mm; /* 80mm paper with margin */
            color: #000;
            background: #fff;
          }
          .header {
            text-align: center;
            margin-bottom: 10px;
          }
          .header h1 {
            margin: 0;
            font-size: 18px;
            font-weight: bold;
          }
          .header p {
            margin: 2px 0;
            font-size: 12px;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 5px 0;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th {
            text-align: left;
            border-bottom: 1px dashed #000;
            padding: 2px 0;
          }
          td {
            padding: 2px 0;
            vertical-align: top;
          }
          .qty { width: 15%; text-align: center; }
          .item { width: 55%; }
          .price { width: 30%; text-align: right; }
          
          .totals {
            margin-top: 10px;
            text-align: right;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
          }
          .grand-total {
            font-size: 16px;
            font-weight: bold;
            margin-top: 5px;
            border-top: 1px dashed #000;
            padding-top: 5px;
          }
          .footer {
            text-align: center;
            margin-top: 15px;
            font-size: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${APP_CONSTANTS.APP_NAME}</h1>
          <p>General Store & Provisions</p>
          <p>Phone: 9876543210</p>
        </div>

        <div class="divider"></div>

        <div class="meta-row">
          <span>Bill No: ${bill.billNumber}</span>
          <span>${date} ${time}</span>
        </div>
        ${bill.customerId ? `<div class="meta-row"><span>Customer ID: ${bill.customerId}</span></div>` : ''}

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
            ${items.map(item => `
              <tr>
                <td class="item">${item.productNameSnapshot}</td>
                <td class="qty">${item.quantity}</td>
                <td class="price">${(item.lineTotal / 100).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="divider"></div>

        <div class="totals">
          <div class="totals-row">
            <span>Subtotal:</span>
            <span>${(bill.subtotal / 100).toFixed(2)}</span>
          </div>
          <div class="totals-row">
            <span>GST:</span>
            <span>${(bill.gstTotal / 100).toFixed(2)}</span>
          </div>
          ${bill.discountAmount > 0 ? `
            <div class="totals-row">
              <span>Discount:</span>
              <span>-${(bill.discountAmount / 100).toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="totals-row grand-total">
            <span>Total:</span>
            <span>${(bill.grandTotal / 100).toFixed(2)}</span>
          </div>
           <div class="totals-row" style="margin-top:2px; font-size:10px;">
            <span>Mode: ${bill.paymentMode.toUpperCase()}</span>
          </div>
        </div>

        <div class="footer">
          <p>Thank you! Visit Again</p>
          <p>No Exchange / No Refund</p>
        </div>
      </body>
      </html>
    `;
  }
}
