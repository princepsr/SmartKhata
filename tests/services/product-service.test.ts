/**
 * ProductService Tests
 *
 * Tests for product management, validation, and stock adjustments.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProductService } from '../../src/main/services/product-service';
import { ProductRepository } from '../../src/main/repositories/product-repository';
import { InventoryRepository } from '../../src/main/repositories/inventory-repository';
import {
  createTestDatabase,
  resetTestDatabase,
  seedTestData,
  type BetterSqliteCompatibleDatabase,
} from '../utils/test-db';
import {
  ValidationError,
  DuplicateEntryError,
  InactiveEntityError,
} from '../../src/main/services/errors/service-errors';
import { SettingsService } from '../../src/main/services/settings-service';

describe('ProductService - Add Product', () => {
  let db: BetterSqliteCompatibleDatabase;
  let productService: ProductService;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    productService = new ProductService();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  it('should create product successfully', () => {
    const product = productService.addProduct({
      name: 'New Product',
      sku: 'NEW-001',
      salePrice: 100,
      gstPercent: 18,
      stockQty: 50,
    });

    expect(product.name).toBe('New Product');
    expect(product.sku).toBe('NEW-001');
    expect(product.salePrice).toBe(100);
    expect(product.stockQty).toBe(50);
  });

  it('should throw error for empty name', () => {
    expect(() => {
      productService.addProduct({
        name: '',
        salePrice: 100,
      });
    }).toThrow(ValidationError);
  });

  it('should throw error for negative price', () => {
    expect(() => {
      productService.addProduct({
        name: 'Test Product',
        salePrice: -10,
      });
    }).toThrow(ValidationError);
  });

  it('should throw error for duplicate SKU', () => {
    expect(() => {
      productService.addProduct({
        name: 'Duplicate Product',
        sku: 'COKE-500', // Already exists
        salePrice: 100,
      });
    }).toThrow(DuplicateEntryError);
  });

  it('should throw error for duplicate barcode', () => {
    expect(() => {
      productService.addProduct({
        name: 'Duplicate Product',
        barcode: '8901234567890', // Already exists
        salePrice: 100,
      });
    }).toThrow(DuplicateEntryError);
  });

  it('should set default GST from settings', () => {
    // 1. Change settings to 12%
    const settingsService = SettingsService.getInstance();
    settingsService.updateConfig({ gstPercentage: 12 });

    const product = productService.addProduct({
      name: 'Test Product 12',
      salePrice: 100,
    });

    expect(product.gstPercent).toBe(12);

    // 2. Change settings back to 5%
    settingsService.updateConfig({ gstPercentage: 5 });

    const product2 = productService.addProduct({
      name: 'Test Product 5',
      salePrice: 100,
    });

    expect(product2.gstPercent).toBe(5);
  });

  it('should throw error for invalid GST percent', () => {
    expect(() => {
      productService.addProduct({
        name: 'Test Product',
        salePrice: 100,
        gstPercent: 150, // Invalid
      });
    }).toThrow(ValidationError);
  });

  it('should import products in bulk', () => {
    const products = productService.importProducts([
      { name: 'Bulk 1', sku: 'BULK-1', salePrice: 100 },
      { name: 'Bulk 2', sku: 'BULK-2', salePrice: 200 },
    ]);

    expect(products).toHaveLength(2);
    expect(products[0].sku).toBe('BULK-1');
    expect(products[1].sku).toBe('BULK-2');
  });

  it('should throw error if any product in bulk import is invalid', () => {
    expect(() => {
      productService.importProducts([
        { name: 'Valid', sku: 'V-1', salePrice: 100 },
        { name: '', sku: 'I-1', salePrice: 100 }, // Invalid name
      ]);
    }).toThrow(ValidationError);
  });
});

describe('ProductService - Stock Adjustment', () => {
  let db: BetterSqliteCompatibleDatabase;
  let productService: ProductService;
  let productRepo: ProductRepository;
  let inventoryRepo: InventoryRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    productService = new ProductService();
    productRepo = new ProductRepository();
    inventoryRepo = new InventoryRepository();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  it('should deduct stock correctly', () => {
    const product = productRepo.findById(1);
    expect(product).toBeDefined();
    const initialStock = product?.stockQty || 0;

    productService.adjustStock({
      productId: 1,
      deltaQty: -10,
      reason: 'MANUAL',
      notes: 'Test deduction',
    });

    const finalProduct = productRepo.findById(1);
    expect(finalProduct).toBeDefined();
    const finalStock = finalProduct?.stockQty || 0;
    expect(finalStock).toBe(initialStock - 10);
  });

  it('should add stock correctly', () => {
    const product = productRepo.findById(1);
    expect(product).toBeDefined();
    const initialStock = product?.stockQty || 0;

    productService.adjustStock({
      productId: 1,
      deltaQty: 20,
      reason: 'MANUAL',
      notes: 'Test addition',
    });

    const finalProduct = productRepo.findById(1);
    expect(finalProduct).toBeDefined();
    const finalStock = finalProduct?.stockQty || 0;
    expect(finalStock).toBe(initialStock + 20);
  });

  it('should throw error on insufficient stock', () => {
    expect(() => {
      productService.adjustStock({
        productId: 1,
        deltaQty: -200, // More than available
        reason: 'MANUAL',
      });
    }).toThrow(ValidationError);
  });

  it('should throw error for zero quantity', () => {
    expect(() => {
      productService.adjustStock({
        productId: 1,
        deltaQty: 0,
        reason: 'MANUAL',
      });
    }).toThrow(ValidationError);
  });

  it('should log inventory changes', () => {
    productService.adjustStock({
      productId: 1,
      deltaQty: -10,
      reason: 'MANUAL',
      notes: 'Test log',
    });

    const logs = inventoryRepo.getStockHistory(1);
    expect(logs.length).toBeGreaterThan(0);

    const lastLog = logs[logs.length - 1];
    expect(lastLog.changeQty).toBe(-10);
    expect(lastLog.reason).toBe('MANUAL');
  });

  it('should throw error for inactive product', () => {
    expect(() => {
      productService.adjustStock({
        productId: 4, // Inactive product
        deltaQty: 10,
        reason: 'MANUAL',
      });
    }).toThrow(InactiveEntityError);
  });

  it('should update product details correctly', () => {
    productService.updateProduct(1, {
      name: 'Updated Coke',
      salePrice: 45,
    });

    const product = productRepo.findById(1);
    expect(product?.name).toBe('Updated Coke');
    expect(product?.salePrice).toBe(45);
  });

  it('should verify stock history consistency', () => {
    productService.adjustStock({ productId: 1, deltaQty: 10, reason: 'MANUAL' });
    productService.adjustStock({ productId: 1, deltaQty: -5, reason: 'MANUAL' });

    const history = inventoryRepo.getStockHistory(1);
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[history.length - 2].changeQty).toBe(10);
    expect(history[history.length - 1].changeQty).toBe(-5);
  });

  it('should calculate margin correctly', () => {
    const margin = productService.calculateMargin(1);
    // Sale: 40, Purchase: 30 (from seed data)
    // Margin: (40 - 30) / 40 * 100 = 25%
    expect(margin).toBe(25);
  });

  it('should handle margin calculation with zero purchase price', () => {
    const product = productService.addProduct({
      name: 'Free Item',
      salePrice: 10,
      purchasePrice: 0,
    });

    const margin = productService.calculateMargin(product.id);
    expect(margin).toBe(0);
  });

  it('should deactivate product and exclude from default search', () => {
    productService.deactivateProduct(1);

    const results = productService.searchProducts('Coca');
    expect(results.items).toHaveLength(0);

    const allResults = productService.searchProducts('Coca', true);
    expect(allResults.items).toHaveLength(1);
    expect(allResults.items[0].isActive).toBeFalsy();
  });

  it('should list all products including inactive ones', () => {
    productService.deactivateProduct(1);

    const activeProducts = productService.getAllProducts(false);
    expect(activeProducts.items.find((p: any) => p.id === 1)).toBeUndefined();

    const allProducts = productService.getAllProducts(true);
    expect(allProducts.items.find((p: any) => p.id === 1)).toBeDefined();
    expect(allProducts.items.find((p: any) => p.id === 1).isActive).toBeFalsy();
  });
});

describe('ProductService - Search and Query', () => {
  let db: BetterSqliteCompatibleDatabase;
  let productService: ProductService;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    productService = new ProductService();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  it('should search products by name', () => {
    const results = productService.searchProducts('Coca');

    expect(results.items.length).toBeGreaterThan(0);
    expect(results.items[0].name).toContain('Coca');
  });

  it('should throw error for empty search query', () => {
    expect(() => {
      productService.searchProducts('');
    }).toThrow(ValidationError);
  });

  it('should get low stock products', () => {
    // Adjust stock to make product low
    productService.adjustStock({
      productId: 1,
      deltaQty: -95, // Leaves 5, below alert of 10
      reason: 'MANUAL',
    });

    const lowStock = productService.getLowStockProducts();

    expect(lowStock.length).toBeGreaterThan(0);
  });

  it('should handle pagination depth correctly', () => {
    // Add 5 more products (total will be 3 + 5 = 8 in seed, or more if seed is larger)
    // Seed has 3 products. Let's add 5 more to make 8.
    for (let i = 0; i < 5; i++) {
      productService.addProduct({
        name: `Paginator ${i}`,
        salePrice: 10 + i,
      });
    }

    // Page 1, Limit 3 -> 3 items, hasMore = true
    const p1 = productService.getAllProducts(false, 1, 3);
    const count = productService.getProductCount();
    expect(p1.items).toHaveLength(3);
    // hasMore logic in service: page * limit < totalCount. 1 * 3 < 8 is true.
    // Wait, getAllProducts returns { items, page }. It doesn't return hasMore?
    // Let me check searchProducts which does.

    const s1 = productService.searchProducts('Paginator', false, 1, 2);
    expect(s1.items).toHaveLength(2);
    expect(s1.totalCount).toBe(5);
    expect(s1.hasMore).toBe(true);

    const s3 = productService.searchProducts('Paginator', false, 3, 2);
    expect(s3.items).toHaveLength(1);
    expect(s3.hasMore).toBe(false);
  });

  it('should sanitize search queries with special characters', () => {
    productService.addProduct({
      name: 'Product % with _ wildcards',
      salePrice: 100,
    });

    // Should find the literal product, not behave as SQL wildcard
    const results = productService.searchProducts('% with _');
    expect(results.items).toHaveLength(1);
    expect(results.items[0].name).toBe('Product % with _ wildcards');
  });
});
