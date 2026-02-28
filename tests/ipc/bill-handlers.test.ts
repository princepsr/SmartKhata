import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ipcMain } from 'electron';
import { registerBillHandlers } from '../../src/main/ipc/handlers/bill-handlers';
import { IPC_CHANNELS } from '../../src/shared/ipc/channels';

// Mock Electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock Services
const mockBillingService = vi.hoisted(() => ({
  calculateBill: vi.fn(),
  finalizeBill: vi.fn(),
  generateBillNumber: vi.fn(),
  getLastBill: vi.fn(),
}));

const mockPrintService = vi.hoisted(() => ({
  printBill: vi.fn(),
  getPrinters: vi.fn(),
  testPrint: vi.fn(),
}));

const mockLicenseService = vi.hoisted(() => ({
  getLicenseStatus: vi.fn(),
}));

const mockSettingsService = vi.hoisted(() => ({
  getConfig: vi.fn(),
}));

const mockBillRepo = vi.hoisted(() => ({
  findByBillNumberWithItems: vi.fn(),
  findByDateRange: vi.fn(),
  findToday: vi.fn(),
  getSalesSummary: vi.fn(),
}));

vi.mock('../../src/main/services/billing-service', () => ({
  BillingService: vi.fn().mockImplementation(() => mockBillingService),
}));

vi.mock('../../src/main/services/print-service', () => ({
  PrintService: {
    getInstance: vi.fn().mockReturnValue(mockPrintService),
  },
}));

vi.mock('../../src/main/services/license-service', () => ({
  LicenseService: vi.fn().mockImplementation(() => mockLicenseService),
}));

vi.mock('../../src/main/services/settings-service', () => ({
  SettingsService: vi.fn().mockImplementation(() => mockSettingsService),
}));

vi.mock('../../src/main/repositories/bill-repository', () => ({
  BillRepository: vi.fn().mockImplementation(() => mockBillRepo),
}));

describe('Bill IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLicenseService.getLicenseStatus.mockReturnValue({ isLocked: false });
    mockSettingsService.getConfig.mockReturnValue({ autoPrint: false });
    registerBillHandlers();
  });

  const getHandler = (channel: string): Function => {
    const call = vi.mocked(ipcMain.handle).mock.calls.find((c) => c[0] === channel);
    if (!call) {
      throw new Error(`Handler not registered for ${channel}`);
    }
    return call[1];
  };

  const mockEvent = {} as any;

  it('should register core billing handlers', () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('bill:create', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('bill:calculate', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('bill:get', expect.any(Function));
  });

  describe('bill:create', () => {
    it('should create a bill and return success', async () => {
      const mockResult = {
        bill: { id: 1, billNumber: 'B1', customerName: 'Test', createdAt: new Date() },
        items: [],
      };
      mockBillingService.finalizeBill.mockResolvedValue(mockResult);

      const handler = getHandler('bill:create');
      const result = await handler(mockEvent, { items: [] });

      expect(result.success).toBe(true);
      expect(result.data.bill.id).toBe(1);
      expect(mockBillingService.finalizeBill).toHaveBeenCalled();
    });

    it('should fail if license is locked', async () => {
      mockLicenseService.getLicenseStatus.mockReturnValue({ isLocked: true });

      const handler = getHandler('bill:create');
      const result = await handler(mockEvent, { items: [] });

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });
  });

  describe('bill:get', () => {
    it('should return bill data if found', async () => {
      const mockBill = {
        bill: { id: 1, billNumber: 'B1', createdAt: new Date() },
        items: [],
      };
      mockBillRepo.findByBillNumberWithItems.mockReturnValue(mockBill);

      const handler = getHandler('bill:get');
      const result = await handler(mockEvent, 'B1');

      expect(result.success).toBe(true);
      expect(result.data.bill.billNumber).toBe('B1');
    });

    it('should return error if bill not found', async () => {
      mockBillRepo.findByBillNumberWithItems.mockReturnValue(null);

      const handler = getHandler('bill:get');
      const result = await handler(mockEvent, 'B1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bill not found');
    });
  });
});
