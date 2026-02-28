import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, seedTestData } from '../utils/test-db';
import { PurchaseOrderService } from '../../src/main/services/purchase-order-service';
import { SettingsService } from '../../src/main/services/settings-service';

describe('PurchaseOrderService Integration Tests', () => {
  let db: any;
  let poService: PurchaseOrderService;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    // Seed a supplier for testing
    db.exec(`
      INSERT INTO suppliers (name, phone, gstin, is_active)
      VALUES ('Test Supplier', '1234567890', '27AAPFU0939F1ZV', 1)
    `);
    SettingsService.getInstance().reloadCache();
    poService = new PurchaseOrderService();
  });

  describe('create', () => {
    it('should create a purchase order with items', async () => {
      const data = {
        supplierId: 1,
        supplierNameSnapshot: 'Test Supplier',
        poDate: '2026-02-28',
        items: [
          {
            productName: 'Test Product',
            quantity: 10,
            unitPrice: 100,
            gstPercent: 18,
            lineTotal: 1180,
          },
        ],
        totalTaxable: 1000,
        gstTotal: 180,
        grandTotal: 1180,
      };

      const result = await poService.create(data);

      expect(result.poNumber).toMatch(/^PO-2026-\d{4}$/);
      expect(result.status).toBe('PENDING');
      expect(result.items?.length).toBe(1);
      expect(result.items?.[0].productName).toBe('Test Product');
      expect(result.grandTotal).toBe(1180);
    });

    it('should generate sequential PO numbers', async () => {
      const data = {
        supplierId: 1,
        supplierNameSnapshot: 'Test Supplier',
        poDate: '2026-02-28',
        items: [{ productName: 'P1', quantity: 1, unitPrice: 10, gstPercent: 0, lineTotal: 10 }],
        totalTaxable: 10,
        gstTotal: 0,
        grandTotal: 10,
      };

      const po1 = await poService.create(data);
      const po2 = await poService.create(data);

      const seq1 = parseInt(po1.poNumber.split('-')[2], 10);
      const seq2 = parseInt(po2.poNumber.split('-')[2], 10);

      expect(seq2).toBe(seq1 + 1);
    });
  });

  describe('list and getById', () => {
    it('should list and retrieve purchase orders by ID', async () => {
      const data = {
        supplierId: 1,
        supplierNameSnapshot: 'Test Supplier',
        poDate: '2026-02-28',
        items: [{ productName: 'P1', quantity: 1, unitPrice: 10, gstPercent: 0, lineTotal: 10 }],
        totalTaxable: 10,
        gstTotal: 0,
        grandTotal: 10,
      };

      const created = await poService.create(data);

      const list = await poService.list();
      expect(list.data.length).toBeGreaterThan(0);
      expect(list.data.some((p) => p.id === created.id)).toBe(true);

      const retrieved = await poService.getById(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved.poNumber).toBe(created.poNumber);
      expect(retrieved.items?.length).toBe(1);
    });
  });

  describe('updateStatus', () => {
    it('should update the status of a purchase order', async () => {
      const data = {
        supplierId: 1,
        supplierNameSnapshot: 'Test Supplier',
        poDate: '2026-02-28',
        items: [{ productName: 'P1', quantity: 1, unitPrice: 10, gstPercent: 0, lineTotal: 10 }],
        totalTaxable: 10,
        gstTotal: 0,
        grandTotal: 10,
      };

      const created = await poService.create(data);
      expect(created.status).toBe('PENDING');

      const success = await poService.updateStatus(created.id, 'RECEIVED');
      expect(success).toBe(true);

      const updated = await poService.getById(created.id);
      expect(updated.status).toBe('RECEIVED');
    });
  });
});
