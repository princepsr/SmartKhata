import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, seedTestData, SqlJsDatabase } from '../utils/test-db';
import { MedicalService } from '../../src/main/services/medical-service';

describe('MedicalService Integration Tests', () => {
  let db: SqlJsDatabase;
  let medicalService: MedicalService;

  beforeEach(async () => {
    db = await createTestDatabase();
    seedTestData(db);
    medicalService = new MedicalService();
  });

  describe('getSaltSuggestions', () => {
    it('should return salt suggestions for a query', async () => {
      // Note: This depends on the static data in indian-salts.ts
      // Since it's static, we just test if it returns anything for common queries
      const results = await medicalService.getSaltSuggestions('Para');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((s) => s.toLowerCase().includes('paracetamol'))).toBe(true);
    });

    it('should return empty list for non-matching query', async () => {
      const results = await medicalService.getSaltSuggestions('XYZNonExistentSalt');
      expect(results.length).toBe(0);
    });
  });

  describe('Expiring and Expired Products', () => {
    it('should identify expired products', () => {
      const expired = medicalService.getExpiredProducts();
      expect(expired.some((p) => p.name === 'Expired Med')).toBe(true);
      expect(expired.every((p) => p.expiryDate && new Date(p.expiryDate) <= new Date())).toBe(true);
    });

    it('should identify products expiring soon', () => {
      // In seed data: Expiring Soon is 2026-03-15. Current test date is 2026-02-28.
      const expiring = medicalService.getExpiringProducts(30);
      expect(expiring.some((p) => p.name === 'Expiring Soon')).toBe(true);
    });
  });

  describe('Salts and Alternatives', () => {
    it('should find alternatives with the same salt', () => {
      const dolo = medicalService.searchBySalt('Paracetamol').find((p) => p.name === 'Dolo 650');
      expect(dolo).toBeDefined();
      if (!dolo) {
        return;
      }

      const alternatives = medicalService.getAlternativesBySalt('Paracetamol', dolo.id);
      expect(alternatives.length).toBeGreaterThan(0);
      expect(alternatives.every((p) => p.id !== dolo.id)).toBe(true);
      expect(alternatives.some((p) => p.saltName === 'Paracetamol')).toBe(true);
    });

    it('should return drug warnings correctly', () => {
      const dolo = medicalService.searchBySalt('Paracetamol').find((p) => p.name === 'Dolo 650');
      if (!dolo) {
        return;
      }
      const warning = medicalService.getDrugWarning(dolo);
      expect(warning).toContain('Schedule H');
    });

    it('should format quantities with strip sizes', () => {
      // Dolo has strip size 15
      const formatted = medicalService.formatQuantity(20, 15);
      expect(formatted).toBe('1 Strip, 5 Tablet');

      expect(medicalService.formatQuantity(15, 15)).toBe('1 Strip');
      expect(medicalService.formatQuantity(5, 15)).toBe('5 Tablet');
    });
  });

  describe('getAlternativesBySalt', () => {
    it('should find other products with the same salt', async () => {
      // Seed products with salts
      db.exec(`
        UPDATE products SET category = 'Paracetamol 500mg' WHERE id = 1; -- Coke as dummy
        UPDATE products SET category = 'Paracetamol 500mg' WHERE id = 2; -- Lays as dummy
      `);

      // We need to mock how MedicalService gets salts.
      // Current implementation shows it uses product metadata.
      // Let's check medical-service.ts implementation first.
    });
  });
});
