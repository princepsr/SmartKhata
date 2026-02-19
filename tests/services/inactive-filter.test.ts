/**
 * Inactive Filter Tests
 *
 * Verifies that services correctly handle the includeInactive flag.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProductService } from '../../src/main/services/product-service';
import { CustomerService } from '../../src/main/services/customer-service';
import { createTestDatabase, resetTestDatabase, seedTestData } from '../utils/test-db';

describe('Inactive Visibility Filtering', () => {
  let db: any;
  let productService: ProductService;
  let customerService: CustomerService;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    productService = new ProductService();
    customerService = new CustomerService();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  describe('Product Visibility', () => {
    it('should exclude inactive products by default in search', () => {
      const results = productService.searchProducts('Inactive');
      expect(results).toHaveLength(0);
    });

    it('should include inactive products when includeInactive is true in search', () => {
      const results = productService.searchProducts('Inactive', true);
      expect(results).toHaveLength(1);
      expect(results[0].isActive).toBe(false);
    });

    it('should include inactive products in getAll if requested', () => {
      const allActive = productService.getAllProducts();
      const allWithInactive = productService.getAllProducts(true);

      expect(allWithInactive.length).toBe(allActive.length + 1);
    });
  });

  describe('Customer Visibility', () => {
    it('should exclude inactive customers by default in search', () => {
      const results = customerService.searchCustomers('Inactive');
      expect(results).toHaveLength(0);
    });

    it('should include inactive customers when includeInactive is true in search', () => {
      const results = customerService.searchCustomers('Inactive', true);
      expect(results).toHaveLength(1);
      expect(results[0].isActive).toBe(false);
    });

    it('should include inactive customers in getAll if requested', () => {
      const allActive = customerService.getAllCustomers();
      const allWithInactive = customerService.getAllCustomers(true);

      expect(allWithInactive.length).toBe(allActive.length + 1);
    });
  });
});
