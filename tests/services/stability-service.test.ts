import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from 'vitest';
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

interface StabilityServiceWithPrivates extends StabilityService {
  instance: StabilityService | undefined;
  monitorInterval: NodeJS.Timeout | null;
  trackedWindows: Set<BrowserWindow>;
  cleanup: () => void;
}

describe('StabilityService', () => {
  let service: StabilityService;
  let servicePriv: StabilityServiceWithPrivates;

  beforeEach(() => {
    vi.useFakeTimers();
    // Reset singleton for testing
    (StabilityService as unknown as StabilityServiceWithPrivates).instance = undefined;
    service = StabilityService.getInstance();
    servicePriv = service as unknown as StabilityServiceWithPrivates;
  });

  afterEach(() => {
    service.stopMonitoring();
    vi.useRealTimers();
  });

  it('should start and stop monitoring', () => {
    service.startMonitoring(1000);
    expect(servicePriv.monitorInterval).toBeDefined();

    service.stopMonitoring();
    expect(servicePriv.monitorInterval).toBeNull();
  });

  it('should log health stats periodically', () => {
    const logSpy = vi.spyOn(service, 'logHealthStats' as never);

    service.startMonitoring(1000);

    vi.advanceTimersByTime(1001);
    expect(logSpy).toHaveBeenCalled();
  });

  it('should track and untrack windows', () => {
    const mockWindow = {
      on: vi.fn(),
      isDestroyed: vi.fn(() => false),
      destroy: vi.fn(),
    } as unknown as BrowserWindow;

    service.trackWindow(mockWindow);
    expect(servicePriv.trackedWindows.has(mockWindow)).toBe(true);

    // Simulate window close
    const onMock = mockWindow.on as unknown as Mock<[string, () => void], void>;
    const closeCall = onMock.mock.calls.find(
      (call: [string, () => void]) => call[0] === 'closed'
    );
    const closeCallback = closeCall?.[1];
    if (closeCallback) {
      closeCallback();
    }

    expect(servicePriv.trackedWindows.has(mockWindow)).toBe(false);
  });

  it('should cleanup tracked windows on shutdown', async () => {
    const mockWindow = {
      on: vi.fn(),
      isDestroyed: vi.fn(() => false),
      destroy: vi.fn(),
    } as unknown as BrowserWindow;

    service.trackWindow(mockWindow);

    // Call private cleanup
    servicePriv.cleanup();

    expect(mockWindow.destroy).toHaveBeenCalled();
  });
});
