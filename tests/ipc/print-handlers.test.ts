import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../src/shared/ipc/channels';
import { registerBillHandlers } from '../../src/main/ipc/handlers/bill-handlers';

// Mock Services
vi.mock('../../src/main/services/billing-service');
vi.mock('../../src/main/services/print-service', () => {
  const mockInstance = {
    printBill: vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 100));
      return true;
    }),
  };
  return {
    PrintService: {
      getInstance: vi.fn(() => mockInstance),
    },
  };
});
vi.mock('../../src/main/services/license-service', () => ({
  LicenseService: vi.fn(() => ({
    getLicenseStatus: vi.fn(() => ({ isLocked: false })),
  })),
}));
vi.mock('../../src/main/services/settings-service', () => {
  const mockInstance = {
    getConfig: vi.fn(() => ({ autoPrint: false, printerName: 'Test Printer' })),
  };
  return {
    SettingsService: {
      getInstance: vi.fn(() => mockInstance),
    },
  };
});

// Mock IPC
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock Logger
vi.mock('../../src/main/utils/logger', () => ({
  logger: {
    forModule: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Print IPC Handlers - Detachment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerBillHandlers();
  });

  it('bill:print should acknowledge immediately even if print is slow', async () => {
    // 1. Find the bill:print handler
    const mockHandle = vi.mocked(ipcMain.handle);
    const printCall = mockHandle.mock.calls.find((call) => call[0] === 'bill:print');
    if (!printCall) {
      throw new Error('bill:print handler not registered');
    }

    const handlerWrapper = printCall[1] as (
      event: unknown,
      payload: { billId: number }
    ) => Promise<{ success: boolean }>;

    // 2. Measure execution time
    const start = Date.now();
    const result = await handlerWrapper({}, { billId: 1 });
    const duration = Date.now() - start;

    // Acknowledge should be fast (< 50ms) while print takes 100ms
    expect(duration).toBeLessThan(50);
    expect(result.success).toBe(true);
  });

  it('bill:reprint-last should acknowledge immediately', async () => {
    const mockHandle = vi.mocked(ipcMain.handle);
    const reprintCall = mockHandle.mock.calls.find(
      (call) => call[0] === IPC_CHANNELS.BILL_REPRINT_LAST
    );
    if (!reprintCall) {
      throw new Error('bill:reprint-last handler not registered');
    }

    const handlerWrapper = reprintCall[1] as (
      event: unknown,
      payload: unknown
    ) => Promise<{ success: boolean }>;

    const start = Date.now();
    const result = await handlerWrapper({}, {});
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(50);
    expect(result.success).toBe(true);
  });
});
