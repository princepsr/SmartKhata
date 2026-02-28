import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, seedTestData } from '../utils/test-db';
import { PurchaseService } from '../../src/main/services/purchase-service';
import { SettingsService } from '../../src/main/services/settings-service';

describe('PurchaseService Integration Tests', () => {
  let db: any;
  let purchaseService: PurchaseService;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    SettingsService.getInstance().reloadCache();
    purchaseService = new PurchaseService();
  });

  describe('recordPurchase', () => {
    it('should record an intrastate purchase and calculate ITC (CGST/SGST)', () => {
      // Set to intrastate
      db.exec(`UPDATE app_config SET supply_type = 'intrastate' WHERE id = 1`);
      SettingsService.getInstance().reloadCache();

      const result = purchaseService.recordPurchase({
        supplierName: 'ABC Wholesale',
        supplierGstin: '27AAPFU0939F1ZV',
        invoiceNumber: 'INV-101',
        invoiceDate: '2026-02-27',
        items: [
          {
            productName: 'Raw Inventory',
            quantity: 10,
            unitPrice: 100,
            gstPercent: 12,
          },
        ],
      });

      expect(result.purchase.purchaseNumber).toMatch(/^PUR-\d{8}-\d{4}$/);
      expect(result.purchase.totalTaxable).toBe(1000);
      expect(result.purchase.gstTotal).toBe(120);
      expect(result.purchase.cgstAmount).toBe(60);
      expect(result.purchase.sgstAmount).toBe(60);
      expect(result.purchase.igstAmount).toBe(0);
      expect(result.purchase.grandTotal).toBe(1120);
      expect(result.items.length).toBe(1);
    });

    it('should record an interstate purchase and calculate ITC (IGST)', () => {
      // Set to interstate
      db.exec(`UPDATE app_config SET supply_type = 'interstate' WHERE id = 1`);
      SettingsService.getInstance().reloadCache();

      const result = purchaseService.recordPurchase({
        supplierName: 'XYZ Distributors',
        invoiceDate: '2026-02-27',
        items: [
          {
            productName: 'Outside State Goods',
            quantity: 5,
            unitPrice: 200,
            gstPercent: 18,
          },
        ],
      });

      expect(result.purchase.igstAmount).toBe(180);
      expect(result.purchase.cgstAmount).toBe(0);
      expect(result.purchase.sgstAmount).toBe(0);
      expect(result.purchase.gstTotal).toBe(180);
      expect(result.purchase.grandTotal).toBe(1180);
    });

    it('should throw validation errors for invalid input', () => {
      expect(() =>
        purchaseService.recordPurchase({
          supplierName: '',
          invoiceDate: '2026-02-27',
          items: [],
        })
      ).toThrow('Supplier name is required');

      expect(() =>
        purchaseService.recordPurchase({
          supplierName: 'Valid',
          invoiceDate: '',
          items: [],
        })
      ).toThrow('Invoice date is required');

      expect(() =>
        purchaseService.recordPurchase({
          supplierName: 'Valid',
          invoiceDate: '2026-02-27',
          items: [],
        })
      ).toThrow('At least one item is required');
    });
  });

  describe('ITC Summary and Liability', () => {
    it('should calculate ITC summary correctly for a date range', () => {
      purchaseService.recordPurchase({
        supplierName: 'S1',
        invoiceDate: '2026-02-01',
        items: [{ productName: 'P1', quantity: 1, unitPrice: 100, gstPercent: 5 }],
      });

      purchaseService.recordPurchase({
        supplierName: 'S2',
        invoiceDate: '2026-02-15',
        items: [{ productName: 'P2', quantity: 1, unitPrice: 200, gstPercent: 12 }],
      });

      const summary = purchaseService.getITCSummary('2026-02-01', '2026-02-28');

      // ITC 1: 5. ITC 2: 24. Total: 29.
      expect(summary.purchaseCount).toBe(2);
      expect(summary.totalTaxable).toBe(300);
      expect(summary.totalItc).toBe(29);
    });

    it('should calculate net GST liability (Output - ITC)', () => {
      purchaseService.recordPurchase({
        supplierName: 'S1',
        invoiceDate: '2026-02-01',
        items: [{ productName: 'P1', quantity: 10, unitPrice: 100, gstPercent: 18 }],
      }); // ITC = 180

      const liability = purchaseService.getNetGstLiability('2026-02-01', '2026-02-28', 500);

      expect(liability.outputGst).toBe(500);
      expect(liability.inputItc).toBe(180);
      expect(liability.netPayable).toBe(320); // 500 - 180
    });

    it('should handle zero liability (ITC exceeds output)', () => {
      purchaseService.recordPurchase({
        supplierName: 'S1',
        invoiceDate: '2026-02-01',
        items: [{ productName: 'P1', quantity: 10, unitPrice: 100, gstPercent: 18 }],
      }); // ITC = 180

      const liability = purchaseService.getNetGstLiability('2026-02-01', '2026-02-28', 50);

      expect(liability.netPayable).toBe(0);
    });
  });
});
