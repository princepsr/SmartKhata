import { describe, it, expect } from 'vitest';
import {
  calculateBillPreview,
  calculateDiscountAmount,
} from '../../src/renderer/utils/billing-math';

describe('Billing Math Utilities', () => {
  describe('calculateDiscountAmount', () => {
    it('should return 0 for invalid inputs', () => {
      expect(calculateDiscountAmount('amount', '', 1000, 0)).toBe(0);
      expect(calculateDiscountAmount('amount', '0', 1000, 0)).toBe(0);
      expect(calculateDiscountAmount('amount', '-10', 1000, 0)).toBe(0);
    });

    it('should calculate fixed amount discount correctly', () => {
      // 100 rupees discount -> 10000 paisa
      expect(calculateDiscountAmount('amount', '100', 50000, 0)).toBe(10000);
      // 50.50 rupees discount -> 5050 paisa
      expect(calculateDiscountAmount('amount', '50.50', 50000, 0)).toBe(5050);
    });

    it('should calculate percentage discount correctly', () => {
      // 10% of 1000 (subtotal) + 180 (gst) = 1180 -> 118 discount
      const subtotal = 1000;
      const gst = 180;
      const val = '10'; // 10%
      expect(calculateDiscountAmount('percent', val, subtotal, gst)).toBe(118);
    });

    it('should handle percentage calculation with rounding', () => {
      // 33.33% of 1000
      expect(calculateDiscountAmount('percent', '33.33', 1000, 0)).toBe(333);
    });
  });

  describe('calculateBillPreview', () => {
    const mockProduct = (price: number, gst: number) => ({
      id: 1,
      name: 'Test Product',
      description: '',
      salePrice: price, // in paisa
      costPrice: 0,
      stockQty: 100,
      gstPercent: gst,
      category: 'Test',
      unit: 'pcs',
      minStockData: 0,
      isActive: true,
      lastUpdated: new Date(),
    });

    it('should calculate basic totals correctly', () => {
      // 1 item, 100 rs (10000 paisa), 18% GST
      const items = [{ product: mockProduct(10000, 18), quantity: 2 }];
      const result = calculateBillPreview(items, 0);

      expect(result.subtotal).toBe(20000); // 100 * 2
      expect(result.gstTotal).toBe(3600); // 18% of 20000
      expect(result.grandTotal).toBe(23600);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].lineTotal).toBe(23600);
    });

    it('should handle zero quantity', () => {
      const items = [{ product: mockProduct(10000, 18), quantity: 0 }];
      const result = calculateBillPreview(items, 0);
      expect(result.subtotal).toBe(0);
      expect(result.grandTotal).toBe(0);
    });

    it('should deduct fixed discount from grand total', () => {
      const items = [{ product: mockProduct(10000, 0), quantity: 1 }];
      // Subtotal: 10000, Discount: 1000 -> Grand Total: 9000
      const result = calculateBillPreview(items, 1000);
      expect(result.grandTotal).toBe(9000);
    });

    it('should deduct discount after GST addition', () => {
      // Subtotal: 1000, GST: 180 -> Total: 1180
      // Discount: 180 -> Grand Total: 1000
      const items = [{ product: mockProduct(1000, 18), quantity: 1 }];
      const result = calculateBillPreview(items, 180);
      expect(result.subtotal).toBe(1000);
      expect(result.gstTotal).toBe(180);
      expect(result.grandTotal).toBe(1000);
    });

    it('should not return negative grand total', () => {
      const items = [{ product: mockProduct(100, 0), quantity: 1 }];
      // Discount > Total
      const result = calculateBillPreview(items, 200);
      expect(result.grandTotal).toBe(0);
    });
  });
});
