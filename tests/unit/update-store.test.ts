import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateStatus } from '../../src/shared/types/update';
import { IPC_CHANNELS } from '../../src/shared/ipc/channels';

// Hoist the global mocks so they are ready before the store is imported
vi.hoisted(() => {
  (global as any).navigator = {
    onLine: true,
  };
  (global as any).window = {
    api: {
      invoke: vi.fn(),
    },
  };
});

// Import the store after hoisting mocks
import { useUpdateStore } from '../../src/renderer/store/useUpdateStore';

describe('useUpdateStore', () => {
  const mockInvoke = window.api.invoke as any;

  beforeEach(() => {
    vi.clearAllMocks();
    useUpdateStore.getState().resetUpdateState();
  });

  it('should initialize with IDLE status', () => {
    const state = useUpdateStore.getState();
    expect(state.status).toBe(UpdateStatus.IDLE);
    expect(state.error).toBeNull();
  });

  it('should handle checkConnectivity and update isOnline', async () => {
    mockInvoke.mockResolvedValueOnce({ success: true, data: true });

    const result = await useUpdateStore.getState().checkConnectivity();

    expect(result).toBe(true);
    expect(useUpdateStore.getState().isOnline).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.SYSTEM_CHECK_CONNECTIVITY);
  });

  it('should set error if checkForUpdates is called while offline', async () => {
    mockInvoke.mockResolvedValueOnce({ success: true, data: false }); // offline

    await useUpdateStore.getState().checkForUpdates();

    expect(useUpdateStore.getState().error).toContain('Internet connection required');
    expect(useUpdateStore.getState().status).not.toBe(UpdateStatus.CHECKING);
  });

  it('should call UPDATE_CHECK and set status if online', async () => {
    mockInvoke.mockResolvedValueOnce({ success: true, data: true }); // online
    mockInvoke.mockResolvedValueOnce({ success: true }); // update check trigger

    await useUpdateStore.getState().checkForUpdates();

    expect(useUpdateStore.getState().status).toBe(UpdateStatus.CHECKING);
    expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.UPDATE_CHECK);
  });
});
