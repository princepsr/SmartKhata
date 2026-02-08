/**
 * Customer Service
 * 
 * Business logic for customer management.
 * Handles validation, duplicate prevention, and balance tracking.
 */

import { BaseService } from './base-service';
import { CustomerRepository, CreateCustomerInput, UpdateCustomerInput } from '../repositories/customer-repository';
import { BillRepository } from '../repositories/bill-repository';
import { 
  ValidationError, 
  NotFoundError, 
  DuplicateEntryError,
  InactiveEntityError 
} from './errors/service-errors';

/**
 * Customer Input (from IPC/UI)
 */
export interface CreateOrGetCustomerInput {
  name: string;
  phone?: string;
  balanceDue?: number;
}

/**
 * Customer Update Input
 */
export interface UpdateCustomerData {
  name?: string;
  phone?: string;
  isActive?: boolean;
}

/**
 * Customer History (bills + balance)
 */
export interface CustomerHistory {
  customer: any;
  bills: any[];
  totalPurchases: number;
  currentBalance: number;
}

/**
 * Customer Service
 */
export class CustomerService extends BaseService {
  private customerRepo: CustomerRepository;
  private billRepo: BillRepository;

  constructor() {
    super();
    this.customerRepo = new CustomerRepository();
    this.billRepo = new BillRepository();
  }

  /**
   * Create or get existing customer by phone
   * 
   * If phone is provided and customer exists, return existing customer.
   * Otherwise, create new customer.
   */
  public createOrGetCustomer(input: CreateOrGetCustomerInput): any {
    // 1. Validate input
    this._validateCustomerInput(input);

    // 2. If phone provided, check for existing customer
    if (input.phone) {
      const existing = this.customerRepo.findByPhone(input.phone);
      if (existing) {
        this.logInfo('Existing customer found', { 
          id: existing.id, 
          name: existing.name,
          phone: existing.phone 
        });
        return existing;
      }
    }

    // 3. Create new customer
    const customerInput: CreateCustomerInput = {
      name: input.name,
      phone: input.phone,
      balanceDue: input.balanceDue ?? 0
    };

    const customer = this.customerRepo.create(customerInput);
    
    this.logInfo('Customer created', { 
      id: customer.id, 
      name: customer.name,
      phone: customer.phone 
    });

    return customer;
  }

  /**
   * Get customer by ID
   */
  public getCustomer(id: number): any {
    const customer = this.customerRepo.findById(id);
    if (!customer) {
      throw new NotFoundError('Customer', id);
    }
    return customer;
  }

  /**
   * Get customer by phone
   */
  public getCustomerByPhone(phone: string): any | null {
    this._validatePhone(phone);
    return this.customerRepo.findByPhone(phone);
  }

  /**
   * Update customer details
   */
  public updateCustomer(id: number, updates: UpdateCustomerData): any {
    // 1. Check customer exists
    const customer = this.customerRepo.findById(id);
    if (!customer) {
      throw new NotFoundError('Customer', id);
    }

    // 2. Validate updates
    if (updates.name !== undefined && updates.name.trim() === '') {
      throw new ValidationError('Customer name cannot be empty', 'name');
    }

    if (updates.phone !== undefined && updates.phone !== null) {
      this._validatePhone(updates.phone);

      // Check for duplicate phone (if changing)
      if (updates.phone !== customer.phone) {
        const existingByPhone = this.customerRepo.findByPhone(updates.phone);
        if (existingByPhone && existingByPhone.id !== id) {
          throw new DuplicateEntryError('Customer', 'phone', updates.phone);
        }
      }
    }

    // 3. Update customer
    const updateInput: UpdateCustomerInput = {
      name: updates.name,
      phone: updates.phone,
      isActive: updates.isActive
    };

    const updatedCustomer = this.customerRepo.update(id, updateInput);
    
    this.logInfo('Customer updated', { 
      id: updatedCustomer.id, 
      name: updatedCustomer.name 
    });

    return updatedCustomer;
  }

