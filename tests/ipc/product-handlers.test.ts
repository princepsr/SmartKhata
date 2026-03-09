import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ipcMain } from 'electron';
import { registerProductHandlers } from '../../src/main/ipc/handlers/product-handlers';
import { IPC_CHANNELS } from '../../src/shared/ipc/channels';

// Mock Electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock Services
const mockProductService = vi.hoisted(() => ({
  getAllProducts: vi.fn(),
  getProductCount: vi.fn(),
  getProduct: vi.fn(),
  addProduct: vi.fn(),
  updateProduct: vi.fn(),
  searchProducts: vi.fn(),
  getLowStockProducts: vi.fn(),
  adjustStock: vi.fn(),
  getStockHistory: vi.fn(),
  deactivateProduct: vi.fn(),
  importProducts: vi.fn(),
}));

const mockMedicalService = vi.hoisted(() => ({
  getDrugWarning: vi.fn(),
  getSaltSuggestions: vi.fn(),
  getAlternativesBySalt: vi.fn(),
}));

const mockLicenseService = vi.hoisted(() => ({
  getLicenseStatus: vi.fn(),
}));

vi.mock('../../src/main/services/product-service', () => ({
  ProductService: vi.fn().mockImplementation(() => mockProductService),
}));

vi.mock('../../src/main/services/medical-service', () => ({
  MedicalService: vi.fn().mockImplementation(() => mockMedicalService),
}));

vi.mock('../../src/main/services/license-service', () => ({
  LicenseService: vi.fn().mockImplementation(() => mockLicenseService),
}));

describe('Product IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLicenseService.getLicenseStatus.mockReturnValue({ isLocked: false });
    registerProductHandlers();
  });

  const getHandler = (channel: string): ((...args: any[]) => any) => {
    const call = vi.mocked(ipcMain.handle).mock.calls.find((c) => c[0] === channel);
    if (!call) {
      throw new Error(`Handler not registered for ${channel}`);
    }
    return call[1];
  };

  const mockEvent = {} as any;

  it('should register product management handlers', () => {
    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.PRODUCT_LIST, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.PRODUCT_CREATE, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.PRODUCT_SEARCH, expect.any(Function));
  });

  describe('PRODUCT_LIST', () => {
    it('should return paginated products', async () => {
      mockProductService.getAllProducts.mockReturnValue({ items: [], page: 1 });
      mockProductService.getProductCount.mockReturnValue(0);

      const handler = getHandler(IPC_CHANNELS.PRODUCT_LIST);
      const result = await handler(mockEvent, { page: 1, pageSize: 10 });

      expect(result.success).toBe(true);
      expect(result.data.items).toEqual([]);
      expect(mockProductService.getAllProducts).toHaveBeenCalledWith(false, 1, 10);
    });
  });

  describe('PRODUCT_CREATE', () => {
    it('should create a product and return success', async () => {
      const mockProduct = {
        id: 1,
        name: 'Test',
        createdAt: new Date(),
        updatedAt: new Date(),
        sku: 'S1',
        barcode: 'B1',
        salePrice: 10,
        purchasePrice: 5,
        gstPercent: 12,
        stockQty: 100,
        lowStockAlert: 10,
        isActive: true,
        trackInventory: true,
        hsnCode: '123',
      };
      mockProductService.addProduct.mockReturnValue(mockProduct);

      const handler = getHandler(IPC_CHANNELS.PRODUCT_CREATE);
      const result = await handler(mockEvent, { name: 'Test', salePrice: 10 });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe(1);
    });

    it('should fail if license is locked', async () => {
      mockLicenseService.getLicenseStatus.mockReturnValue({ isLocked: true });

      const handler = getHandler(IPC_CHANNELS.PRODUCT_CREATE);
      const result = await handler(mockEvent, { name: 'Test', salePrice: 10 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });
  });

  describe('Medical Handlers', () => {
    it('should return salt suggestions', async () => {
      mockMedicalService.getSaltSuggestions.mockReturnValue(['Para', 'Acet']);

      const handler = getHandler(IPC_CHANNELS.MEDICAL_SALT_SUGGESTIONS);
      const result = await handler(mockEvent, 'Para');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(['Para', 'Acet']);
    });
  });
});
