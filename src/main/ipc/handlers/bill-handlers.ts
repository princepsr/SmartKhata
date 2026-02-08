/**
 * Bill IPC Handlers
 * 
 * Wires billing operations from UI to BillingTransactionService.
 * No SQL logic here - only orchestration.
 */

import { IPCHandler } from '../ipc-handler';
import { BillingTransactionService, CreateSaleInput } from '../../services/billing-transaction-service';
import { BillRepository } from '../../repositories/bill-repository';
import { Logger } from '../../utils/logger';
import { DatabaseError } from '../../repositories/base-repository';

/**
 * Safe Response Format
 */
interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Register All Bill Handlers
 */
export function registerBillHandlers(): void {
  const billingService = new BillingTransactionService();
  const billRepo = new BillRepository();

  // ============================================
  // CREATE BILL (COMPLETE SALE TRANSACTION)
  // ============================================
  IPCHandler.handle<CreateSaleInput, IPCResponse<any>>(
    'bill:create',
    async (saleData) => {
      try {
        // Validate before starting transaction
        billingService.validateSale(saleData);

        // Create sale (atomic transaction)
        const result = billingService.createSale(saleData);

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

        // Handle specific errors
        if (error instanceof Error) {
          if (error.message.includes('Insufficient stock')) {
            return {
              success: false,
              error: error.message
            };
          }
          if (error.message.includes('already exists')) {
            return {
              success: false,
              error: 'Bill number already exists'
            };
          }
          if (error.message.includes('not found')) {
            return {
              success: false,
              error: error.message
            };
          }
        }

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create bill'
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
            error: 'Bill not found'
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
          error: error instanceof Error ? error.message : 'Failed to get bill'
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
          error: error instanceof Error ? error.message : 'Failed to list bills'
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
          error: error instanceof Error ? error.message : 'Failed to get today bills'
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
          error: error instanceof Error ? error.message : 'Failed to get sales summary'
        };
      }
    }
  );
}
