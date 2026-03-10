import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, seedTestData, SqlJsDatabase } from '../utils/test-db';
import { DebitNoteService } from '../../src/main/services/debit-note-service';
import { ProductRepository } from '../../src/main/repositories/product-repository';
import { SupplierRepository } from '../../src/main/repositories/supplier-repository';

describe('DebitNoteService Integration Tests', () => {
  let db: SqlJsDatabase;
  let dnService: DebitNoteService;
  let productRepo: ProductRepository;
  let supplierRepo: SupplierRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    dnService = new DebitNoteService();
    productRepo = new ProductRepository();
    supplierRepo = new SupplierRepository();
  });

  describe('recordReturn', () => {
    it('should record a purchase return and update stock and balances', async () => {
      // 1. Arrange: Identify a product and supplier from seed data
      const products = await productRepo.findAll();
      const product = products.find((p) => p.name === 'Dolo 650');
      const suppliers = await supplierRepo.findAll();
      const supplier = suppliers.find((s) => s.name === 'Local Distributor');

      expect(product).toBeDefined();
      expect(supplier).toBeDefined();
      if (!product || !supplier) {
        return;
      }

      const initialStock = product.stockQty;
      const initialBalance = supplier.balanceDue; // 1500 from seed

      const input = {
        supplierId: supplier.id,
        items: [
          {
            productId: product.id,
            productName: product.name,
            quantity: 10,
            unitPrice: 20,
            gstPercent: 12,
          },
        ],
        reason: 'Damaged Goods',
      };

      // Taxable = 200, GST = 24, Total = 224

      // 2. Act
      const debitNote = await dnService.recordReturn(input);

      // 3. Assert
      expect(debitNote).not.toBeNull();
      if (!debitNote) {
        return;
      }
      expect(debitNote.grandTotal).toBe(224);
      expect(debitNote.debitNoteNumber).toContain('DN-');

      // Check stock reduction
      const updatedProduct = await productRepo.findById(product.id);
      expect(updatedProduct).toBeDefined();
      expect(updatedProduct?.stockQty).toBe(initialStock - 10);

      // Check supplier balance reduction (Reverse Udhaar)
      const updatedSupplier = await supplierRepo.findById(supplier.id);
      expect(updatedSupplier).toBeDefined();
      expect(updatedSupplier?.balanceDue).toBe(initialBalance - 224);
    });

    it('should throw error if stock becomes negative (if restricted)', async () => {
      const products2 = await productRepo.findAll();
      const product2 = products2.find((p) => p.name === 'Dolo 650');
      const suppliers2 = await supplierRepo.findAll();
      const supplier2 = suppliers2.find((s) => s.name === 'Local Distributor');

      expect(product2).toBeDefined();
      expect(supplier2).toBeDefined();
      if (!product2 || !supplier2) {
        return;
      }

      const input = {
        supplierId: supplier2.id,
        items: [
          {
            productId: product2.id,
            productName: product2.name,
            quantity: 200, // exceeds 100 in stock
            unitPrice: 20,
            gstPercent: 12,
          },
        ],
      };

      expect(() => dnService.recordReturn(input)).toThrow('Insufficient stock');
    });
  });
});
