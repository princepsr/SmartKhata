import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ipcMain } from 'electron';
import { registerPurchaseOrderHandlers } from '../../src/main/ipc/handlers/purchase-order-handlers';
import { IPC_CHANNELS } from '../../src/shared/ipc/channels';

// Mock Electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock Service
const mockPoService = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  updateStatus: vi.fn(),
}));

vi.mock('../../src/main/services/purchase-order-service', () => ({
  PurchaseOrderService: vi.fn().mockImplementation(() => mockPoService),
}));

describe('Purchase Order IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerPurchaseOrderHandlers();
  });

  const getHandler = (channel: string) => {
    const call = vi.mocked(ipcMain.handle).mock.calls.find((c) => c[0] === channel);
    return call ? call[1] : null;
  };

  it('should register all PO handlers', () => {
    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.PO_LIST, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.PO_GET, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.PO_CREATE, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.PO_UPDATE, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.PO_CONVERT, expect.any(Function));
  });

  describe('PO_LIST', () => {
    it('should return success and data on success', async () => {
      const mockResult = { data: [], total: 0 };
      mockPoService.list.mockResolvedValue(mockResult);

      const handler = getHandler(IPC_CHANNELS.PO_LIST);
      const result = await handler({}, {});

      expect(result.success).toBe(true);
      expect(result.data).toBe(mockResult.data);
      expect(result.total).toBe(mockResult.total);
    });

    it('should return failure on error', async () => {
      mockPoService.list.mockRejectedValue(new Error('DB Error'));

      const handler = getHandler(IPC_CHANNELS.PO_LIST);
      const result = await handler({}, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB Error');
    });
  });

  describe('PO_CREATE', () => {
    it('should create a PO and return success', async () => {
      const mockPO = { id: 1, poNumber: 'PO-1' };
      mockPoService.create.mockResolvedValue(mockPO);

      const handler = getHandler(IPC_CHANNELS.PO_CREATE);
      const result = await handler({}, { supplierId: 1 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPO);
      expect(mockPoService.create).toHaveBeenCalledWith({ supplierId: 1 });
    });
  });

  describe('PO_UPDATE', () => {
    it('should update PO status', async () => {
      mockPoService.updateStatus.mockResolvedValue(true);

      const handler = getHandler(IPC_CHANNELS.PO_UPDATE);
      const result = await handler({}, { id: 1, status: 'RECEIVED' });

      expect(result.success).toBe(true);
      expect(mockPoService.updateStatus).toHaveBeenCalledWith(1, 'RECEIVED');
    });
  });
});
