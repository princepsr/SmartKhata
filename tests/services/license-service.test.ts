/**
 * LicenseService Tests
 *
 * Tests for license validation, activation, and expiry checking.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LicenseService } from '../../src/main/services/license-service';
import { createTestDatabase, resetTestDatabase } from '../utils/test-db';
import { LicenseError, ValidationError } from '../../src/main/services/errors/service-errors';

describe('LicenseService - Trial License', () => {
  let db: any;
  let licenseService: LicenseService;

  beforeEach(async () => {
    db = await createTestDatabase();
    licenseService = new LicenseService();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  it('should generate trial license', () => {
    const trialKey = licenseService.generateTrialLicense(30);

    expect(trialKey).toBeDefined();
    expect(typeof trialKey).toBe('string');
    expect(trialKey.length).toBeGreaterThan(0);
  });

  it('should activate trial license', () => {
    const trialKey = licenseService.generateTrialLicense(30);

    expect(() => {
      licenseService.activateLicense({ licenseKey: trialKey });
    }).not.toThrow();
  });

  it('should validate activated license', () => {
    const trialKey = licenseService.generateTrialLicense(30);
    licenseService.activateLicense({ licenseKey: trialKey });

    const validation = licenseService.isLicenseValid();

    expect(validation.isValid).toBe(true);
    expect(validation.daysRemaining).toBeGreaterThan(29);
  });

  it('should reject expired license', () => {
    const expiredKey = licenseService.generateTrialLicense(-1); // Expired yesterday

    expect(() => {
      licenseService.activateLicense({ licenseKey: expiredKey });
    }).toThrow(LicenseError);
  });

  it('should detect expiring soon', () => {
    const key = licenseService.generateTrialLicense(5);
    licenseService.activateLicense({ licenseKey: key });

    expect(licenseService.isExpiringSoon(7)).toBe(true);
    expect(licenseService.isExpiringSoon(3)).toBe(false);
  });
});

describe('LicenseService - Validation', () => {
  let db: any;
  let licenseService: LicenseService;

  beforeEach(async () => {
    db = await createTestDatabase();
    licenseService = new LicenseService();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  it('should initialize and return valid trial for no license', () => {
    const validation = licenseService.isLicenseValid();

    expect(validation.isValid).toBe(true);
    expect(validation.type).toBe('TRIAL');
    expect(validation.daysRemaining).toBeGreaterThan(29);
  });

  it('should throw error for empty license key', () => {
    expect(() => {
      licenseService.activateLicense({ licenseKey: '' });
    }).toThrow(ValidationError);
  });

  it('should throw error for invalid license format', () => {
    expect(() => {
      licenseService.activateLicense({ licenseKey: 'INVALID_KEY' });
    }).toThrow(LicenseError);
  });

  it('should deactivate license and fall back to trial', () => {
    const trialKey = licenseService.generateTrialLicense(30);
    licenseService.activateLicense({ licenseKey: trialKey });

    licenseService.deactivateLicense();

    const validation = licenseService.isLicenseValid();
    expect(validation.isValid).toBe(true);
    expect(validation.type).toBe('TRIAL');
  });

  it('should get license info', () => {
    const trialKey = licenseService.generateTrialLicense(30);
    licenseService.activateLicense({ licenseKey: trialKey });

    const info = licenseService.getLicenseInfo();

    expect(info.activated).toBe(true);
    expect(info.expiresOn).toBeDefined();
    expect(info.daysRemaining).toBeGreaterThan(29);
    expect(info.deviceId).toBeDefined();
    expect(info.type).toBe('PAID');
  });
});

describe('LicenseService - Machine Fingerprint', () => {
  let db: any;
  let licenseService: LicenseService;

  beforeEach(async () => {
    db = await createTestDatabase();
    licenseService = new LicenseService();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  it('should validate machine fingerprint', () => {
    const trialKey = licenseService.generateTrialLicense(30);
    licenseService.activateLicense({ licenseKey: trialKey });

    const validation = licenseService.isLicenseValid();

    // Should be valid on same machine
    expect(validation.isValid).toBe(true);
  });

  it('should include machine fingerprint in license info', () => {
    const info = licenseService.getLicenseInfo();

    expect(info.deviceId).toBeDefined();
    expect(typeof info.deviceId).toBe('string');
    expect(info.deviceId.length).toBe(32); // SHA-256 hash (32 chars)
  });

  it('should validate and activate short KRN key', () => {
    // 1. Get local device ID
    const deviceId = (licenseService as any)._getMachineFingerprint();
    const expiryDays = 365; // ~1 year from 2026-01-01

    // 2. Mock generation logic (same as in generator script)
    const deviceHashID = (licenseService as any)._getTruncatedHash(deviceId, 22);
    const signature = (licenseService as any)._generateShortSignature(expiryDays, deviceHashID);
    const bits = (BigInt(expiryDays) << 46n) | (BigInt(deviceHashID) << 24n) | BigInt(signature);
    const rawKey = (licenseService as any)._encodeBase32(bits, 12);
    const key = `KRN-${rawKey.substring(0, 4)}-${rawKey.substring(4, 8)}-${rawKey.substring(8, 12)}`;

    // 3. Activate
    expect(() => {
      licenseService.activateLicense({ licenseKey: key });
    }).not.toThrow();

    const status = licenseService.getLicenseStatus();
    expect(status.type).toBe('PAID');
    expect(status.activated).toBe(true);
  });
});
