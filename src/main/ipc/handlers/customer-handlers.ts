/**
 * Customer IPC Handlers
 *
 * Wires customer management from UI to CustomerService.
 * Handles validation, mapping, and error reporting.
 */

import { IPC_CHANNELS } from '@shared/ipc/channels';
import { IPCHandler } from '../ipc-handler';
import {
  CustomerService,
  CreateOrGetCustomerInput,
  UpdateCustomerData,
  CustomerHistory,
} from '../../services/customer-service';
import { Customer } from '../../repositories/customer-repository';
import { getUserFriendlyMessage } from '../../services/errors/service-errors';
import { CustomerSearchSchema } from '@shared/validation/schemas';

interface CustomerUI {
  id: number;
  name: string;
  phone: string | null;
  address?: string;
  email?: string;
  balanceDue: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Register All Customer Handlers
 */
export function registerCustomerHandlers(): void {
  const customerService = new CustomerService();

  // ============================================
  // LIST ALL ACTIVE CUSTOMERS
  // ============================================
  IPCHandler.handle<
    { includeInactive?: boolean; page?: number; pageSize?: number } | void,
    { items: CustomerUI[]; totalCount: number; hasMore: boolean; page: number }
  >(
    IPC_CHANNELS.CUSTOMER_LIST,
    async (payload) => {
      const options = (payload && typeof payload === 'object' ? payload : {}) as any;
      const includeInactive = !!options.includeInactive;
      const page = options.page ?? 1;
      const pageSize = options.pageSize ?? 100;

      const result = customerService.getAllCustomers(includeInactive, page, pageSize);
      const totalCount = customerService.getCustomerCount(includeInactive);
      const hasMore = page * pageSize < totalCount;

      return {
        items: result.items.map((c: Customer) => _mapToUI(c)),
        totalCount,
        hasMore,
        page: result.page,
      };
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // GET CUSTOMER BY ID
  // ============================================
  IPCHandler.handle<number, CustomerUI>(
    IPC_CHANNELS.CUSTOMER_GET,
    async (id) => {
      const customer = customerService.getCustomer(id);
      return _mapToUI(customer);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // CREATE OR GET CUSTOMER
  // ============================================
  IPCHandler.handle<CreateOrGetCustomerInput, CustomerUI>(
    IPC_CHANNELS.CUSTOMER_CREATE,
    async (input) => {
      const customer = customerService.createOrGetCustomer(input);
      return _mapToUI(customer);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // UPDATE CUSTOMER
  // ============================================
  IPCHandler.handle<{ id: number; data: UpdateCustomerData }, CustomerUI>(
    IPC_CHANNELS.CUSTOMER_UPDATE,
    async ({ id, data }) => {
      const customer = customerService.updateCustomer(id, data);
      return _mapToUI(customer);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // DELETE (DEACTIVATE) CUSTOMER
  // ============================================
  IPCHandler.handle<number, void>(
    IPC_CHANNELS.CUSTOMER_DELETE,
    async (id) => {
      customerService.deactivateCustomer(id);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // SEARCH CUSTOMERS
  // ============================================
  IPCHandler.handle<
    { query: string; includeInactive?: boolean; page?: number; pageSize?: number },
    { items: CustomerUI[]; totalCount: number; hasMore: boolean; page: number }
  >(
    IPC_CHANNELS.CUSTOMER_SEARCH,
    async ({ query, includeInactive, page, pageSize }) => {
      const result = customerService.searchCustomers(query, includeInactive, page, pageSize);
      return {
        items: result.items.map((c: Customer) => _mapToUI(c)),
        totalCount: result.totalCount,
        hasMore: result.hasMore,
        page: result.page,
      };
    },
    {
      schema: CustomerSearchSchema,
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // GET CUSTOMER HISTORY (Ledger & Bills)
  // ============================================
  IPCHandler.handle<number, CustomerHistory>(
    IPC_CHANNELS.CUSTOMER_HISTORY,
    async (id) => {
      // NOTE: CustomerHistory contains the raw domain objects from repo.
      // If we need to map the customer object inside it to UI format, we can do it here:
      const history = customerService.getCustomerHistory(id);
      return {
        ...history,
        customer: _mapToUI(history.customer),
      };
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // ADD MANUAL PAYMENT
  // ============================================
  IPCHandler.handle<{ id: number; amount: number; notes?: string }, void>(
    IPC_CHANNELS.CUSTOMER_ADD_PAYMENT,
    async ({ id, amount, notes }) => {
      customerService.addManualPayment(id, amount, notes);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // TOGGLE CUSTOMER STATUS
  // ============================================
  IPCHandler.handle<{ id: number; isActive: boolean }, void>(
    IPC_CHANNELS.CUSTOMER_TOGGLE_STATUS,
    async ({ id, isActive }) => {
      customerService.updateCustomer(id, { isActive });
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );
}

/**
 * Map Domain Customer to UI Object
 */
function _mapToUI(c: Customer): CustomerUI {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    address: c.address,
    email: c.email,
    balanceDue: c.balanceDue,
    isActive: c.isActive,
    createdAt: c.createdAt instanceof Date ? c.createdAt.getTime() : c.createdAt,
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.getTime() : c.updatedAt,
  };
}
