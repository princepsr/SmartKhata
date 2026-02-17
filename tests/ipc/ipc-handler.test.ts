import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ipcMain } from 'electron';
import { IPCHandler } from '../../src/main/ipc/ipc-handler';
import { IPC_CHANNELS } from '../../src/shared/ipc/channels';

// Mock Electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock Logger
vi.mock('../../src/main/utils/logger', () => ({
  logger: {
    forModule: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('IPCHandler - Timeout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should timeout if handler takes too long', async () => {
    // 1. Register a slow handler
    const slowHandler = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { success: true };
    };

    // Use a valid channel from IPC_CHANNELS
    IPCHandler.handle(IPC_CHANNELS.APP_VERSION, slowHandler, { timeout: 100 });

    // 2. Get the registered wrapper
    const registeredWrapper = (vi.mocked(ipcMain.handle).mock.calls[0] as any[])[1];

    // 3. Execute wrapper (simulate IPC call)
    const response = await (registeredWrapper as any)({}, {});

    expect(response.success).toBe(false);
    expect(response.error).toContain('timeout');
  });

  it('should succeed if handler completes within timeout', async () => {
    const fastHandler = async () => ({ success: true });

    IPCHandler.handle(IPC_CHANNELS.APP_VERSION, fastHandler, { timeout: 1000 });

    const registeredWrapper = (vi.mocked(ipcMain.handle).mock.calls[0] as any[])[1];
    const response = await (registeredWrapper as any)({}, {});

    expect(response.success).toBe(true);
  });
});
