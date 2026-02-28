import { IPCHandler } from '../ipc-handler';
import { SupplierService } from '../../services/supplier-service';
import { CreateSupplierInput, UpdateSupplierInput } from '../../repositories/supplier-repository';
import { getUserFriendlyMessage } from '../../services/errors/service-errors';
import { IPC_CHANNELS } from '@shared/ipc/channels';

export function registerSupplierHandlers(): void {
  const supplierService = new SupplierService();

  IPCHandler.handle<CreateSupplierInput, any>(
    IPC_CHANNELS.SUPPLIER_CREATE,
    async (input) => supplierService.createSupplier(input),
    { transformError: getUserFriendlyMessage }
  );

  IPCHandler.handle<{ id: number; data: UpdateSupplierInput }, any>(
    IPC_CHANNELS.SUPPLIER_UPDATE,
    async ({ id, data }) => supplierService.updateSupplier(id, data),
    { transformError: getUserFriendlyMessage }
  );

  IPCHandler.handle<{ includeInactive?: boolean }, any>(
    IPC_CHANNELS.SUPPLIER_LIST,
    async ({ includeInactive = false }) => {
      const items = supplierService.getAllSuppliers(includeInactive);
      return { items };
    },
    { transformError: getUserFriendlyMessage }
  );

  IPCHandler.handle<string, any>(
    IPC_CHANNELS.SUPPLIER_SEARCH,
    async (query) => {
      const items = supplierService.searchSuppliers(query);
      return { items };
    },
    { transformError: getUserFriendlyMessage }
  );

  IPCHandler.handle<number, any>(
    IPC_CHANNELS.SUPPLIER_GET,
    async (id) => supplierService.getSupplier(id),
    { transformError: getUserFriendlyMessage }
  );
}
