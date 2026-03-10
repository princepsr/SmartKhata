import { IPCHandler } from '../ipc-handler';
import { SupplierService } from '../../services/supplier-service';
import { CreateSupplierInput, UpdateSupplierInput } from '../../repositories/supplier-repository';
import { getUserFriendlyMessage } from '../../services/errors/service-errors';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { 
  Supplier as SupplierIPC, 
  SupplierHistory, 
  SupplierLedgerEntryUI 
} from '@shared/types/ipc';
import { Supplier as SupplierDomain, SupplierLedgerEntry as SupplierLedgerDomain } from '../../repositories/supplier-repository';

export function registerSupplierHandlers(): void {
  const supplierService = new SupplierService();

  IPCHandler.handle<CreateSupplierInput, SupplierIPC>(
    IPC_CHANNELS.SUPPLIER_CREATE,
    async (input) => {
      const supplier = supplierService.createSupplier(input);
      return _mapToUI(supplier);
    },
    { transformError: getUserFriendlyMessage }
  );

  IPCHandler.handle<{ id: number; data: UpdateSupplierInput }, SupplierIPC>(
    IPC_CHANNELS.SUPPLIER_UPDATE,
    async ({ id, data }) => {
      const supplier = supplierService.updateSupplier(id, data);
      return _mapToUI(supplier);
    },
    { transformError: getUserFriendlyMessage }
  );

  IPCHandler.handle<{ includeInactive?: boolean }, { items: SupplierIPC[] }>(
    IPC_CHANNELS.SUPPLIER_LIST,
    async ({ includeInactive = false }) => {
      const items = supplierService.getAllSuppliers(includeInactive);
      return { items: items.map((s: SupplierDomain) => _mapToUI(s)) };
    },
    { transformError: getUserFriendlyMessage }
  );

  IPCHandler.handle<string, { items: SupplierIPC[] }>(
    IPC_CHANNELS.SUPPLIER_SEARCH,
    async (query) => {
      const items = supplierService.searchSuppliers(query);
      return { items: items.map((s: SupplierDomain) => _mapToUI(s)) };
    },
    { transformError: getUserFriendlyMessage }
  );

  IPCHandler.handle<number, SupplierIPC>(
    IPC_CHANNELS.SUPPLIER_GET,
    async (id) => {
      const supplier = supplierService.getSupplier(id);
      return _mapToUI(supplier);
    },
    { transformError: getUserFriendlyMessage }
  );

  IPCHandler.handle<number, SupplierHistory>(
    IPC_CHANNELS.SUPPLIER_HISTORY,
    async (id) => {
      const history = supplierService.getSupplierHistory(id);
      return {
        supplier: history.supplier,
        ledger: history.ledger.map((entry: SupplierLedgerDomain) => ({
          ...entry,
          createdAt: entry.createdAt.getTime(),
        } as SupplierLedgerEntryUI)),
      };
    },
    { transformError: getUserFriendlyMessage }
  );

  IPCHandler.handle<{ id: number; amount: number; notes?: string }, void>(
    IPC_CHANNELS.SUPPLIER_ADD_PAYMENT,
    async ({ id, amount, notes }) => {
      supplierService.addManualPayment(id, amount, notes);
    },
    { transformError: getUserFriendlyMessage }
  );

  IPCHandler.handle<{ id: number; isActive: boolean }, void>(
    IPC_CHANNELS.SUPPLIER_TOGGLE_STATUS,
    async ({ id, isActive }) => {
      supplierService.updateSupplier(id, { isActive });
    },
    { transformError: getUserFriendlyMessage }
  );
}

/**
 * Map Supplier Domain to IPC Object
 */
function _mapToUI(s: SupplierDomain): SupplierIPC {
  return {
    id: s.id,
    name: s.name,
    phone: s.phone,
    gstin: s.gstin,
    address: s.address,
    email: s.email,
    balanceDue: s.balanceDue,
    isActive: s.isActive,
    createdAt: s.createdAt.getTime(),
    updatedAt: s.updatedAt.getTime(),
  };
}
