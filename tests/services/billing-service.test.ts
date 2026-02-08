/**
 * BillingService Tests
 * 
 * Tests for billing calculations, validation, and transaction handling.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BillingService } from '../../src/main/services/billing-service';
import { ProductRepository } from '../../src/main/repositories/product-repository';
import { CustomerRepository } from '../../src/main/repositories/customer-repository';
import { BillRepository } from '../../src/main/repositories/bill-repository';
import { createTestDatabase, resetTestDatabase, seedTestData } from '../utils/test-db';
import { ValidationError, InsufficientStockError, DuplicateEntryError } from '../../src/main/services/errors/service-errors';
import type Database from 'better-sqlite3';

describe('BillingService - Calculations', () => {
  let db: Database.Database;
  let billingService: BillingService;
  let productRepo: ProductRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    billingService = new BillingService();
    productRepo = new ProductRepository();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  it('should calculate line totals correctly', () => {
    const calculation = billingService.calculateBill([
      { productId: 1, quantity: 2 }
    ], 0);

    expect(calculation.items[0].lineSubtotal).toBe(80); // 40 * 2
    expect(calculation.items[0].lineGst).toBe(14.4);    // 80 * 0.18
    expect(calculation.items[0].lineTotal).toBe(94.4);  // 80 + 14.4
  });

  it('should calculate bill totals correctly', () => {
    const calculation = billingService.calculateBill([
      { productId: 1, quantity: 2 }, // Coca Cola: 80 + 14.4 = 94.4
      { productId: 2, quantity: 3 }  // Lays: 60 + 7.2 = 67.2
    ], 0);

    expect(calculation.subtotal).toBe(140);     // 80 + 60
    expect(calculation.gstTotal).toBe(21.6);    // 14.4 + 7.2
    expect(calculation.grandTotal).toBe(161.6); // 140 + 21.6
  });

  it('should apply discount correctly', () => {
    const calculation = billingService.calculateBill([
      { productId: 1, quantity: 2 }
    ], 10);

    expect(calculation.subtotal).toBe(80);
    expect(calculation.gstTotal).toBe(14.4);
    expect(calculation.discountAmount).toBe(10);
    expect(calculation.grandTotal).toBe(84.4); // 80 + 14.4 - 10
  });

  it('should throw error if discount makes grand total negative', () => {
    expect(() => {
      billingService.calculateBill([
        { productId: 1, quantity: 1 } // Total: 47.2
      ], 100); // Discount: 100
    }).toThrow(ValidationError);
  });

  it('should handle multiple items with different GST rates', () => {
    const calculation = billingService.calculateBill([
      { productId: 1, quantity: 1 }, // 18% GST
      { productId: 3, quantity: 1 }  // 0% GST (milk)
    ], 0);

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
      billingService.calculateBill([
        { productId: 1, quantity: 1 }
      ], -10);
    }).toThrow(ValidationError);
  });
});

describe('BillingService - Finalize Bill', () => {
  let db: Database.Database;
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
        { productId: 2, quantity: 1 }
      ],
      paymentMode: 'cash'
    });

    expect(result.bill.billNumber).toBe('BILL-001');
    expect(result.bill.grandTotal).toBe(116.8); // 80 + 14.4 (coke) + 20 + 2.4 (chips)
    expect(result.items).toHaveLength(2);
  });

  it('should deduct stock on bill creation', () => {
    const initialStock = productRepo.findById(1)!.stockQty;

    billingService.finalizeBill({
      billNumber: 'BILL-001',
      items: [{ productId: 1, quantity: 5 }],
      paymentMode: 'cash'
    });

    const finalStock = productRepo.findById(1)!.stockQty;
    expect(finalStock).toBe(initialStock - 5);
  });

  it('should throw error on insufficient stock', () => {
    expect(() => {
      billingService.finalizeBill({
        billNumber: 'BILL-001',
        items: [{ productId: 1, quantity: 200 }], // More than available
        paymentMode: 'cash'
      });
    }).toThrow(InsufficientStockError);
  });

  it('should throw error on duplicate bill number', () => {
    billingService.finalizeBill({
      billNumber: 'BILL-001',
      items: [{ productId: 1, quantity: 1 }],
      paymentMode: 'cash'
    });

    expect(() => {
      billingService.finalizeBill({
        billNumber: 'BILL-001', // Duplicate
        items: [{ productId: 1, quantity: 1 }],
        paymentMode: 'cash'
      });
    }).toThrow(DuplicateEntryError);
  });

  it('should rollback on error', () => {
    const initialStock = productRepo.findById(1)!.stockQty;

    expect(() => {
      billingService.finalizeBill({
        billNumber: 'BILL-001',
        items: [
          { productId: 1, quantity: 5 },   // OK
          { productId: 2, quantity: 100 }  // Insufficient!
        ],
        paymentMode: 'cash'
      });
    }).toThrow(InsufficientStockError);

    // Verify stock unchanged (rollback)
    expect(productRepo.findById(1)!.stockQty).toBe(initialStock);

    // Verify no bill created
    const bill = billRepo.findByBillNumber('BILL-001');
    expect(bill).toBeNull();
  });

  it('should update customer balance on credit sale', () => {
    const customerRepo = new CustomerRepository();
    const initialBalance = customerRepo.findById(1)!.balanceDue;

    billingService.finalizeBill({
      billNumber: 'BILL-001',
      customerId: 1,
      items: [{ productId: 1, quantity: 2 }], // Total: 94.4
      paymentMode: 'cash',
      paymentReceived: 50 // Paid 50, owes 44.4
    });

    const finalBalance = customerRepo.findById(1)!.balanceDue;
    expect(finalBalance).toBe(initialBalance + 44.4);
  });

  it('should generate bill number correctly', () => {
    const billNumber = billingService.generateBillNumber();
    
    expect(billNumber).toMatch(/^BILL-\d{8}-\d{4}$/);
    expect(billNumber).toContain('BILL-20260208'); // Today's date
  });
});
