/**
 * BillingTransactionService Tests
 *
 * Verifies atomic sales transactions, rollbacks, and data consistency.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BillingTransactionService } from '../../src/main/services/billing-transaction-service';
import { ProductRepository } from '../../src/main/repositories/product-repository';
import { CustomerRepository } from '../../src/main/repositories/customer-repository';
import { BillRepository } from '../../src/main/repositories/bill-repository';
import { InventoryRepository } from '../../src/main/repositories/inventory-repository';
import { SettingsService } from '../../src/main/services/settings-service';
import {
  createTestDatabase,
  resetTestDatabase,
  seedTestData,
  type BetterSqliteCompatibleDatabase,
} from '../utils/test-db';
import {
  InsufficientStockError,
  NotFoundError,
} from '../../src/main/services/errors/service-errors';

describe('BillingTransactionService - Atomic Sales', () => {
  let db: BetterSqliteCompatibleDatabase;
  let transactionService: BillingTransactionService;
  let productRepo: ProductRepository;
  let customerRepo: CustomerRepository;
  let billRepo: BillRepository;
  let inventoryRepo: InventoryRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    // Reload cache to ensure settings are fresh
    SettingsService.getInstance().reloadCache();

    transactionService = new BillingTransactionService();
    productRepo = new ProductRepository();
    customerRepo = new CustomerRepository();
    billRepo = new BillRepository();
    inventoryRepo = new InventoryRepository();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  it('should complete a complex sale atomically', () => {
    // Product 1: Coke (40, 5% Excl) -> Gross 42
    // Product 2: Lays (20, 12% Excl) -> Gross 22.4
    // Buy 1 each. Total Gross = 64.4. Discount = 4.4. Net = 60.0
    // Proportional Factor = 60 / 64.4 = 0.9316...
    // P1 Net Gross = 42 * Factor = 39.13. Net Sub = 39.13/1.05 = 37.27. Net GST = 1.86
    // P2 Net Gross = 22.4 * Factor = 20.87. Net Sub = 20.87/1.12 = 18.63. Net GST = 2.24
    // Total Sub = 37.27 + 18.63 = 55.90. Total GST = 1.86 + 2.24 = 4.10. GrandTotal = 60.0

    const saleData = {
      billNumber: 'ATOM-001',
      customerId: 1, // Ramesh (Balance 0)
      items: [
        { productId: 1, quantity: 1 },
        { productId: 2, quantity: 1 },
      ],
      paymentMode: 'cash' as const,
      paymentReceived: 50, // Paid 50, owes 10
      discountAmount: 4.4,
    };

    const result = transactionService.createSale(saleData);

    // 1. Verify Bill
    expect(result.bill.grandTotal).toBe(60);
    expect(result.bill.subtotal).toBeCloseTo(55.9, 1);
    expect(result.bill.gstTotal).toBeCloseTo(4.1, 1);

    // 2. Verify Stock Deducted
    expect(productRepo.findById(1)?.stockQty).toBe(99);
    expect(productRepo.findById(2)?.stockQty).toBe(49);

    // 3. Verify Inventory Logs
    const history1 = inventoryRepo.getStockHistory(1);
    expect(history1.some((log) => log.referenceId === result.bill.id)).toBe(true);

    // 4. Verify Customer Balance & Ledger
    const customer = customerRepo.findById(1);
    expect(customer?.balanceDue).toBe(10); // 60 - 50

    const ledger = customerRepo.getLedgerByCustomerId(1);
    // Should have SALE (60) and PAYMENT_IN (50)
    expect(ledger.some((l) => l.type === 'SALE' && l.amount === 60)).toBe(true);
    expect(ledger.some((l) => l.type === 'PAYMENT_IN' && l.amount === 50)).toBe(true);
  });

  it('should rollback EVERYTHING if stock is insufficient', () => {
    const initialProduct1 = productRepo.findById(1);
    const initialCustomer = customerRepo.findById(1);
    const initialBillCount = db.prepare('SELECT COUNT(*) as count FROM bills').get() as {
      count: number;
    };

    const saleData = {
      billNumber: 'FAIL-001',
      customerId: 1,
      items: [
        { productId: 1, quantity: 5 }, // Valid
        { productId: 2, quantity: 500 }, // INSUFFICIENT
      ],
      paymentMode: 'cash' as const,
    };

    expect(() => {
      transactionService.createSale(saleData);
    }).toThrow(InsufficientStockError);

    // Verify Rollbacks
    // 1. No bill created
    const billsAfter = db.prepare('SELECT COUNT(*) as count FROM bills').get() as { count: number };
    expect(billsAfter.count).toBe(0);

    // 2. Stock not changed for Product 1
    const finalProduct1 = productRepo.findById(1);
    expect(finalProduct1?.stockQty).toBe(initialProduct1?.stockQty);

    // 3. Customer balance not changed
    const finalCustomer = customerRepo.findById(1);
    expect(finalCustomer?.balanceDue).toBe(initialCustomer?.balanceDue);

    // 4. No ledger entries added
    const ledgerCount = db
      .prepare('SELECT COUNT(*) as count FROM customer_ledger WHERE customer_id = 1')
      .get() as { count: number };
    // Assuming seed data has some or starts at 0. Ramesh seed usually has 0.
    expect(ledgerCount.count).toBe(0);
  });

  it('should rollback if product is not found', () => {
    const saleData = {
      billNumber: 'FAIL-002',
      items: [{ productId: 999, quantity: 1 }],
      paymentMode: 'cash' as const,
    };

    expect(() => {
      transactionService.createSale(saleData);
    }).toThrow(NotFoundError);

    const bills = db.prepare('SELECT COUNT(*) as count FROM bills').get() as { count: number };
    expect(bills.count).toBe(0);
  });
});
