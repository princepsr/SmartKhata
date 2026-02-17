import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StabilityService } from '../../src/main/services/stability-service';
import { BrowserWindow } from 'electron';

// Mock Electron and Logger
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
  app: {
    getPath: vi.fn(() => 'test-path'),
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
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../utils/shutdown-manager', () => ({
  shutdownManager: {
    registerHook: vi.fn(),
  },
  ShutdownPriority: {
    NORMAL: 100,
    HIGH: 200,
    CRITICAL: 300,
  },
}));

describe('StabilityService', () => {
  let service: StabilityService;

  beforeEach(() => {
    vi.useFakeTimers();
    // Reset singleton for testing
    (StabilityService as any).instance = undefined;
    service = StabilityService.getInstance();
  });

  afterEach(() => {
    service.stopMonitoring();
    vi.useRealTimers();
  });

  it('should start and stop monitoring', () => {
    service.startMonitoring(1000);
    expect((service as any).monitorInterval).toBeDefined();

    service.stopMonitoring();
    expect((service as any).monitorInterval).toBeNull();
  });

  it('should log health stats periodically', () => {
    const logSpy = vi.spyOn(service, 'logHealthStats');

    service.startMonitoring(1000);

    vi.advanceTimersByTime(1001);
    expect(logSpy).toHaveBeenCalled();
  });

  it('should track and untrack windows', () => {
    const mockWindow = {
      on: vi.fn(),
      isDestroyed: vi.fn(() => false),
      destroy: vi.fn(),
    } as any;

    service.trackWindow(mockWindow);
    expect((service as any).trackedWindows.has(mockWindow)).toBe(true);

    // Simulate window close
    const closeCallback = mockWindow.on.mock.calls.find((call: any) => call[0] === 'closed')[1];
    closeCallback();

    expect((service as any).trackedWindows.has(mockWindow)).toBe(false);
  });

  it('should cleanup tracked windows on shutdown', async () => {
    const mockWindow = {
      on: vi.fn(),
      isDestroyed: vi.fn(() => false),
      destroy: vi.fn(),
    } as any;

    service.trackWindow(mockWindow);

    // Call private cleanup via any
    (service as any).cleanup();

    expect(mockWindow.destroy).toHaveBeenCalled();
  });
});
