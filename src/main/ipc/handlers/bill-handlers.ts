/**
 * Bill IPC Handlers (Service-Based)
 * 
 * Wires billing operations from UI to BillingService.
 * No SQL logic, no repository calls - only service orchestration.
 */

import { IPCHandler } from '../ipc-handler';
import { BillingService, FinalizeBillInput, BillItemInput } from '../../services/billing-service';
import { BillRepository } from '../../repositories/bill-repository';
import { PrintService } from '../../services/print-service'; // Import
import { 
  getUserFriendlyMessage
} from '../../services/errors/service-errors';

/**
 * Register All Bill Handlers
 */
export function registerBillHandlers(): void {
  const billingService = new BillingService();
  const billRepo = new BillRepository();
  const printService = new PrintService(); // Instantiate

  // ============================================
  // CALCULATE BILL (PREVIEW)
  // ============================================
  IPCHandler.handle<{ items: BillItemInput[]; discountAmount?: number }, any>(
    'bill:calculate',
    // ... existing implementation ...
    async ({ items, discountAmount }) => {
      const calculation = billingService.calculateBill(items, discountAmount || 0);

      return {
        items: calculation.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          gstPercent: item.gstPercent,
          lineSubtotal: item.lineSubtotal,
          lineGst: item.lineGst,
          lineTotal: item.lineTotal
        })),
        subtotal: calculation.subtotal,
        gstTotal: calculation.gstTotal,
        discountAmount: calculation.discountAmount,
        grandTotal: calculation.grandTotal
      };
    },
    {
        transformError: (err) => getUserFriendlyMessage(err)
    }
  );

  // ============================================
  // CREATE BILL (FINALIZE SALE)
  // ============================================
  IPCHandler.handle<FinalizeBillInput, any>(
    'bill:create',
    // ... existing implementation ...
    async (billInput) => {
      const result = billingService.finalizeBill(billInput);

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
          createdAt: result.bill.createdAt.toISOString()
        },
        items: result.items.map(item => ({
          id: item.id,
          billId: item.billId,
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          gstPercent: item.gstPercent,
          lineTotal: item.lineTotal
        }))
      };
    },
    {
        transformError: (err) => getUserFriendlyMessage(err)
    }
  );

  // ============================================
  // PRINT BILL
  // ============================================
  IPCHandler.handle<{ billId: number; printerName?: string }, boolean>(
    'bill:print',
    async (payload) => {
      // Handle both number (legacy) and object payload
      const billId = typeof payload === 'number' ? payload : payload.billId;
      const printerName = typeof payload === 'number' ? '' : payload.printerName;

      // 1. Fetch full bill details to ensure we print accurate data
      const billData = billRepo.findByIdWithItems(billId);
      
      if (!billData) {
        throw new Error('Bill not found for printing');
      }

      // 2. Send to print service
      // We pass the raw DB objects, PrintService handles formatting
      return await printService.printBill({
        bill: {
          ...billData.bill,
          createdAt: billData.bill.createdAt // Date object is preserved in main process
        },
        items: billData.items
      }, printerName);
    },
    {
        transformError: (err) => getUserFriendlyMessage(err)
    }
  );

  // ============================================
  // GET PRINTERS
  // ============================================
  IPCHandler.handle<void, Electron.PrinterInfo[]>(
    'printer:list',
    async () => {
      return await printService.getPrinters();
    },
    {
        transformError: (err) => getUserFriendlyMessage(err)
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
        transformError: (err) => getUserFriendlyMessage(err)
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
          createdAt: result.bill.createdAt.toISOString()
        },
        items: result.items.map(item => ({
          id: item.id,
          billId: item.billId,
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          gstPercent: item.gstPercent,
          lineTotal: item.lineTotal
        }))
      };
    },
    {
        transformError: (err) => getUserFriendlyMessage(err)
    }
  );

  // ... (rest of list handlers)

  // ============================================
  // LIST BILLS BY DATE RANGE
  // ============================================
  IPCHandler.handle<{ fromDate: string; toDate: string }, any[]>(
    'bill:listByDateRange',
    async ({ fromDate, toDate }) => {
      const bills = billRepo.findByDateRange(
        new Date(fromDate),
        new Date(toDate)
      );

      return bills.map(bill => ({
        id: bill.id,
        billNumber: bill.billNumber,
        customerId: bill.customerId,
        subtotal: bill.subtotal,
        gstTotal: bill.gstTotal,
        discountAmount: bill.discountAmount,
        grandTotal: bill.grandTotal,
        paymentMode: bill.paymentMode,
        createdAt: bill.createdAt.toISOString()
      }));
    },
    {
        transformError: (err) => getUserFriendlyMessage(err)
    }
  );

  // ============================================
  // GET TODAY'S BILLS
  // ============================================
  IPCHandler.handle<void, any[]>(
    'bill:today',
    async () => {
      const bills = billRepo.findToday();

      return bills.map(bill => ({
        id: bill.id,
        billNumber: bill.billNumber,
        customerId: bill.customerId,
        grandTotal: bill.grandTotal,
        paymentMode: bill.paymentMode,
        createdAt: bill.createdAt.toISOString()
      }));
    },
    {
        transformError: (err) => getUserFriendlyMessage(err)
    }
  );

  // ============================================
  // GET SALES SUMMARY
  // ============================================
  IPCHandler.handle<{ fromDate: string; toDate: string }, any>(
    'bill:salesSummary',
    async ({ fromDate, toDate }) => {
      return billRepo.getSalesSummary(
        new Date(fromDate),
        new Date(toDate)
      );
    },
    {
        transformError: (err) => getUserFriendlyMessage(err)
    }
  );
}
