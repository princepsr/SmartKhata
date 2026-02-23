/**
 * CustomerService Tests
 *
 * Tests for customer management and balance tracking.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CustomerService } from '../../src/main/services/customer-service';
import { CustomerRepository } from '../../src/main/repositories/customer-repository';
import { createTestDatabase, resetTestDatabase, seedTestData } from '../utils/test-db';
import {
  ValidationError,
  InactiveEntityError,
} from '../../src/main/services/errors/service-errors';
import type Database from 'better-sqlite3';

describe('CustomerService - Create Customer', () => {
  let db: Database.Database;
  let customerService: CustomerService;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    customerService = new CustomerService();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  it('should create new customer', () => {
    const customer = customerService.createOrGetCustomer({
      name: 'New Customer',
      phone: '9999999999',
    });

    expect(customer.name).toBe('New Customer');
    expect(customer.phone).toBe('9999999999');
    expect(customer.balanceDue).toBe(0);
  });

  it('should create customer with extended profile (email, address)', () => {
    const customer = customerService.createOrGetCustomer({
      name: 'Modern Customer',
      phone: '8888888888',
      email: 'modern@example.com',
      address: '123 Tech Lane, Bangalore',
    });

    expect(customer.email).toBe('modern@example.com');
    expect(customer.address).toBe('123 Tech Lane, Bangalore');
  });

  it('should return existing customer by phone', () => {
    const customer = customerService.createOrGetCustomer({
      name: 'Different Name',
      phone: '9876543210', // Existing phone
    });

    expect(customer.name).toBe('Ramesh Kumar'); // Original name
    expect(customer.phone).toBe('9876543210');
  });

  it('should throw error for invalid phone', () => {
    expect(() => {
      customerService.createOrGetCustomer({
        name: 'Test Customer',
        phone: '123', // Invalid
      });
    }).toThrow(ValidationError);
  });

  it('should throw error for phone not starting with 6-9', () => {
    expect(() => {
      customerService.createOrGetCustomer({
        name: 'Test Customer',
        phone: '5876543210', // Starts with 5
      });
    }).toThrow(ValidationError);
  });
});

describe('CustomerService - Balance Management', () => {
  let db: Database.Database;
  let customerService: CustomerService;
  let customerRepo: CustomerRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    customerService = new CustomerService();
    customerRepo = new CustomerRepository();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  it('should increase balance on credit', () => {
    const customer = customerRepo.findById(1);
    expect(customer).toBeDefined();
    const initialBalance = customer?.balanceDue ?? 0;

    customerService.updateBalance(1, 500);

    const updatedCustomer = customerRepo.findById(1);
    expect(updatedCustomer?.balanceDue).toBe(initialBalance + 500);
  });

  it('should decrease balance on payment', () => {
    customerService.updateBalance(1, 5); // Credit
    customerService.updateBalance(1, -2); // Payment

    const customer = customerRepo.findById(1);
    expect(customer?.balanceDue).toBe(3);
  });

  it('should allow negative balance (advance)', () => {
    customerService.updateBalance(1, -1);

    const customer = customerRepo.findById(1);
    expect(customer?.balanceDue).toBe(-1); // Advance
  });

  it('should atomically create ledger entry on balance update', () => {
    // Initial balance is 0 for Ramesh (ID 1)
    customerService.updateBalance(1, 1500, undefined, 'SALE', 'New Sale');

    const customer = customerRepo.findById(1);
    expect(customer?.balanceDue).toBe(1500);

    // Verify ledger entry
    const ledger = (db as any)
      .prepare('SELECT * FROM customer_ledger WHERE customer_id = ?')
      .get(1);
    expect(ledger).toBeDefined();
    expect(ledger.amount).toBe(1500);
    expect(ledger.type).toBe('SALE');
    expect(ledger.notes).toBe('New Sale');
  });

  it('should retrieve ledger history correctly ordered', () => {
    customerService.updateBalance(1, 1000, undefined, 'SALE', 'Sale 1');
    customerService.updateBalance(1, -400, undefined, 'PAYMENT_IN', 'Cash Payment');
    customerService.updateBalance(1, 500, undefined, 'SALE', 'Sale 2');

    const history = customerService.getCustomerHistory(1).ledger;
    expect(history).toHaveLength(3);

    // Ordered by CreatedAt DESC
    expect(history[0].amount).toBe(500);
    expect(history[1].amount).toBe(400); // Ledger amount is absolute
    expect(history[2].amount).toBe(1000);
  });

  it('should throw error on zero change', () => {
    expect(() => {
      customerService.updateBalance(1, 0);
    }).toThrow(ValidationError);
  });

  it('should throw error for inactive customer', () => {
    expect(() => {
      customerService.updateBalance(3, 100); // Inactive customer
    }).toThrow(InactiveEntityError);
  });
});

describe('CustomerService - Search and Query', () => {
  let db: Database.Database;
  let customerService: CustomerService;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    customerService = new CustomerService();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  it('should list all customers', () => {
    const result = customerService.getAllCustomers();
    expect(result.items.length).toBeGreaterThanOrEqual(2);
    expect(result.items[0].name).toBeDefined();
  });

  it('should get customer by phone', () => {
    const customer = customerService.getCustomerByPhone('9876543210');

    expect(customer).toBeDefined();
    expect(customer?.name).toBe('Ramesh Kumar');
  });

  it('should get customers with balance', () => {
    const customers = customerService.getCustomersWithBalance();

    expect(customers.length).toBeGreaterThan(0);
    expect(customers[0].balanceDue).toBeGreaterThan(0);
  });

  it('should deactivate customer and exclude from default results', () => {
    customerService.deactivateCustomer(1);

    const results = customerService.searchCustomers('Ramesh');
    expect(results.items).toHaveLength(0);

    const allResults = customerService.searchCustomers('Ramesh', true);
    expect(allResults.items).toHaveLength(1);
    expect(allResults.items[0].isActive).toBeFalsy();

    const activeList = customerService.getAllCustomers(false);
    expect(activeList.items.find((c) => c.id === 1)).toBeUndefined();

    const allList = customerService.getAllCustomers(true);
    expect(allList.items.find((c) => c.id === 1)).toBeDefined();
  });

  it('should search customers', () => {
    const result = customerService.searchCustomers('Ramesh');
    expect(result.items.length).toBe(1);
    expect(result.items[0].name).toBe('Ramesh Kumar');

    const noResult = customerService.searchCustomers('NonExistent');
    expect(noResult.items.length).toBe(0);
  });
});
