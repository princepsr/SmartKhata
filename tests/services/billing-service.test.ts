/**
 * BillingService Tests
 *
 * Tests for billing calculations, validation, and transaction handling.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BillingService } from '@main/services/billing-service';
import { ProductRepository } from '@main/repositories/product-repository';
import { CustomerRepository } from '@main/repositories/customer-repository';
import { BillRepository } from '@main/repositories/bill-repository';
import { SettingsService } from '@main/services/settings-service';
import {
  createTestDatabase,
  resetTestDatabase,
  seedTestData,
  type BetterSqliteCompatibleDatabase,
} from '../utils/test-db';
import {
  ValidationError,
  InsufficientStockError,
  DuplicateEntryError,
} from '@main/services/errors/service-errors';

describe('BillingService - Calculations', () => {
  let db: BetterSqliteCompatibleDatabase;
  let billingService: BillingService;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    SettingsService.getInstance().reloadCache();
    billingService = new BillingService();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  it('should calculate line totals correctly', () => {
    const calculation = billingService.calculateBill([{ productId: 1, quantity: 2 }], 0);

    expect(calculation.items[0].lineSubtotal).toBe(80); // 40 * 2
    expect(calculation.items[0].lineGst).toBe(14.4); // 80 * 0.18
    expect(calculation.items[0].lineTotal).toBe(94.4); // 80 + 14.4
  });

  it('should calculate inclusive GST correctly (MRP logic)', () => {
    // Product ID 5 is 'MRP Product' with salePrice 105 and 5% GST inclusive
    const calculation = billingService.calculateBill([{ productId: 5, quantity: 1 }], 0);

    expect(calculation.items[0].lineTotal).toBe(105);
    expect(calculation.items[0].lineSubtotal).toBe(100); // 105 / 1.05
    expect(calculation.items[0].lineGst).toBe(5);

    expect(calculation.grandTotal).toBe(105);
    expect(calculation.subtotal).toBe(100);
    expect(calculation.gstTotal).toBe(5);
  });

  it('should calculate bill totals correctly', () => {
    const calculation = billingService.calculateBill(
      [
        { productId: 1, quantity: 2 }, // Coca Cola: 80 + 14.4 = 94.4
        { productId: 2, quantity: 3 }, // Lays: 60 + 7.2 = 67.2
      ],
      0
    );

    expect(calculation.subtotal).toBe(140); // 80 + 60
    expect(calculation.gstTotal).toBe(21.6); // 14.4 + 7.2
    expect(calculation.grandTotal).toBe(161.6); // 140 + 21.6
  });

  it('should apply discount correctly', () => {
    const calculation = billingService.calculateBill([{ productId: 1, quantity: 2 }], 10);

    expect(calculation.subtotal).toBe(80);
    expect(calculation.gstTotal).toBe(14.4);
    expect(calculation.discountAmount).toBe(10);
    expect(calculation.grandTotal).toBe(84.4); // 80 + 14.4 - 10
  });

  it('should throw error if discount makes grand total negative', () => {
    expect(() => {
      billingService.calculateBill(
        [
          { productId: 1, quantity: 1 }, // Total: 47.2
        ],
        100
      ); // Discount: 100
    }).toThrow(ValidationError);
  });

  it('should handle multiple items with different GST rates', () => {
    const calculation = billingService.calculateBill(
      [
        { productId: 1, quantity: 1 }, // 18% GST
        { productId: 3, quantity: 1 }, // 0% GST (milk)
      ],
      0
    );

    expect(calculation.items[0].gstPercent).toBe(18);
    expect(calculation.items[1].gstPercent).toBe(0);
    expect(calculation.gstTotal).toBe(7.2); // Only from Coca Cola
  });

  it('should throw error for empty items', () => {
    expect(() => {
      billingService.calculateBill([], 0);
    }).toThrow(ValidationError);
  });

  it('should throw error for negative discount', () => {
    expect(() => {
      billingService.calculateBill([{ productId: 1, quantity: 1 }], -10);
    }).toThrow(ValidationError);
  });
  it('should not calculate GST when gstEnabled is false', () => {
    // Set setting to false
    const settingsService = SettingsService.getInstance();
    settingsService.updateConfig({ gstEnabled: false });

    // 1. Check Calculation Preview
    const calculation = billingService.calculateBill([{ productId: 1, quantity: 2 }], 0);
    expect(calculation.gstTotal).toBe(0);
    expect(calculation.grandTotal).toBe(80); // Subtotal only
    expect(calculation.items[0].lineGst).toBe(0);

    // 2. Check Finalization (BillingTransactionService)
    const result = billingService.finalizeBill({
      billNumber: 'BILL-NOGST',
      items: [{ productId: 1, quantity: 2 }],
      paymentMode: 'cash',
    });

    expect(result.bill.gstTotal).toBe(0);
    expect(result.bill.grandTotal).toBe(80);

    // Reset setting for other tests
    settingsService.updateConfig({ gstEnabled: true });
  });
});

describe('BillingService - Finalize Bill', () => {
  let db: BetterSqliteCompatibleDatabase;
  let billingService: BillingService;
  let productRepo: ProductRepository;
  let billRepo: BillRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    billingService = new BillingService();
    productRepo = new ProductRepository();
    billRepo = new BillRepository();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  it('should create bill successfully', () => {
    const result = billingService.finalizeBill({
      billNumber: 'BILL-001',
      items: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
      ],
      paymentMode: 'cash',
    });

    expect(result.bill.billNumber).toBe('BILL-001');
    expect(result.bill.grandTotal).toBe(116.8); // 80 + 14.4 (coke) + 20 + 2.4 (chips)
    expect(result.items).toHaveLength(2);
  });

  it('should deduct stock on bill creation', () => {
    const product = productRepo.findById(1);
    expect(product).toBeDefined();
    const initialStock = product?.stockQty || 0;

    billingService.finalizeBill({
      billNumber: 'BILL-001',
      items: [{ productId: 1, quantity: 5 }],
      paymentMode: 'cash',
    });

    const finalProduct = productRepo.findById(1);
    expect(finalProduct).toBeDefined();
    const finalStock = finalProduct?.stockQty || 0;
    expect(finalStock).toBe(initialStock - 5);
  });

  it('should throw error on insufficient stock', () => {
    try {
      billingService.finalizeBill({
        billNumber: 'BILL-001',
        items: [{ productId: 1, quantity: 200 }], // More than available
        paymentMode: 'cash',
      });
      throw new Error('Should have thrown InsufficientStockError');
    } catch (err: any) {
      expect(err.code || err.name).toMatch(/INSUFFICIENT_STOCK|InsufficientStockError/);
    }
  });

  it('should throw error on duplicate bill number', () => {
    billingService.finalizeBill({
      billNumber: 'BILL-001',
      items: [{ productId: 1, quantity: 1 }],
      paymentMode: 'cash',
    });

    expect(() => {
      billingService.finalizeBill({
        billNumber: 'BILL-001', // Duplicate
        items: [{ productId: 1, quantity: 1 }],
        paymentMode: 'cash',
      });
    }).toThrow(DuplicateEntryError);
  });

  it('should rollback on error', () => {
    const product = productRepo.findById(1);
    expect(product).toBeDefined();
    const initialStock = product?.stockQty || 0;

    try {
      billingService.finalizeBill({
        billNumber: 'BILL-001',
        items: [
          { productId: 1, quantity: 5 }, // OK
          { productId: 2, quantity: 100 }, // Insufficient!
        ],
        paymentMode: 'cash',
      });
      throw new Error('Should have thrown InsufficientStockError');
    } catch (err: any) {
      // Check code or message as instanceof might fail with Vitest module resolution
      expect(err.code || err.name).toMatch(/INSUFFICIENT_STOCK|InsufficientStockError/);
    }

    // Verify stock unchanged (rollback)
    const currentProduct = productRepo.findById(1);
    expect(currentProduct?.stockQty).toBe(initialStock);

    // Verify no bill created
    const bill = billRepo.findByBillNumber('BILL-001');
    expect(bill).toBeNull();
  });

  it('should update customer balance on credit sale', () => {
    const customerRepo = new CustomerRepository();
    const customer = customerRepo.findById(1);
    expect(customer).toBeDefined();
    const initialBalance = customer?.balanceDue || 0;

    billingService.finalizeBill({
      billNumber: 'BILL-001',
      customerId: 1,
      items: [{ productId: 1, quantity: 2 }], // Total: 94.4
      paymentMode: 'cash',
      paymentReceived: 50, // Paid 50, owes 44.4
    });

    const finalCustomer = customerRepo.findById(1);
    const finalBalance = finalCustomer?.balanceDue || 0;
    expect(finalBalance).toBe(initialBalance + 44.4);
  });

  it('should generate bill number correctly', () => {
    const billNumber = billingService.generateBillNumber();
    const now = new Date();
    const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

    expect(billNumber).toMatch(/^BILL-\d{8}-\d{4}$/);
    expect(billNumber).toContain(`BILL-${today}`);
  });

  it('should respect inclusive GST (MRP) during finalization', () => {
    // Product ID 5 is 'MRP Product' with salePrice 105 and 5% GST inclusive
    const result = billingService.finalizeBill({
      billNumber: 'BILL-MRP-FINAL',
      items: [{ productId: 5, quantity: 2 }], // Total: 210
      paymentMode: 'cash',
    });

    expect(result.bill.subtotal).toBe(200); // 210 / 1.05
    expect(result.bill.gstTotal).toBe(10);
    expect(result.bill.grandTotal).toBe(210);
  });

  it('should override product setting when gstExclusiveMode is true', () => {
    // Set master switch to true
    const settingsService = SettingsService.getInstance();
    settingsService.updateConfig({ gstExclusiveMode: true, gstEnabled: true });

    // Product 5 is normally Inclusive (105 / 1.05 = 100 subtotal)
    // If master switch is ON, it becomes Exclusive (105 + 5% = 110.25)
    const calculation = billingService.calculateBill([{ productId: 5, quantity: 1 }], 0);

    expect(calculation.items[0].lineSubtotal).toBe(105);
    expect(calculation.items[0].lineGst).toBe(5.25);
    expect(calculation.grandTotal).toBe(110.25);

    // Reset settings for other tests
    settingsService.updateConfig({ gstExclusiveMode: false });
  });
});
