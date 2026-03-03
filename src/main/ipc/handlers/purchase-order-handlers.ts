import { IPCHandler } from '../ipc-handler';
import { PurchaseOrderService } from '../../services/purchase-order-service';
import { PurchaseOrder } from '@shared/types/ipc';
import { IPC_CHANNELS } from '@shared/ipc/channels';

export function registerPurchaseOrderHandlers() {
  const poService = new PurchaseOrderService();

  // ============================================
  // LIST PURCHASE ORDERS
  // ============================================
  IPCHandler.handle<
    { startDate?: string; endDate?: string },
    { data: PurchaseOrder[]; total: number }
  >(IPC_CHANNELS.PO_LIST, async (options) => {
    return poService.list(options);
  });

  // ============================================
  // GET PURCHASE ORDER BY ID
  // ============================================
  IPCHandler.handle<number, PurchaseOrder>(IPC_CHANNELS.PO_GET, async (id) => {
    return poService.getById(id);
  });

  // ============================================
  // CREATE PURCHASE ORDER
  // ============================================
  IPCHandler.handle<Partial<PurchaseOrder>, PurchaseOrder>(IPC_CHANNELS.PO_CREATE, async (data) => {
    return poService.create(data);
  });

  // ============================================
  // UPDATE PURCHASE ORDER
  // ============================================
  IPCHandler.handle<{ id: number; data: Partial<PurchaseOrder> }, PurchaseOrder>(
    IPC_CHANNELS.PO_UPDATE,
    async (params) => {
      return poService.update(params.id, params.data);
    }
  );

  // ============================================
  // CONVERT PO TO PURCHASE (Mark as Received)
  // ============================================
  IPCHandler.handle<number, boolean>(IPC_CHANNELS.PO_CONVERT, async (id) => {
    return poService.updateStatus(id, 'RECEIVED');
  });
}
