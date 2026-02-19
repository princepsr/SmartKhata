/**
 * ExportService Tests
 *
 * Verifies CSV generation and file export logic.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ExportService } from '../../src/main/services/export-service';
import { dialog } from 'electron';
import fs from 'fs';

// Mock Electron
vi.mock('electron', () => ({
  dialog: {
    showSaveDialog: vi.fn(),
  },
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    writeFileSync: vi.fn(),
  },
}));

// Mock Logger
vi.mock('../../src/main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ExportService();
  });

  describe('CSV Generation', () => {
    it('should generate valid Sales CSV', () => {
      const data = {
        summary: {
          billCount: 5,
          totalSales: 1000.5,
          totalDiscount: 50,
          netSales: 950.5,
        },
        modes: [
          { mode: 'cash', count: 3, totalAmount: 600.5 },
          { mode: 'upi', count: 2, totalAmount: 350 },
        ],
      };

      const csv = (service as any).generateCsvContent('sales', data, '2023-01-01 to 2023-01-31');
      expect(csv).toContain('SALES OVERVIEW');
      expect(csv).toContain('Total Sales,1000.50');
      expect(csv).toContain('CASH,3,600.50');
      expect(csv).toContain('UPI,2,350.00');
    });

    it('should generate valid GST CSV', () => {
      const data = {
        slabs: [
          { gstPercent: 5, taxableAmount: 100, gstAmount: 5, totalAmount: 105 },
          { gstPercent: 18, taxableAmount: 200, gstAmount: 36, totalAmount: 236 },
        ],
        totalTaxable: 300,
        totalGst: 41,
        totalAmount: 341,
      };

      const csv = (service as any).generateCsvContent('gst', data, '2023-01-01');
      expect(csv).toContain('GST SUMMARY');
      expect(csv).toContain('5,100.00,5.00,105.00');
      expect(csv).toContain('18,200.00,36.00,236.00');
      expect(csv).toContain('TOTALS,300.00,41.00,341.00');
    });

    it('should generate valid Stock CSV', () => {
      const data = {
        totalItems: 2,
        totalStockValue: 500.5,
        lowStockCount: 1,
        items: [
          { sku: 'S001', name: 'Product A', stockQty: 10, lowStockAlert: 5, salePrice: 100 },
          { sku: 'S002', name: 'Product B', stockQty: 2, lowStockAlert: 5, salePrice: 200 },
        ],
      };

      const csv = (service as any).generateCsvContent('stock', data, 'All');
      expect(csv).toContain('STOCK SUMMARY');
      expect(csv).toContain('Total Items,2');
      expect(csv).toContain('S001,Product A,10,5,100.00');
      expect(csv).toContain('S002,Product B,2,5,200.00');
    });

    it('should escape commas and quotes in CSV values', () => {
      const data = {
        totalItems: 1,
        totalStockValue: 100,
        lowStockCount: 0,
        items: [
          {
            sku: 'S001',
            name: 'Product, with comma "and quotes"',
            stockQty: 10,
            lowStockAlert: 5,
            salePrice: 100,
          },
        ],
      };

      const csv = (service as any).generateCsvContent('stock', data, 'All');
      expect(csv).toContain('"Product, with comma ""and quotes"""');
    });
  });

  describe('exportToExcel', () => {
    it('should write file if user selects a path', async () => {
      const data = {
        summary: { billCount: 0, totalSales: 0, totalDiscount: 0, netSales: 0 },
        modes: [],
      };
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        filePath: 'C:/test.csv',
        canceled: false,
      } as any);

      const result = await service.exportToExcel('sales', data, 'Today');

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith('C:/test.csv', expect.any(String), 'utf-8');
    });

    it('should return false if user cancels dialog', async () => {
      const data = {
        summary: { billCount: 0, totalSales: 0, totalDiscount: 0, netSales: 0 },
        modes: [],
      };
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({ filePath: '', canceled: true } as any);

      const result = await service.exportToExcel('sales', data, 'Today');

      expect(result).toBe(false);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });
});
