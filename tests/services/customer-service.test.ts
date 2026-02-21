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

  it('should search customers by name', () => {
    const results = customerService.searchCustomers('Ramesh');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain('Ramesh');
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
    expect(results).toHaveLength(0);

    const allResults = customerService.searchCustomers('Ramesh', true);
    expect(allResults).toHaveLength(1);
    expect(allResults[0].isActive).toBeFalsy();

    const activeList = customerService.getAllCustomers(false);
    expect(activeList.find((c) => c.id === 1)).toBeUndefined();

    const allList = customerService.getAllCustomers(true);
    expect(allList.find((c) => c.id === 1)).toBeDefined();
  });
});
