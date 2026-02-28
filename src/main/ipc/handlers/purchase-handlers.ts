/**
 * Purchase (ITC) IPC Handlers
 *
 * Handles supplier purchase invoice recording and ITC summary queries.
 */

import { IPCHandler } from '../ipc-handler';
import { PurchaseService, RecordPurchaseInput } from '../../services/purchase-service';
import { getUserFriendlyMessage } from '../../services/errors/service-errors';
import { IPC_CHANNELS } from '@shared/ipc/channels';

export function registerPurchaseHandlers(): void {
  const purchaseService = new PurchaseService();

  // ============================================
  // RECORD PURCHASE (ITC)
  // ============================================
  IPCHandler.handle<RecordPurchaseInput, any>(
    IPC_CHANNELS.PURCHASE_RECORD,
    async (input) => {
      const result = purchaseService.recordPurchase(input);
      return {
        purchase: {
          ...result.purchase,
          createdAt: result.purchase.createdAt.getTime(),
          updatedAt: result.purchase.updatedAt.getTime(),
        },
        items: result.items,
      };
    },
    { transformError: (err) => getUserFriendlyMessage(err) }
  );

  // ============================================
  // LIST PURCHASES
  // ============================================
  IPCHandler.handle<{ startDate: string; endDate: string; page?: number }, any>(
    IPC_CHANNELS.PURCHASE_LIST,
    async ({ startDate, endDate, page = 1 }) => {
      const result = purchaseService.listPurchases(startDate, endDate, page);
      return {
        data: result.data.map((p) => ({
          ...p,
          createdAt: p.createdAt.getTime(),
          updatedAt: p.updatedAt.getTime(),
        })),
        total: result.total,
      };
    },
    { transformError: (err) => getUserFriendlyMessage(err) }
  );

  // ============================================
  // GET PURCHASE BY ID
  // ============================================
  IPCHandler.handle<number, any>(
    IPC_CHANNELS.PURCHASE_GET_BY_ID,
    async (id) => {
      const result = purchaseService.getPurchaseById(id);
      if (!result) {
        throw new Error('Purchase not found');
      }
      return {
        purchase: {
          ...result.purchase,
          createdAt: result.purchase.createdAt.getTime(),
          updatedAt: result.purchase.updatedAt.getTime(),
        },
        items: result.items,
      };
    },
    { transformError: (err) => getUserFriendlyMessage(err) }
  );

  // ============================================
  // GET ITC SUMMARY
  // ============================================
  IPCHandler.handle<{ startDate: string; endDate: string }, any>(
    IPC_CHANNELS.PURCHASE_ITC_SUMMARY,
    async ({ startDate, endDate }) => {
      return purchaseService.getITCSummary(startDate, endDate);
    },
    { transformError: (err) => getUserFriendlyMessage(err) }
  );

  // ============================================
  // GET NET GST LIABILITY (Output - ITC)
  // ============================================
  IPCHandler.handle<{ startDate: string; endDate: string; outputGst: number }, any>(
    IPC_CHANNELS.PURCHASE_NET_GST_LIABILITY,
    async ({ startDate, endDate, outputGst }) => {
      return purchaseService.getNetGstLiability(startDate, endDate, outputGst);
    },
    { transformError: (err) => getUserFriendlyMessage(err) }
  );

  // ============================================
  // GENERATE PURCHASE NUMBER
  // ============================================
  IPCHandler.handle<void, string>(
    IPC_CHANNELS.PURCHASE_GENERATE_NUMBER,
    async () => purchaseService.generatePurchaseNumber(),
    { transformError: (err) => getUserFriendlyMessage(err) }
  );
}
