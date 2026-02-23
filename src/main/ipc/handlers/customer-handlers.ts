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

/**
 * Register All Customer Handlers
 */
export function registerCustomerHandlers(): void {
  const customerService = new CustomerService();

  // ============================================
  // LIST ALL ACTIVE CUSTOMERS
  // ============================================
  IPCHandler.handle<{ includeInactive?: boolean } | void, Customer[]>(
    IPC_CHANNELS.CUSTOMER_LIST,
    async (payload) => {
      let includeInactive = false;
      if (payload && typeof payload === 'object') {
        includeInactive = !!payload.includeInactive;
      }
      const customers = customerService.getAllCustomers(includeInactive);
      return customers.map((c) => _mapToUI(c));
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // GET CUSTOMER BY ID
  // ============================================
  IPCHandler.handle<number, Customer>(
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
  IPCHandler.handle<CreateOrGetCustomerInput, Customer>(
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
  IPCHandler.handle<{ id: number; data: UpdateCustomerData }, Customer>(
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
  IPCHandler.handle<{ query: string; includeInactive?: boolean } | string, Customer[]>(
    IPC_CHANNELS.CUSTOMER_SEARCH,
    async (payload) => {
      let query: string;
      let includeInactive = false;

      if (typeof payload === 'string') {
        query = payload;
      } else {
        query = payload.query;
        includeInactive = !!payload.includeInactive;
      }

      const customers = customerService.searchCustomers(query, includeInactive);
      return customers.map((c) => _mapToUI(c));
    },
    {
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
}

/**
 * Map Domain Customer to UI Object
 */
function _mapToUI(c: Customer): any {
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
