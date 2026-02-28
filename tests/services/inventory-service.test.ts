/**
 * InventoryService Tests
 *
 * Tests for stock levels, inventory history, and data integrity.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InventoryService } from '../../src/main/services/inventory-service';
import { InventoryRepository } from '../../src/main/repositories/inventory-repository';
import { ProductRepository } from '../../src/main/repositories/product-repository';
import { createTestDatabase, resetTestDatabase, seedTestData } from '../utils/test-db';
import { NotFoundError } from '../../src/main/services/errors/service-errors';

describe('InventoryService Integration Tests', () => {
  let db: any;
  let inventoryService: InventoryService;
  let productRepo: ProductRepository;
  let inventoryRepo: InventoryRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    inventoryService = new InventoryService();
    productRepo = new ProductRepository();
    inventoryRepo = new InventoryRepository();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  describe('getCurrentStock', () => {
    it('should return correct stock for valid product', () => {
      const stock = inventoryService.getCurrentStock(1);
      expect(stock).toBe(100); // From seed data
    });

    it('should throw NotFoundError for invalid product', () => {
      expect(() => {
        inventoryService.getCurrentStock(999);
      }).toThrow(NotFoundError);
    });
  });

  describe('getStockHistory', () => {
    it('should return empty array for product with no history', () => {
      const history = inventoryService.getStockHistory(1);
      expect(history).toEqual([]);
    });

    it('should return logs after stock changes', () => {
      inventoryRepo.logChange({
        productId: 1,
        changeQty: 10,
        reason: 'MANUAL',
        notes: 'Initial stock load',
      });

      const history = inventoryService.getStockHistory(1);
      expect(history.length).toBe(1);
      expect(history[0].changeQty).toBe(10);
      expect(history[0].reason).toBe('MANUAL');
    });

    it('should throw NotFoundError for invalid product', () => {
      expect(() => {
        inventoryService.getStockHistory(999);
      }).toThrow(NotFoundError);
    });
  });

  describe('verifyStockIntegrity', () => {
    it('should return valid=true when stock matches logs', () => {
      // Create a product with 0 stock and log 0 change
      // or use seeded product which has 100 stock but 0 logs (mismatch by default in seed?)
      // Seed data has stock_qty=100 but no inventory_logs.

      const integrity = inventoryService.verifyStockIntegrity(1);
      expect(integrity.valid).toBe(false); // 100 vs 0
      expect(integrity.difference).toBe(100);
    });

    it('should return valid=true when logs match stock_qty', () => {
      // Sync seeded product: it has 100 stock but 0 logs.
      // To make it valid, we log its "INITIAL" stock (represented as MANUAL for now)
      inventoryRepo.logChange({
        productId: 1,
        changeQty: 100,
        reason: 'MANUAL',
        notes: 'Initial seed sync',
      });

      const integrity = inventoryService.verifyStockIntegrity(1);
      expect(integrity.valid).toBe(true);
      expect(integrity.productStock).toBe(100);
      expect(integrity.calculatedStock).toBe(100);
    });
  });

  describe('Low Stock Alerts', () => {
    it('should identify low stock products', () => {
      // Coke 500ml has stock 100, threshold 10
      expect(inventoryService.isLowStock(1)).toBe(false);

      // Reduce stock to 5
      productRepo.updateStock(1, -95);
      expect(inventoryService.isLowStock(1)).toBe(true);
    });

    it('should return products below threshold', () => {
      // Initially none (Coke 100/10, Lays 50/5, Milk 30/10)
      let lowStock = inventoryService.getLowStockProducts();
      expect(lowStock.length).toBe(0);

      // Make Lays low stock
      productRepo.updateStock(2, -46); // 50 - 46 = 4 (threshold 5)
      lowStock = inventoryService.getLowStockProducts();
      expect(lowStock.length).toBe(1);
      expect(lowStock[0].id).toBe(2);
    });
  });
});
