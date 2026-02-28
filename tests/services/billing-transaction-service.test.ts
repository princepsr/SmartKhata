/**
 * BillingTransactionService Tests
 *
 * Verifies atomic sales transactions, rollbacks, and data consistency.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BillingTransactionService } from '../../src/main/services/billing-transaction-service';
import { ProductRepository } from '../../src/main/repositories/product-repository';
import { CustomerRepository } from '../../src/main/repositories/customer-repository';
import { SettingsService } from '../../src/main/services/settings-service';
import {
  createTestDatabase,
  resetTestDatabase,
  seedTestData,
  type BetterSqliteCompatibleDatabase,
} from '../utils/test-db';

describe('BillingTransactionService - Atomic Sales', () => {
  let db: BetterSqliteCompatibleDatabase;
  let transactionService: BillingTransactionService;
  let productRepo: ProductRepository;
  let customerRepo: CustomerRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    SettingsService.getInstance().reloadCache();

    transactionService = new BillingTransactionService();
    productRepo = new ProductRepository();
    customerRepo = new CustomerRepository();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  it('should complete a complex sale atomically', async () => {
    // Product 1: Coke (40, gstExclusiveMode=false = inclusive) -> total 40 per unit
    // 1 Coke + 1 Lays = (40 + 20 = 60 grandTotal with inclusive)
    // paymentReceived: 40, owes 20
    const saleData = {
      billNumber: 'ATOM-001',
      customerId: 1, // Ramesh (Balance 0)
      items: [
        { productId: 1, quantity: 1 },
        { productId: 2, quantity: 1 },
      ],
      paymentMode: 'cash' as const,
      paymentReceived: 40,
    };

    const result = await transactionService.createSale(saleData);

    // 1. Verify Bill was created
    expect(result.id).toBeGreaterThan(0);
    expect(result.billNumber).toMatch(/^BILL-\d{8}-\d{3}$/);

    // 2. Verify Stock Deducted
    expect(productRepo.findById(1)?.stockQty).toBe(99);
    expect(productRepo.findById(2)?.stockQty).toBe(49);

    // 3. Verify bill exists in DB
    const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(result.id) as any;
    expect(bill).toBeDefined();

    // 4. Verify Customer Balance (inclusive: 40+20=60, paid 40, owes 20)
    const customer = customerRepo.findById(1);
    expect(customer?.balanceDue).toBe(20);
  });

  it('should rollback EVERYTHING if stock is insufficient', async () => {
    const initialProduct1 = productRepo.findById(1);
    const initialCustomer = customerRepo.findById(1);

    const saleData = {
      billNumber: 'FAIL-001',
      customerId: 1,
      items: [
        { productId: 1, quantity: 5 }, // Valid
        { productId: 2, quantity: 500 }, // INSUFFICIENT
      ],
      paymentMode: 'cash' as const,
    };

    let caughtError: any = null;
    try {
      await transactionService.createSale(saleData);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
    // Check error type by code or name (more resilient than instanceof across module boundaries)
    expect(
      caughtError?.code === 'INSUFFICIENT_STOCK' ||
        caughtError?.name === 'InsufficientStockError' ||
        (caughtError?.message || '').match(/Insufficient/i)
    ).toBeTruthy();

    // Verify Rollbacks
    const billsAfter = db.prepare('SELECT COUNT(*) as count FROM bills').get() as { count: number };
    expect(billsAfter.count).toBe(0);

    const finalProduct1 = productRepo.findById(1);
    expect(finalProduct1?.stockQty).toBe(initialProduct1?.stockQty);

    const finalCustomer = customerRepo.findById(1);
    expect(finalCustomer?.balanceDue).toBe(initialCustomer?.balanceDue);
  });

  it('should rollback if product is not found', async () => {
    const saleData = {
      billNumber: 'FAIL-002',
      items: [{ productId: 999, quantity: 1 }],
      paymentMode: 'cash' as const,
    };

    let caughtError: any = null;
    try {
      await transactionService.createSale(saleData);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
    expect(
      caughtError?.code === 'NOT_FOUND' ||
        caughtError?.name === 'NotFoundError' ||
        (caughtError?.message || '').match(/not found/i)
    ).toBeTruthy();

    const bills = db.prepare('SELECT COUNT(*) as count FROM bills').get() as { count: number };
    expect(bills.count).toBe(0);
  });
});
