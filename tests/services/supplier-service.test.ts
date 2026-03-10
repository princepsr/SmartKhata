import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, seedTestData, SqlJsDatabase } from '../utils/test-db';
import { SupplierService } from '../../src/main/services/supplier-service';

describe('SupplierService Integration Tests', () => {
  let db: SqlJsDatabase;
  let supplierService: SupplierService;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    supplierService = new SupplierService();
  });

  describe('createSupplier', () => {
    it('should create a new supplier', () => {
      const input = {
        name: 'New Pharma Dist',
        phone: '9876543210',
        gstin: '27ABCDE1234F1Z5',
        address: 'Mumbai, India',
        balanceDue: 0,
      };

      const supplier = supplierService.createSupplier(input);
      expect(supplier.id).toBeDefined();
      expect(supplier.name).toBe(input.name);
      expect(supplier.phone).toBe(input.phone);
    });

    it('should throw error for duplicate phone number', () => {
      const input = { name: 'S1', phone: '9000000001' }; // Pre-seeded Generic Pharma
      expect(() => supplierService.createSupplier(input)).toThrow('already exists');
    });

    it('should throw error for invalid phone format', () => {
      const input = { name: 'S1', phone: '123' };
      expect(() => supplierService.createSupplier(input)).toThrow('Phone number must be 10 digits');
    });
  });

  describe('updateSupplier', () => {
    it('should update supplier details', () => {
      const supplier = supplierService.createSupplier({ name: 'Old Name' });
      const updated = supplierService.updateSupplier(supplier.id, { name: 'New Name' });
      expect(updated.name).toBe('New Name');
    });

    it('should update balance correctly', () => {
      const supplier = supplierService.createSupplier({ name: 'Balance Test', balanceDue: 100 });
      supplierService.updateBalance(supplier.id, 50); // We owe more

      const refreshed = supplierService.getSupplier(supplier.id);
      expect(refreshed.balanceDue).toBe(150);
    });

    it('should prevent updating balance for inactive supplier', () => {
      const supplier = supplierService.createSupplier({ name: 'Inactive Test' });
      supplierService.updateSupplier(supplier.id, { isActive: false });

      expect(() => supplierService.updateBalance(supplier.id, 50)).toThrow('Supplier is inactive');
    });
  });

  describe('searchSuppliers', () => {
    it('should search by name or phone', () => {
      const results = supplierService.searchSuppliers('Generic Pharma');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('Generic');
    });
  });
});
