import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, seedTestData } from '../utils/test-db';
import { CreditNoteService } from '../../src/main/services/credit-note-service';
import { BillingTransactionService } from '../../src/main/services/billing-transaction-service';
import { SettingsService } from '../../src/main/services/settings-service';
import { ProductRepository } from '../../src/main/repositories/product-repository';

describe('CreditNoteService Integration Tests', () => {
  let db: any;
  let creditNoteService: CreditNoteService;
  let transactionService: BillingTransactionService;
  let productRepo: ProductRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);

    // Set explicit exclusive GST mode for predictable math in tests
    db.exec(`UPDATE app_config SET gst_exclusive_mode = 1 WHERE id = 1`);
    SettingsService.getInstance().reloadCache();

    creditNoteService = new CreditNoteService();
    transactionService = new BillingTransactionService();
    productRepo = new ProductRepository();
  });

  describe('createCreditNote', () => {
    it('should create a full return credit note and reverse GST correctly (Intrastate)', async () => {
      // 1. Create a sale first
      // 1 Coke (40 + 5% GST = 42)
      const sale = await transactionService.createSale({
        items: [{ productId: 1, quantity: 1 }],
        paymentMode: 'cash',
      });

      // 2. Create credit note for the whole bill
      const cn = creditNoteService.createCreditNote({
        originalBillId: sale.id,
        items: [
          {
            productId: 1,
            quantity: 1,
            unitPrice: 42,
            gstPercent: 5,
          },
        ],
        reason: 'WRONG_ITEM',
      });

      expect(cn.creditNote.creditNoteNumber).toMatch(/^CN-\d{8}-\d{4}$/);
      expect(cn.creditNote.originalBillId).toBe(sale.id);
      expect(cn.creditNote.refundAmount).toBe(42); // Full amount with GST
      expect(cn.creditNote.taxableAmount).toBe(40);
      expect(cn.creditNote.cgstAmount).toBe(1);
      expect(cn.creditNote.sgstAmount).toBe(1);
      expect(cn.creditNote.gstTotal).toBe(2);
      expect(cn.items.length).toBe(1);
      expect(cn.items[0].productNameSnapshot).toBe('Coca Cola 500ml');
    });

    it('should handle partial returns correctly', async () => {
      // 1. Create a sale with 2 items
      // 2 Coke (2 * 40 = 80 + 5% = 84)
      const sale = await transactionService.createSale({
        items: [{ productId: 1, quantity: 2 }],
        paymentMode: 'cash',
      });

      // 2. Return only 1 item
      const cn = creditNoteService.createCreditNote({
        originalBillId: sale.id,
        items: [
          {
            productId: 1,
            quantity: 1,
            unitPrice: 42,
            gstPercent: 5,
          },
        ],
        reason: 'DEFECTIVE',
      });

      expect(cn.creditNote.refundAmount).toBe(42);
      expect(cn.creditNote.gstTotal).toBe(2);
      expect(cn.creditNote.cgstAmount).toBe(1);
      expect(cn.creditNote.sgstAmount).toBe(1);
    });

    it('should reverse IGST correctly for interstate returns', async () => {
      // Set to interstate
      db.exec(`UPDATE app_config SET supply_type = 'interstate' WHERE id = 1`);
      SettingsService.getInstance().reloadCache();

      // 1. Create a sale (1 Coke = 40 + 5% IGST = 42)
      const sale = await transactionService.createSale({
        items: [{ productId: 1, quantity: 1 }],
        paymentMode: 'cash',
      });

      // 2. Return
      const cn = creditNoteService.createCreditNote({
        originalBillId: sale.id,
        items: [
          {
            productId: 1,
            quantity: 1,
            unitPrice: 42,
            gstPercent: 5,
          },
        ],
        reason: 'OTHER',
      });

      expect(cn.creditNote.igstAmount).toBe(2);
      expect(cn.creditNote.cgstAmount).toBe(0);
      expect(cn.creditNote.sgstAmount).toBe(0);
      expect(cn.creditNote.gstTotal).toBe(2);
    });

    it('should throw error if original bill does not exist', () => {
      expect(() =>
        creditNoteService.createCreditNote({
          originalBillId: 999,
          items: [{ productId: 1, quantity: 1, unitPrice: 40, gstPercent: 5 }],
          reason: 'OTHER',
        })
      ).toThrow();
    });

    it('should throw error if items list is empty', async () => {
      const sale = await transactionService.createSale({
        items: [{ productId: 1, quantity: 1 }],
        paymentMode: 'cash',
      });

      expect(() =>
        creditNoteService.createCreditNote({
          originalBillId: sale.id,
          items: [],
          reason: 'OTHER',
        })
      ).toThrow('At least one item must be returned');
    });
  });

  describe('listCreditNotes', () => {
    it('should list created credit notes', async () => {
      const sale = await transactionService.createSale({
        items: [{ productId: 1, quantity: 1 }],
        paymentMode: 'cash',
      });

      creditNoteService.createCreditNote({
        originalBillId: sale.id,
        items: [{ productId: 1, quantity: 1, unitPrice: 42, gstPercent: 5 }],
        reason: 'WRONG_ITEM',
      });

      const today = new Date().toISOString().split('T')[0];
      const list = creditNoteService.listCreditNotes(today, today);

      expect(list.total).toBe(1);
      expect(list.data[0].originalBillNumber).toBeDefined();
    });
  });
});
