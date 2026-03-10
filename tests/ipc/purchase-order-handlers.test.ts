import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
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
  update: vi.fn(),
  updateStatus: vi.fn(),
}));

vi.mock('../../src/main/services/purchase-order-service', () => ({
  PurchaseOrderService: vi.fn().mockImplementation(() => mockPoService),
}));

type HandlerFn = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<{ success: boolean; data?: unknown; error?: string }>;

describe('Purchase Order IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerPurchaseOrderHandlers();
  });

  const getHandler = (channel: string): HandlerFn => {
    const call = vi.mocked(ipcMain.handle).mock.calls.find((c) => c[0] === channel);
    if (!call) {
      throw new Error(`Handler not registered for ${channel}`);
    }
    return call[1] as HandlerFn;
  };

  const mockEvent = {} as IpcMainInvokeEvent;

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
      const result = await handler(mockEvent, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
    });

    it('should return failure on error', async () => {
      mockPoService.list.mockRejectedValue(new Error('DB Error'));

      const handler = getHandler(IPC_CHANNELS.PO_LIST);
      const result = await handler(mockEvent, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB Error');
    });
  });

  describe('PO_CREATE', () => {
    it('should create a PO and return success', async () => {
      const mockPO = { id: 1, poNumber: 'PO-1' };
      mockPoService.create.mockResolvedValue(mockPO);

      const handler = getHandler(IPC_CHANNELS.PO_CREATE);
      const result = await handler(mockEvent, { supplierId: 1 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPO);
      expect(mockPoService.create).toHaveBeenCalledWith({ supplierId: 1 });
    });
  });

  describe('PO_UPDATE', () => {
    it('should update PO and return success', async () => {
      const updatedPO = { id: 1, notes: 'Updated' };
      mockPoService.update.mockResolvedValue(updatedPO);

      const handler = getHandler(IPC_CHANNELS.PO_UPDATE);
      const result = await handler(mockEvent, { id: 1, data: { notes: 'Updated' } });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedPO);
      expect(mockPoService.update).toHaveBeenCalledWith(1, { notes: 'Updated' });
    });
  });

  describe('PO_CONVERT', () => {
    it('should convert PO and return success', async () => {
      mockPoService.updateStatus.mockResolvedValue(true);

      const handler = getHandler(IPC_CHANNELS.PO_CONVERT);
      const result = await handler(mockEvent, 1);

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(mockPoService.updateStatus).toHaveBeenCalledWith(1, 'RECEIVED');
    });
  });
});
