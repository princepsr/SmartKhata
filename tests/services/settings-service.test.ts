import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SettingsService } from '../../src/main/services/settings-service';
import { SettingsRepository, AppConfig } from '../../src/main/repositories/settings-repository';
import { ValidationError } from '../../src/main/services/errors/service-errors';

// Mock Dependencies
vi.mock('../../src/main/repositories/settings-repository');
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

describe('SettingsService - Printer Config', () => {
  let service: SettingsService;
  let mockRepo: any; // We'll use any here for the mock prototype to allow mock access

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance for testing
    (SettingsService as any).instance = undefined;
    service = SettingsService.getInstance();
    mockRepo = SettingsRepository.prototype as unknown as {
      updateConfig: any;
      getConfig: any;
    };
  });

  it('should validate printCopies (must be between 1 and 5)', () => {
    const validConfig = { printCopies: 3 };
    const lowConfig = { printCopies: 0 };
    const highConfig = { printCopies: 6 };

    expect(() => (service as any)._validateConfig(validConfig)).not.toThrow();
    expect(() => (service as any)._validateConfig(lowConfig)).toThrow(ValidationError);
    expect(() => (service as any)._validateConfig(highConfig)).toThrow(ValidationError);
  });

  it('should validate autoPrint as boolean', () => {
    const validConfig = { autoPrint: true };
    const invalidConfig = { autoPrint: 'true' as any };

    expect(() => (service as any)._validateConfig(validConfig)).not.toThrow();
    expect(() => (service as any)._validateConfig(invalidConfig)).toThrow(ValidationError);
  });

  it('should validate paperSize (58mm or 80mm)', () => {
    const valid58 = { paperSize: '58mm' };
    const valid80 = { paperSize: '80mm' };
    const invalid = { paperSize: 'A4' };

    expect(() => (service as any)._validateConfig(valid58)).not.toThrow();
    expect(() => (service as any)._validateConfig(valid80)).not.toThrow();
    expect(() => (service as any)._validateConfig(invalid)).toThrow(ValidationError);
  });

  it('should update configuration successfully when valid', async () => {
    const newConfig: Partial<AppConfig> = {
      printCopies: 2,
      autoPrint: true,
      paperSize: '80mm',
    };

    // Mock repo to return valid config on reload
    mockRepo.updateConfig.mockReturnValue(true);
    mockRepo.getConfig.mockReturnValue({
      shopName: 'Test Shop',
      gstPercentage: 18,
      paperSize: '80mm',
      printCopies: 2,
      autoPrint: true,
      gstEnabled: true,
    });

    service.updateConfig(newConfig);

    expect(mockRepo.updateConfig).toHaveBeenCalled();
    const cachedConfig = service.getConfig();
    expect(cachedConfig.printCopies).toBe(2);
    expect(cachedConfig.autoPrint).toBe(true);
    expect(cachedConfig.paperSize).toBe('80mm');
  });
});
