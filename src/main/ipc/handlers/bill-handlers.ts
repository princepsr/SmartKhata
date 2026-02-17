/**
 * Bill IPC Handlers (Service-Based)
 *
 * Wires billing operations from UI to BillingService.
 * No SQL logic, no repository calls - only service orchestration.
 */

import { IPCHandler } from '../ipc-handler';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { BillingService, FinalizeBillInput, BillItemInput } from '../../services/billing-service';
import { BillRepository } from '../../repositories/bill-repository';
import { PrintService } from '../../services/print-service'; // Import
import { LicenseService } from '../../services/license-service';
import { SettingsService } from '../../services/settings-service';
import { logger } from '../../utils/logger';
import { getUserFriendlyMessage } from '../../services/errors/service-errors';

/**
 * Register All Bill Handlers
 */
export function registerBillHandlers(): void {
  const billingService = new BillingService();
  const billRepo = new BillRepository();
  const printService = PrintService.getInstance(); // Use singleton

  // ============================================
  // CALCULATE BILL (PREVIEW)
  // ============================================
  IPCHandler.handle<{ items: BillItemInput[]; discountAmount?: number }, any>(
    'bill:calculate',
    // ... existing implementation ...
    async ({ items, discountAmount }) => {
      const calculation = billingService.calculateBill(items, discountAmount || 0);

      return {
        items: calculation.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          gstPercent: item.gstPercent,
          lineSubtotal: item.lineSubtotal,
          lineGst: item.lineGst,
          lineTotal: item.lineTotal,
        })),
        subtotal: calculation.subtotal,
        gstTotal: calculation.gstTotal,
        discountAmount: calculation.discountAmount,
        grandTotal: calculation.grandTotal,
      };
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // CREATE BILL (FINALIZE SALE)
  // ============================================
  IPCHandler.handle<FinalizeBillInput, any>(
    'bill:create',
    async (billInput) => {
      // Polite Locking: Check if license is valid before creating bill
      const licenseStatus = new LicenseService().getLicenseStatus();
      if (licenseStatus.isLocked) {
        throw new Error('Trial or License has expired. Please activate to continue billing.');
      }

      const result = billingService.finalizeBill(billInput);

      // 1. Auto-print if enabled in settings
      const settings = new SettingsService().getConfig();
      if (settings.autoPrint) {
        // We trigger print and log any errors, but we don't block the return
        // as the bill creation was successful.
        printService.printBill(result).catch((err) => {
          logger.error('Auto-print failed', err);
        });
      }

      return {
        bill: {
          id: result.bill.id,
          billNumber: result.bill.billNumber,
          customerId: result.bill.customerId,
          subtotal: result.bill.subtotal,
          gstTotal: result.bill.gstTotal,
          discountAmount: result.bill.discountAmount,
          grandTotal: result.bill.grandTotal,
          paymentMode: result.bill.paymentMode,
          createdAt: result.bill.createdAt.getTime(),
        },
        items: result.items.map((item) => ({
          id: item.id,
          billId: item.billId,
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          gstPercent: item.gstPercent,
          lineTotal: item.lineTotal,
        })),
      };
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // PRINT BILL
  // ============================================
  IPCHandler.handle<{ billId: number; printerName?: string }, boolean>(
    'bill:print',
    async (payload) => {
      // 0. Polite Locking: Check if license is valid before printing
      const licenseStatus = new LicenseService().getLicenseStatus();
      if (licenseStatus.isLocked) {
        throw new Error(
          'Trial or License has expired. Please activate to continue printing bills.'
        );
      }

      // Handle both number (legacy) and object payload
      const billId = typeof payload === 'number' ? payload : payload.billId;
      const printerName = typeof payload === 'number' ? undefined : payload.printerName;

      // 1. Send to print service - Detached to fulfill < 300ms trigger requirement
      printService.printBill(billId, printerName).catch((err) => {
        logger.error(`Detached print failed for bill #${billId}`, err);
      });

      return true;
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // GET PRINTERS
  // ============================================
  IPCHandler.handle<void, any[]>(
    'printer:list',
    async () => {
      const printers = await printService.getPrinters();
      // Electron PrinterInfo has 'isDefault' on most platforms.
      // We map it to ensure consistent output for the UI.
      return printers.map((p) => ({
        name: p.name,
        displayName: p.displayName || p.name,
        description: p.description || '',
        status: p.status,
        isDefault: p.isDefault,
        options: p.options,
      }));
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // REPRINT LAST BILL
  // ============================================
  IPCHandler.handle<void, boolean>(
    IPC_CHANNELS.BILL_REPRINT_LAST,
    async () => {
      // 0. License check
      const licenseStatus = new LicenseService().getLicenseStatus();
      if (licenseStatus.isLocked) {
        throw new Error('License expired. Please activate to reprint.');
      }

      // 1. Get last bill
      const lastBill = billingService.getLastBill();

      // 2. Print it - Detached for performance
      printService.printBill(lastBill).catch((err) => {
        logger.error('Detached reprint failed', err);
      });

      return true;
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // GENERATE BILL NUMBER
  // ============================================
  IPCHandler.handle<void, string>(
    'bill:generateNumber',
    async () => {
      return billingService.generateBillNumber();
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // GET BILL BY NUMBER
  // ============================================
  IPCHandler.handle<string, any>(
    'bill:get',
    async (billNumber) => {
      const result = billRepo.findByBillNumberWithItems(billNumber);

      if (!result) {
        throw new Error('Bill not found');
      }

      return {
        bill: {
          id: result.bill.id,
          billNumber: result.bill.billNumber,
          customerId: result.bill.customerId,
          subtotal: result.bill.subtotal,
          gstTotal: result.bill.gstTotal,
          discountAmount: result.bill.discountAmount,
          grandTotal: result.bill.grandTotal,
          paymentMode: result.bill.paymentMode,
          createdAt: result.bill.createdAt.getTime(),
        },
        items: result.items.map((item) => ({
          id: item.id,
          billId: item.billId,
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          gstPercent: item.gstPercent,
          lineTotal: item.lineTotal,
        })),
      };
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ... (rest of list handlers)

  // ============================================
  // LIST BILLS BY DATE RANGE
  // ============================================
  IPCHandler.handle<{ fromDate: string; toDate: string }, any[]>(
    'bill:listByDateRange',
    async ({ fromDate, toDate }) => {
      const bills = billRepo.findByDateRange(new Date(fromDate), new Date(toDate));

      return bills.map((bill) => ({
        id: bill.id,
        billNumber: bill.billNumber,
        customerId: bill.customerId,
        subtotal: bill.subtotal,
        gstTotal: bill.gstTotal,
        discountAmount: bill.discountAmount,
        grandTotal: bill.grandTotal,
        paymentMode: bill.paymentMode,
        createdAt: bill.createdAt.getTime(),
      }));
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // GET TODAY'S BILLS
  // ============================================
  IPCHandler.handle<void, any[]>(
    'bill:today',
    async () => {
      const bills = billRepo.findToday();

      return bills.map((bill) => ({
        id: bill.id,
        billNumber: bill.billNumber,
        customerId: bill.customerId,
        grandTotal: bill.grandTotal,
        paymentMode: bill.paymentMode,
        createdAt: bill.createdAt.getTime(),
      }));
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // GET SALES SUMMARY
  // ============================================
  IPCHandler.handle<{ fromDate: string; toDate: string }, any>(
    'bill:salesSummary',
    async ({ fromDate, toDate }) => {
      return billRepo.getSalesSummary(new Date(fromDate), new Date(toDate));
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // TEST PRINT
  // ============================================
  IPCHandler.handle<{ printerName?: string; paperSize?: '58mm' | '80mm' }, boolean>(
    'printer:testPrint',
    async ({ printerName, paperSize }) => {
      return await printService.testPrint(printerName || '', paperSize || '58mm');
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );
}
