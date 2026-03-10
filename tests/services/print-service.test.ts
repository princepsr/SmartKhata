import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserWindow } from 'electron';
import { PrintService } from '../../src/main/services/print-service';
import { BillWithItems } from '@shared/types/ipc';

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

interface PrintServicePrivates extends PrintService {
  _getPaperWidth: (size: string) => string;
  _getPrintWindow: () => BrowserWindow;
}

interface PrintServiceStatic {
  instance: PrintService | undefined;
  poolWindow: BrowserWindow | null;
  isPrinting: boolean;
}

describe('PrintService - Core Logic', () => {
  let service: PrintService;
  let servicePriv: PrintServicePrivates;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Reset singleton and static state for clean tests
    const staticService = PrintService as unknown as PrintServiceStatic;
    staticService.instance = undefined;
    staticService.poolWindow = null;
    staticService.isPrinting = false;
    
    service = PrintService.getInstance();
    servicePriv = service as unknown as PrintServicePrivates;

    // Reset mock config to defaults
    mockConfig.printCopies = 1;
    mockConfig.paperSize = '58mm';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should calculate correct paper width', () => {
    expect(servicePriv._getPaperWidth('58mm')).toBe('54mm');
    expect(servicePriv._getPaperWidth('80mm')).toBe('78mm');
  });

  it('should use window pooling', () => {
    const win1 = servicePriv._getPrintWindow();
    const win2 = servicePriv._getPrintWindow();
    expect(win1).toBe(win2);
    expect(BrowserWindow).toHaveBeenCalledTimes(1);
  });

  it('should handle multi-copy printing with delays', async () => {
    const mockBill = {
      bill: {
        id: 1,
        billNumber: '123',
        subtotal: 100,
        gstTotal: 18,
        grandTotal: 118,
        discountAmount: 0,
        paymentMode: 'cash',
        createdAt: new Date().toISOString(),
        customerName: 'Test',
        customerPhone: '123',
        paymentStatus: 'PAID',
        itemsCount: 1
      },
      items: [{ productId: 1, productNameSnapshot: 'Item 1', quantity: 1, unitPrice: 100, lineTotal: 100, gstPercent: 18 }],
    } as unknown as BillWithItems;
    mockConfig.printCopies = 2;

    const printPromise = service.printBill(mockBill);

    // Process all steps: loadURL (async), layout delay (500ms), copy 1 print (50ms), gap (500ms), copy 2 print (50ms)
    await vi.advanceTimersByTimeAsync(1500);

    const result = await printPromise;
    expect(result).toBe(true);

    const poolWindow = (PrintService as unknown as PrintServiceStatic).poolWindow;
    expect(poolWindow?.webContents.print).toHaveBeenCalledTimes(2);
  });

  it('should respect isPrinting lock', async () => {
    const mockBill = {
      bill: {
        id: 1,
        billNumber: '123',
        subtotal: 100,
        gstTotal: 18,
        grandTotal: 118,
        discountAmount: 0,
        paymentMode: 'cash',
        createdAt: new Date().toISOString(),
        customerName: 'Test',
        customerPhone: '123',
        paymentStatus: 'PAID',
        itemsCount: 1
      },
      items: [{ productId: 1, productNameSnapshot: 'Item 1', quantity: 1, unitPrice: 100, lineTotal: 100, gstPercent: 18 }],
    } as unknown as BillWithItems;

    // Start first print
    const p1 = service.printBill(mockBill);

    // Attempt second print immediately - should fail with busy error
    await expect(service.printBill(mockBill)).rejects.toThrow('Printer is busy with another job');

    // Cleanup first print
    await vi.runAllTimersAsync();
    await p1;
  });

  it('should fail if window is destroyed during printing', async () => {
    const mockBill = {
      bill: { billNumber: '123' },
      items: [],
    } as unknown as BillWithItems;
    const poolWindow = servicePriv._getPrintWindow();

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
