/**
 * Bill IPC Handlers (Service-Based)
 * 
 * Wires billing operations from UI to BillingService.
 * No SQL logic, no repository calls - only service orchestration.
 */

import { IPCHandler } from '../ipc-handler';
import { BillingService, FinalizeBillInput, BillItemInput } from '../../services/billing-service';
import { BillRepository } from '../../repositories/bill-repository';
import { Logger } from '../../utils/logger';
import { 
  ValidationError, 
  NotFoundError, 
  DuplicateEntryError,
  InsufficientStockError,
  InactiveEntityError,
  getUserFriendlyMessage,
  isServiceError
} from '../../services/errors/service-errors';

/**
 * Safe Response Format
 */
interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  context?: Record<string, any>;
}

/**
 * Register All Bill Handlers
 */
export function registerBillHandlers(): void {
  const billingService = new BillingService();
  const billRepo = new BillRepository();

  // ============================================
  // CALCULATE BILL (PREVIEW)
  // ============================================
  IPCHandler.handle<{ items: BillItemInput[]; discountAmount?: number }, IPCResponse<any>>(
    'bill:calculate',
    async ({ items, discountAmount }) => {
      try {
        const calculation = billingService.calculateBill(items, discountAmount || 0);

        return {
          success: true,
          data: {
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
          }
        };
      } catch (error) {
        Logger.error('Failed to calculate bill', error);
        
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: error.getUserMessage(),
            errorCode: 'VALIDATION_ERROR'
          };
        }

        if (error instanceof NotFoundError) {
          return {
            success: false,
            error: error.getUserMessage(),
            errorCode: 'NOT_FOUND'
          };
        }

        if (error instanceof InactiveEntityError) {
          return {
            success: false,
            error: error.getUserMessage(),
            errorCode: 'INACTIVE_ENTITY'
          };
        }

        return {
          success: false,
          error: getUserFriendlyMessage(error)
        };
      }
    }
  );

  // ============================================
  // CREATE BILL (FINALIZE SALE)
  // ============================================
  IPCHandler.handle<FinalizeBillInput, IPCResponse<any>>(
    'bill:create',
    async (billInput) => {
      try {
        const result = billingService.finalizeBill(billInput);

        return {
          success: true,
          data: {
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
          }
        };
      } catch (error) {
        Logger.error('Failed to create bill', error);

        // Handle specific service errors
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: error.getUserMessage(),
            errorCode: 'VALIDATION_ERROR'
          };
        }

        if (error instanceof InsufficientStockError) {
          return {
            success: false,
            error: error.getUserMessage(),
            errorCode: 'INSUFFICIENT_STOCK',
            context: {
              productId: error.productId,
              productName: error.productName,
              available: error.available,
              required: error.required
            }
          };
        }

        if (error instanceof DuplicateEntryError) {
          return {
            success: false,
            error: 'Bill number already exists',
            errorCode: 'DUPLICATE_ENTRY'
          };
        }

        if (error instanceof NotFoundError) {
          return {
            success: false,
            error: error.getUserMessage(),
            errorCode: 'NOT_FOUND'
          };
        }

        if (error instanceof InactiveEntityError) {
          return {
            success: false,
            error: error.getUserMessage(),
            errorCode: 'INACTIVE_ENTITY'
          };
        }

        return {
          success: false,
          error: getUserFriendlyMessage(error)
        };
      }
    }
  );

  // ============================================
  // GENERATE BILL NUMBER
  // ============================================
  IPCHandler.handle<void, IPCResponse<string>>(
    'bill:generateNumber',
    async () => {
      try {
        const billNumber = billingService.generateBillNumber();

        return {
          success: true,
          data: billNumber
        };
      } catch (error) {
        Logger.error('Failed to generate bill number', error);
        return {
          success: false,
          error: getUserFriendlyMessage(error)
        };
      }
    }
  );

  // ============================================
  // GET BILL BY NUMBER
  // ============================================
  IPCHandler.handle<string, IPCResponse<any>>(
    'bill:get',
    async (billNumber) => {
      try {
        const result = billRepo.findByBillNumberWithItems(billNumber);

        if (!result) {
          return {
            success: false,
            error: 'Bill not found',
            errorCode: 'NOT_FOUND'
          };
        }

        return {
          success: true,
          data: {
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
          }
        };
      } catch (error) {
        Logger.error('Failed to get bill', error);
        return {
          success: false,
          error: getUserFriendlyMessage(error)
        };
      }
    }
  );

  // ============================================
  // LIST BILLS BY DATE RANGE
  // ============================================
  IPCHandler.handle<{ fromDate: string; toDate: string }, IPCResponse<any[]>>(
    'bill:listByDateRange',
    async ({ fromDate, toDate }) => {
      try {
        const bills = billRepo.findByDateRange(
          new Date(fromDate),
          new Date(toDate)
        );

        const plainBills = bills.map(bill => ({
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

        return {
          success: true,
          data: plainBills
        };
      } catch (error) {
        Logger.error('Failed to list bills', error);
        return {
          success: false,
          error: getUserFriendlyMessage(error)
        };
      }
    }
  );

  // ============================================
  // GET TODAY'S BILLS
  // ============================================
  IPCHandler.handle<void, IPCResponse<any[]>>(
    'bill:today',
    async () => {
      try {
        const bills = billRepo.findToday();

        const plainBills = bills.map(bill => ({
          id: bill.id,
          billNumber: bill.billNumber,
          customerId: bill.customerId,
          grandTotal: bill.grandTotal,
          paymentMode: bill.paymentMode,
          createdAt: bill.createdAt.toISOString()
        }));

        return {
          success: true,
          data: plainBills
        };
      } catch (error) {
        Logger.error('Failed to get today bills', error);
        return {
          success: false,
          error: getUserFriendlyMessage(error)
        };
      }
    }
  );

  // ============================================
  // GET SALES SUMMARY
  // ============================================
  IPCHandler.handle<{ fromDate: string; toDate: string }, IPCResponse<any>>(
    'bill:salesSummary',
    async ({ fromDate, toDate }) => {
      try {
        const summary = billRepo.getSalesSummary(
          new Date(fromDate),
          new Date(toDate)
        );

        return {
          success: true,
          data: summary
        };
      } catch (error) {
        Logger.error('Failed to get sales summary', error);
        return {
          success: false,
          error: getUserFriendlyMessage(error)
        };
      }
    }
  );
}