  /**
   * Update customer balance (for udhaar tracking)
   * 
   * @param customerId - Customer ID
   * @param deltaAmount - Change in balance (in rupees)
   *                      Positive = customer owes more
   *                      Negative = customer paid/advance
   */
  public updateBalance(customerId: number, deltaAmount: number): void {
    // 1. Validate
    if (deltaAmount === 0) {
      throw new ValidationError('Balance change cannot be zero', 'deltaAmount');
    }

    // 2. Check customer exists and is active
    const customer = this.customerRepo.findById(customerId);
    if (!customer) {
      throw new NotFoundError('Customer', customerId);
    }

    if (!customer.isActive) {
      throw new InactiveEntityError('Customer', customerId);
    }

    // 3. Update balance
    this.customerRepo.updateBalance(customerId, deltaAmount);
    
    const newBalance = customer.balanceDue + deltaAmount;
    
    this.logInfo('Customer balance updated', {
      customerId,
      customerName: customer.name,
      deltaAmount,
      oldBalance: customer.balanceDue,
      newBalance
    });
  }

  /**
   * Get customer purchase history
   */
  public getCustomerHistory(customerId: number): CustomerHistory {
    // 1. Get customer
    const customer = this.customerRepo.findById(customerId);
    if (!customer) {
      throw new NotFoundError('Customer', customerId);
    }

    // 2. Get customer bills
    const bills = this.billRepo.findByCustomerId(customerId);

    // 3. Calculate total purchases
    const totalPurchases = bills.reduce((sum, bill) => sum + bill.grandTotal, 0);

    return {
      customer,
      bills,
      totalPurchases,
      currentBalance: customer.balanceDue
    };
  }

  /**
   * Get all active customers
   */
  public getAllCustomers(): any[] {
    return this.customerRepo.findAll();
  }

  /**
   * Search customers by name
   */
  public searchCustomers(query: string): any[] {
    if (!query || query.trim() === '') {
      throw new ValidationError('Search query cannot be empty', 'query');
    }

    const customers = this.customerRepo.searchByName(query);
    
    this.logInfo('Customers searched', { 
      query, 
      resultCount: customers.length 
    });

    return customers;
  }

  /**
   * Get customers with outstanding balance (udhaar)
   */
  public getCustomersWithBalance(): any[] {
    return this.customerRepo.getCustomersWithBalance();
  }

  /**
   * Get customers with advance payment
   */
  public getCustomersWithAdvance(): any[] {
    return this.customerRepo.getCustomersWithAdvance();
  }

  /**
   * Deactivate customer (soft delete)
   */
  public deactivateCustomer(id: number): void {
    const customer = this.customerRepo.findById(id);
    if (!customer) {
      throw new NotFoundError('Customer', id);
    }

    // Warn if customer has outstanding balance
    if (customer.balanceDue > 0) {
      this.logWarning('Deactivating customer with outstanding balance', {
        id,
        name: customer.name,
        balanceDue: customer.balanceDue
      });
    }

    this.customerRepo.delete(id);
    
    this.logInfo('Customer deactivated', { 
      id, 
      name: customer.name 
    });
  }

  /**
   * Validate customer input
   */
  private _validateCustomerInput(input: CreateOrGetCustomerInput): void {
    // Name validation
    if (!input.name || input.name.trim() === '') {
      throw new ValidationError('Customer name is required', 'name');
    }

    if (input.name.length > 200) {
      throw new ValidationError('Customer name is too long (max 200 characters)', 'name');
    }

    // Phone validation (if provided)
    if (input.phone) {
      this._validatePhone(input.phone);
    }

    // Balance validation
    if (input.balanceDue !== undefined && typeof input.balanceDue !== 'number') {
      throw new ValidationError('Balance must be a number', 'balanceDue');
    }
  }

  /**
   * Validate phone number
   */
  private _validatePhone(phone: string): void {
    if (!phone || phone.trim() === '') {
      throw new ValidationError('Phone number cannot be empty', 'phone');
    }

    // Remove spaces and special characters for validation
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

    // Check if contains only digits
    if (!/^\d+$/.test(cleanPhone)) {
      throw new ValidationError('Phone number must contain only digits', 'phone');
    }

    // Indian phone number: 10 digits
    if (cleanPhone.length !== 10) {
      throw new ValidationError('Phone number must be 10 digits', 'phone');
    }

    // Must start with 6-9 (Indian mobile numbers)
    if (!/^[6-9]/.test(cleanPhone)) {
      throw new ValidationError('Phone number must start with 6, 7, 8, or 9', 'phone');
    }
  }
}
