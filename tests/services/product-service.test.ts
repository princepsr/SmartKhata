/**
 * ProductService Tests
 * 
 * Tests for product management, validation, and stock adjustments.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProductService } from '../../src/main/services/product-service';
import { ProductRepository } from '../../src/main/repositories/product-repository';
import { InventoryRepository } from '../../src/main/repositories/inventory-repository';
import { createTestDatabase, resetTestDatabase, seedTestData } from '../utils/test-db';
import { ValidationError, DuplicateEntryError, NotFoundError, InactiveEntityError } from '../../src/main/services/errors/service-errors';
import type Database from 'better-sqlite3';

describe('ProductService - Add Product', () => {
  let db: Database.Database;
  let productService: ProductService;
  let productRepo: ProductRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    productService = new ProductService();
    productRepo = new ProductRepository();
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
      stockQty: 50
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
        salePrice: 100
      });
    }).toThrow(ValidationError);
  });

  it('should throw error for negative price', () => {
    expect(() => {
      productService.addProduct({
        name: 'Test Product',
        salePrice: -10
      });
    }).toThrow(ValidationError);
  });

  it('should throw error for duplicate SKU', () => {
    expect(() => {
      productService.addProduct({
        name: 'Duplicate Product',
        sku: 'COKE-500', // Already exists
        salePrice: 100
      });
    }).toThrow(DuplicateEntryError);
  });

  it('should throw error for duplicate barcode', () => {
    expect(() => {
      productService.addProduct({
        name: 'Duplicate Product',
        barcode: '8901234567890', // Already exists
        salePrice: 100
      });
    }).toThrow(DuplicateEntryError);
  });

  it('should set default GST to 18%', () => {
    const product = productService.addProduct({
      name: 'Test Product',
      salePrice: 100
    });

    expect(product.gstPercent).toBe(18);
  });

  it('should throw error for invalid GST percent', () => {
    expect(() => {
      productService.addProduct({
        name: 'Test Product',
        salePrice: 100,
        gstPercent: 150 // Invalid
      });
    }).toThrow(ValidationError);
  });
});

describe('ProductService - Stock Adjustment', () => {
  let db: Database.Database;
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
    const initialStock = productRepo.findById(1)!.stockQty;

    productService.adjustStock({
      productId: 1,
      deltaQty: -10,
      reason: 'MANUAL',
      notes: 'Test deduction'
    });

    const finalStock = productRepo.findById(1)!.stockQty;
    expect(finalStock).toBe(initialStock - 10);
  });

  it('should add stock correctly', () => {
    const initialStock = productRepo.findById(1)!.stockQty;

    productService.adjustStock({
      productId: 1,
      deltaQty: 20,
      reason: 'MANUAL',
      notes: 'Test addition'
    });

    const finalStock = productRepo.findById(1)!.stockQty;
    expect(finalStock).toBe(initialStock + 20);
  });

  it('should throw error on insufficient stock', () => {
    expect(() => {
      productService.adjustStock({
        productId: 1,
        deltaQty: -200, // More than available
        reason: 'MANUAL'
      });
    }).toThrow(ValidationError);
  });

  it('should throw error for zero quantity', () => {
    expect(() => {
      productService.adjustStock({
        productId: 1,
        deltaQty: 0,
        reason: 'MANUAL'
      });
    }).toThrow(ValidationError);
  });

  it('should log inventory changes', () => {
    productService.adjustStock({
      productId: 1,
      deltaQty: -10,
      reason: 'MANUAL',
      notes: 'Test log'
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
        reason: 'MANUAL'
      });
    }).toThrow(InactiveEntityError);
  });

  it('should calculate margin correctly', () => {
    const margin = productService.calculateMargin(1);
    
    // Sale: 40, Purchase: 30
    // Margin: (40 - 30) / 40 * 100 = 25%
    expect(margin).toBe(25);
  });
});

describe('ProductService - Search and Query', () => {
  let db: Database.Database;
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
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain('Coca');
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
      reason: 'MANUAL'
    });

    const lowStock = productService.getLowStockProducts();
    
    expect(lowStock.length).toBeGreaterThan(0);
  });
});
