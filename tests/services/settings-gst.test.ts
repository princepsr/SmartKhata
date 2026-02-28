import { describe, it, expect, vi } from 'vitest';
import { SettingsService } from '../../src/main/services/settings-service';
import type { AppConfig } from '../../src/main/repositories/settings-repository';

/**
 * Settings Service GST validation tests.
 * Tests validation of stateCode, supplyType, and GSTIN.
 */

// Mock logger to suppress output in tests
vi.mock('../../src/main/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Interface to access private methods for testing
interface SettingsServicePrivate {
  _validateConfig(config: Partial<AppConfig>): void;
}

describe('SettingsService GST field validation', () => {
  // SettingsService constructor takes 0 arguments
  const svc = new SettingsService();
  const privateSvc = svc as unknown as SettingsServicePrivate;

  it('should reject invalid stateCode (longer than 2 chars)', () => {
    expect(() => privateSvc._validateConfig({ stateCode: '271' })).toThrow(
      'State code must be a 2-digit number'
    );
  });

  it('should accept valid 2-digit stateCode', () => {
    expect(() => privateSvc._validateConfig({ stateCode: '27' })).not.toThrow();
  });

  it('should reject invalid supplyType value', () => {
    expect(() =>
      privateSvc._validateConfig({
        supplyType: 'foreign' as unknown as 'intrastate',
      })
    ).toThrow('Supply type must be intrastate or interstate');
  });

  it('should accept valid supplyType values', () => {
    expect(() => privateSvc._validateConfig({ supplyType: 'intrastate' })).not.toThrow();
    expect(() => privateSvc._validateConfig({ supplyType: 'interstate' })).not.toThrow();
  });

  it('should reject GSTIN of wrong length', () => {
    expect(() => privateSvc._validateConfig({ gstNumber: '12ABCDE1234F1Z' })).toThrow(
      'GST number must be 15 alphanumeric characters'
    );
  });

  it('should accept valid 15-char GSTIN', () => {
    expect(() => privateSvc._validateConfig({ gstNumber: '27AAPFU0939F1ZV' })).not.toThrow();
  });
});
