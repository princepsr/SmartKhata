import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserWindow } from 'electron';
import { PrintService } from '../../src/main/services/print-service';

// Mock Electron
vi.mock('electron', () => {
  const mockWindow = {
    loadURL: vi.fn().mockResolvedValue(undefined),
    isDestroyed: vi.fn(() => false),
    destroy: vi.fn(),
    webContents: {
      print: vi.fn((_options, callback) => {
        // Make it async so lock stays active
        setTimeout(() => callback(true), 50);
      }),
    },
  };
  return {
    app: {
      getAppPath: vi.fn(() => 'test-path'),
      isPackaged: false,
    },
    BrowserWindow: vi.fn(() => mockWindow),
    dialog: {
      showSaveDialog: vi.fn().mockResolvedValue({ filePath: 'test.pdf' }),
    },
  };
});

// Mock Dependencies
interface MockConfig {
  printerName: string;
  paperSize: '58mm' | '80mm';
  printCopies: number;
  autoPrint: boolean;
  shopName: string;
}

const mockConfig: MockConfig = {
  printerName: 'Test Printer',
  paperSize: '58mm',
  printCopies: 1,
  autoPrint: false,
  shopName: 'Test Shop',
};

vi.mock('../../src/main/services/settings-service', () => ({
  SettingsService: {
    getInstance: vi.fn(() => ({
      getConfig: vi.fn(() => mockConfig),
    })),
  },
}));

vi.mock('../../src/main/services/billing-service');

vi.mock('../../src/main/utils/logger', () => ({
  logger: {
    forModule: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

vi.mock('../../src/main/services/stability-service', () => ({
  StabilityService: {
    getInstance: vi.fn(() => ({
      trackWindow: vi.fn(),
    })),
  },
}));

describe('PrintService - Core Logic', () => {
  let service: PrintService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset singleton and static state for clean tests
    /* eslint-disable @typescript-eslint/no-explicit-any */
    (PrintService as any).instance = undefined;
    (PrintService as any).poolWindow = null;
    (PrintService as any).isPrinting = false;
    service = PrintService.getInstance();
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // Reset mock config to defaults
    mockConfig.printCopies = 1;
    mockConfig.paperSize = '58mm';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should calculate correct paper width', () => {
    expect((service as any)._getPaperWidth('58mm')).toBe('54mm');
    expect((service as any)._getPaperWidth('80mm')).toBe('78mm');
  });

  it('should use window pooling', () => {
    const win1 = (service as any)._getPrintWindow();
    const win2 = (service as any)._getPrintWindow();
    expect(win1).toBe(win2);
    expect(BrowserWindow).toHaveBeenCalledTimes(1);
  });

  it('should handle multi-copy printing with delays', async () => {
    const mockBill = {
      bill: {
        billNumber: '123',
        subtotal: 100,
        gstTotal: 18,
        grandTotal: 118,
        discountAmount: 0,
        paymentMode: 'cash',
        createdAt: new Date().toISOString(),
      },
      items: [{ productNameSnapshot: 'Item 1', quantity: 1, unitPrice: 100, lineTotal: 100 }],
    } as any;
    mockConfig.printCopies = 2;

    const printPromise = service.printBill(mockBill);

    // Process all steps: loadURL (async), layout delay (500ms), copy 1 print (50ms), gap (500ms), copy 2 print (50ms)
    await vi.advanceTimersByTimeAsync(1500);

    const result = await printPromise;
    expect(result).toBe(true);

    const poolWindow = (PrintService as any).poolWindow;
    expect(poolWindow.webContents.print).toHaveBeenCalledTimes(2);
  });

  it('should respect isPrinting lock', async () => {
    const mockBill = {
      bill: {
        billNumber: '123',
        subtotal: 100,
        gstTotal: 18,
        grandTotal: 118,
        discountAmount: 0,
        paymentMode: 'cash',
        createdAt: new Date().toISOString(),
      },
      items: [],
    } as any;

    // Start first print
    const p1 = service.printBill(mockBill);

    // Advance slightly to ensure we are inside the try block but not finished
    await vi.advanceTimersByTimeAsync(10);

    // Attempt second print immediately - should fail with busy error
    await expect(service.printBill(mockBill)).rejects.toThrow('Printer is busy with another job');

    // Cleanup first print
    await vi.runAllTimersAsync();
    await p1;
  });

  it('should fail if window is destroyed during printing', async () => {
    const mockBill = {
      bill: {
        billNumber: '123',
        subtotal: 100,
        gstTotal: 18,
        grandTotal: 118,
        discountAmount: 0,
        paymentMode: 'cash',
        createdAt: new Date().toISOString(),
      },
      items: [],
    } as any;
    const poolWindow = (service as any)._getPrintWindow();

    const p1 = service.printBill(mockBill);
    p1.catch(() => {}); // Prevent unhandled rejection during timer advancement

    // Advance to layout
    await vi.advanceTimersByTimeAsync(50);

    // Simulate destruction
    vi.mocked(poolWindow.isDestroyed).mockReturnValue(true);

    await vi.runAllTimersAsync();
    await expect(p1).rejects.toThrow();
  });
});
