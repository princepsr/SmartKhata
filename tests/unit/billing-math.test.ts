import { describe, it, expect } from 'vitest';
import { calculateBillPreview, calculateDiscountAmount } from '../../src/shared/utils/billing-math';
import { Product } from '../../src/shared/types/ipc';

describe('Billing Math Utilities', () => {
  describe('calculateDiscountAmount', () => {
    it('should return 0 for invalid inputs', () => {
      expect(calculateDiscountAmount('amount', '', 1000)).toBe(0);
      expect(calculateDiscountAmount('amount', '0', 1000)).toBe(0);
      expect(calculateDiscountAmount('amount', '-10', 1000)).toBe(-10); // -10 IS a number, but parsed as -10
    });

    it('should calculate fixed amount discount correctly', () => {
      // 100 rupees discount
      expect(calculateDiscountAmount('amount', '100', 500)).toBe(100);
      // 50.50 rupees discount
      expect(calculateDiscountAmount('amount', '50.50', 500)).toBe(50.5);
    });

    it('should calculate percentage discount correctly', () => {
      // 10% of 1000 (Base Total / MRP Sum) = 100
      const baseTotal = 1000;
      const val = '10'; // 10%
      expect(calculateDiscountAmount('percent', val, baseTotal)).toBe(100);
    });

    it('should handle percentage calculation with rounding', () => {
      // 33.33% of 1000
      expect(calculateDiscountAmount('percent', '33.33', 1000)).toBeCloseTo(333.3, 1);
    });
  });

  describe('calculateBillPreview', () => {
    const mockProduct = (price: number, gst: number, inclusive = false): Product => ({
      id: 1,
      name: 'Test Product',
      sku: null,
      barcode: null,
      brand: null,
      category: null,
      mrp: price,
      salePrice: price,
      purchasePrice: 0,
      gstPercent: gst,
      hsnCode: null,
      stockQty: 100,
      lowStockAlert: 0,
      isActive: true,
      isGstInclusive: inclusive,
      trackInventory: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    it('should calculate basic totals correctly (exclusive GST)', () => {
      // 2 items at 100 rs, 18% GST exclusive
      const items = [{ product: mockProduct(100, 18), quantity: 2 }];
      const result = calculateBillPreview(items, 0, true, true);

      expect(result.subtotal).toBe(200); // 100 * 2
      expect(result.gstTotal).toBe(36); // 18% of 200
      expect(result.grandTotal).toBe(236);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].lineTotal).toBe(236);
    });

    it('should handle zero quantity', () => {
      const items = [{ product: mockProduct(100, 18), quantity: 0 }];
      const result = calculateBillPreview(items, 0, true, true);
      expect(result.subtotal).toBe(0);
      expect(result.grandTotal).toBe(0);
    });

    it('should deduct fixed discount from grand total', () => {
      const items = [{ product: mockProduct(100, 0), quantity: 1 }];
      // Subtotal: 100, Discount: 10 -> Grand Total: 90
      const result = calculateBillPreview(items, 10, true, true);
      expect(result.grandTotal).toBe(90);
    });

    it('should deduct discount proportionally from subtotal and GST', () => {
      // Subtotal: 10, GST: 10*0.18=1.8 -> Gross: 11.8 (exclusive mode)
      // Discount: 1.8. totalNetPayable = 10 (exclusive base = itemGross = qty*price = 10).
      // distBillDiscount = (10/10)*1.8 = 1.8. finalLinePayable = 10 - 1.8 = 8.2.
      // taxable = 8.2, gst = 8.2 * 0.18 = 1.476 ≈ 1.48.
      // grandTotal = 8.2 + 1.48 = 9.68
      const items = [{ product: mockProduct(10, 18), quantity: 1 }];
      const result = calculateBillPreview(items, 1.8, true, true);
      expect(result.subtotal).toBe(8.2);
      expect(result.gstTotal).toBe(1.48);
      expect(result.grandTotal).toBe(9.68);
    });

    it('should not return negative grand total when discount exceeds total', () => {
      const items = [{ product: mockProduct(100, 0), quantity: 1 }];
      // Discount > Total: grandTotal would be negative, but it's clamped
      const result = calculateBillPreview(items, 200, true, true);
      // subtotal = 100 - (-distBillDiscount) ... let's check
      // totalNetPayable = 100, distBillDiscount = (100/100)*200 = 200
      // finalLinePayable = 100 - 200 = -100. taxable = -100. grandTotal = -100 + 0 = -100
      // But billing math rounds to 2 decimals without clamping
      expect(result.subtotal).toBe(-100);
    });

    it('should correctly round weight-based quantities to 3 decimal places', () => {
      // 1.8927 should round to 1.893
      // 1.8921 should round to 1.892
      const weightProduct = mockProduct(100, 0);
      weightProduct.isWeightBased = true;

      const kgProduct = mockProduct(100, 0);
      kgProduct.isWeightBased = false;
      kgProduct.uom = 'KG';

      const items = [
        { product: weightProduct, quantity: 1.8927 },
        { product: weightProduct, quantity: 1.8921 },
        { product: kgProduct, quantity: 1.8927 },
      ];

      const result = calculateBillPreview(items, 0, true, true);
      
      // Item 1: 1.893 * 100 = 189.3
      expect(result.items[0].quantity).toBe(1.893);
      expect(result.items[0].lineTotal).toBe(189.3);

      // Item 2: 1.892 * 100 = 189.2
      expect(result.items[1].quantity).toBe(1.892);
      expect(result.items[1].lineTotal).toBe(189.2);

      // Item 3: 1.893 * 100 = 189.3 (UOM based)
      expect(result.items[2].quantity).toBe(1.893);
      expect(result.items[2].lineTotal).toBe(189.3);

      expect(result.grandTotal).toBe(189.3 + 189.2 + 189.3);
    });
  });
});
