import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsService } from '../../src/main/services/settings-service';

const { mockSettingsRepo } = vi.hoisted(() => {
  return {
    mockSettingsRepo: {
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
    },
  };
});

vi.mock('../../src/main/repositories/settings-repository', () => ({
  SettingsRepository: vi.fn().mockImplementation(() => mockSettingsRepo),
}));

vi.mock('../../src/main/utils/logger', () => ({
  logger: {
    forModule: () => ({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    }),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    (SettingsService as any).instance = undefined;
    service = SettingsService.getInstance();
  });

  describe('validation', () => {
    it('should validate hourly interval range (1-24)', () => {
      mockSettingsRepo.getConfig.mockReturnValue({
        autoBackupIntervalUnit: 'hours',
      });

      // Valid
      expect(() =>
        service.updateConfig({ autoBackupIntervalDays: 12, autoBackupIntervalUnit: 'hours' })
      ).not.toThrow();

      // Invalid
      expect(() =>
        service.updateConfig({ autoBackupIntervalDays: 0, autoBackupIntervalUnit: 'hours' })
      ).toThrow(/between 1 and 24/);

      expect(() =>
        service.updateConfig({ autoBackupIntervalDays: 25, autoBackupIntervalUnit: 'hours' })
      ).toThrow(/between 1 and 24/);
    });

    it('should validate daily interval range (1-30)', () => {
      mockSettingsRepo.getConfig.mockReturnValue({
        autoBackupIntervalUnit: 'days',
      });

      // Valid
      expect(() =>
        service.updateConfig({ autoBackupIntervalDays: 15, autoBackupIntervalUnit: 'days' })
      ).not.toThrow();

      // Invalid
      expect(() =>
        service.updateConfig({ autoBackupIntervalDays: 31, autoBackupIntervalUnit: 'days' })
      ).toThrow(/between 1 and 30/);
    });

    it('should validate retention count (1-50)', () => {
      expect(() => service.updateConfig({ autoBackupRetainCount: 10 })).not.toThrow();
      expect(() => service.updateConfig({ autoBackupRetainCount: 51 })).toThrow(/between 1 and 50/);
      expect(() => service.updateConfig({ autoBackupRetainCount: 0 })).toThrow(/between 1 and 50/);
    });
  });

  describe('configuration', () => {
    it('should emit settings-changed event on update', () => {
      const callback = vi.fn();
      service.onChange(callback);

      const newConfig = { shopName: 'New Shop' };
      mockSettingsRepo.getConfig.mockReturnValue({ ...newConfig });

      service.updateConfig(newConfig);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining(newConfig));
    });
  });
});
