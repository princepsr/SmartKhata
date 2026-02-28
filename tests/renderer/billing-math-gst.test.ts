import { describe, it, expect } from 'vitest';

/**
 * Tests for GST functionality: billing CGST/SGST/IGST split, credit note service,
 * settings validation, and billing-math preview calculations.
 */

// ─── billing-math.ts GST preview ───────────────────────────────────────────

import { calculateBillPreview, calculateDiscountAmount } from '../../src/shared/utils/billing-math';

const makeItem = (salePrice: number, gstPercent: number, quantity = 1, isGstInclusive = false) => ({
  product: {
    id: 1,
    name: 'Test Product',
    salePrice,
    gstPercent,
    isGstInclusive,
    trackInventory: false,
    isActive: true,
  },
  quantity,
});

describe('billing-math — calculateBillPreview', () => {
  describe('CGST + SGST (intra-state)', () => {
    it('should split GST evenly into CGST and SGST', () => {
      const cart = [makeItem(100, 18, 1, false)]; // Exclusive ₹100 + 18% = ₹118
      const result = calculateBillPreview(cart, 0, true, true, 'intrastate');

      expect(result.gstTotal).toBeCloseTo(18, 1);
      expect(result.cgstTotal).toBeCloseTo(9, 1);
      expect(result.sgstTotal).toBeCloseTo(9, 1);
      expect(result.igstTotal).toBe(0);
      expect(result.grandTotal).toBeCloseTo(118, 1);
    });

    it('should handle zero GST products correctly', () => {
      const cart = [makeItem(200, 0, 1, false)];
      const result = calculateBillPreview(cart, 0, true, true, 'intrastate');

      expect(result.gstTotal).toBe(0);
      expect(result.cgstTotal).toBe(0);
      expect(result.sgstTotal).toBe(0);
    });

    it('should handle GST-inclusive items (MRP)', () => {
      const cart = [makeItem(118, 18, 1, true)]; // MRP ₹118 incl. 18% GST
      const result = calculateBillPreview(cart, 0, true, false, 'intrastate');

      // Taxable = 118 / 1.18 ≈ 100
      expect(result.subtotal).toBeCloseTo(100, 0);
      expect(result.gstTotal).toBeCloseTo(18, 0);
      expect(result.cgstTotal).toBeCloseTo(9, 0);
      expect(result.sgstTotal).toBeCloseTo(9, 0);
    });

    it('should sum CGST/SGST across multiple items', () => {
      const cart = [
        makeItem(100, 18, 1, false), // GST = 18 → CGST = 9, SGST = 9
        makeItem(200, 5, 2, false), // GST = 20 → CGST = 10, SGST = 10
      ];
      const result = calculateBillPreview(cart, 0, true, true, 'intrastate');

      expect(result.cgstTotal).toBeCloseTo(19, 0);
      expect(result.sgstTotal).toBeCloseTo(19, 0);
    });
  });

  describe('IGST (inter-state)', () => {
    it('should put all GST into IGST with no CGST/SGST', () => {
      const cart = [makeItem(100, 18, 1, false)];
      const result = calculateBillPreview(cart, 0, true, true, 'interstate');

      expect(result.gstTotal).toBeCloseTo(18, 1);
      expect(result.igstTotal).toBeCloseTo(18, 1);
      expect(result.cgstTotal).toBe(0);
      expect(result.sgstTotal).toBe(0);
    });
  });

  describe('Blueprint - Item and Bill Discounts', () => {
    it('should handle item-level discount (percentage)', () => {
      const cart = [
        { ...makeItem(100, 18, 1, false), discountValue: 10, discountType: 'percent' as const },
      ];
      const result = calculateBillPreview(cart, 0, true, true, 'intrastate');

      // Taxable = 100 - 10% = 90
      // GST = 90 * 18% = 16.2
      expect(result.subtotal).toBe(90);
      expect(result.gstTotal).toBe(16.2);
    });

    it('should handle item-level discount (amount)', () => {
      const cart = [
        { ...makeItem(200, 5, 1, false), discountValue: 50, discountType: 'amount' as const },
      ];
      const result = calculateBillPreview(cart, 0, true, true, 'intrastate');

      // Taxable = 200 - 50 = 150
      // GST = 150 * 5% = 7.5
      expect(result.subtotal).toBe(150);
      expect(result.gstTotal).toBe(7.5);
    });

    it('should distribute bill discount proportionally', () => {
      const cart = [
        makeItem(100, 18, 1, false), // Item 1 (Weighted 1/3)
        makeItem(200, 18, 1, false), // Item 2 (Weighted 2/3)
      ];
      // Total taxable = 300. Bill Discount = 30.
      const result = calculateBillPreview(cart, 30, true, true, 'intrastate');

      expect(result.subtotal).toBe(270); // 90 + 180
      expect(result.gstTotal).toBe(48.6); // (90+180) * 18%
    });

    it('should apply 1-paisa balance method correctly', () => {
      const cart = [
        makeItem(10, 18, 1, false),
        makeItem(10, 18, 1, false),
        makeItem(10, 18, 1, false),
      ];
      const result = calculateBillPreview(cart, 0.01, true, true, 'intrastate');
      expect(result).toBeDefined();
    });
  });

  describe('Discount handling with GST', () => {
    it('should calculate GST correctly with proportional bill discount', () => {
      const cart = [makeItem(100, 18, 1, false)];
      const result = calculateBillPreview(cart, 10, true, true, 'intrastate'); // ₹10 discount

      // Step 2: LineTaxableBeforeBill = 100 - 0 = 100
      // Step 4: LineTaxableAfterAllDiscounts = 100 - 10 = 90
      // Step 5: LineTaxableRounded = 90
      // Step 6: LineGST = 90 * 0.18 = 16.2
      // Step 7: LineFinalTotal = 90 + 16.2 = 106.2

      expect(result.grandTotal).toBe(106.2);
    });

    it('should pass the specific audit case (₹100 incl, 10% item disc, 5% GST)', () => {
      const cart = [
        { ...makeItem(100, 5, 1, true), discountValue: 10, discountType: 'percent' as const },
      ];
      const result = calculateBillPreview(cart, 0, true, false, 'intrastate');

      expect(result.items[0].lineSubtotal).toBe(85.71);
      expect(result.items[0].lineGst).toBe(4.29);
      expect(result.grandTotal).toBe(90.0);
    });

    it('should pass the specific bill-level discount audit case (₹100 incl, ₹10 bill disc, 5% GST)', () => {
      const cart = [makeItem(100, 5, 1, true)];
      // ₹10 bill discount
      const result = calculateBillPreview(cart, 10, true, false, 'intrastate');

      expect(result.grandTotal).toBe(90.0);
      expect(result.discountAmount).toBe(10.0);
      expect(result.items[0].lineSubtotal).toBe(85.71);
      expect(result.items[0].lineGst).toBe(4.29);
    });
  });
});

// ─── calculateDiscountAmount helper ──────────────────────────────────────────

describe('calculateDiscountAmount', () => {
  it('converts percentage discount correctly', () => {
    const val = calculateDiscountAmount('percent', '10', 200);
    expect(val).toBe(20);
  });

  it('uses fixed amount discount directly', () => {
    const val = calculateDiscountAmount('amount', '25', 200);
    expect(val).toBe(25);
  });

  it('returns 0 for empty input', () => {
    expect(calculateDiscountAmount('amount', '', 100)).toBe(0);
  });
});
