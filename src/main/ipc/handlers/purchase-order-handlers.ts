import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { PurchaseOrderService } from '../../services/purchase-order-service';
import { PurchaseOrder } from '@shared/types/ipc';

const poService = new PurchaseOrderService();

export function registerPurchaseOrderHandlers() {
  ipcMain.handle(IPC_CHANNELS.PO_LIST, async (_, options) => {
    try {
      const result = await poService.list(options);
      return { success: true, ...result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PO_GET, async (_, id: number) => {
    try {
      const po = await poService.getById(id);
      return { success: true, data: po };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PO_CREATE, async (_, data: Partial<PurchaseOrder>) => {
    try {
      const po = await poService.create(data);
      return { success: true, data: po };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.PO_UPDATE,
    async (_, params: { id: number; status: 'PENDING' | 'RECEIVED' | 'CANCELLED' }) => {
      try {
        const success = await poService.updateStatus(params.id, params.status);
        return { success, data: success };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.PO_CONVERT, async (_, id: number) => {
    try {
      // In a real scenario, this would create a Purchase from the PO.
      // For now, we'll mark it as RECEIVED to unblock the UI.
      // This will be expanded later
      const success = await poService.updateStatus(id, 'RECEIVED');
      return { success, data: success };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
