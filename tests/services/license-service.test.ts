/**
 * LicenseService Tests
 * 
 * Tests for license validation, activation, and expiry checking.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LicenseService } from '../../src/main/services/license-service';
import { LicenseRepository } from '../../src/main/repositories/license-repository';
import { createTestDatabase, resetTestDatabase } from '../utils/test-db';
import { LicenseError, ValidationError } from '../../src/main/services/errors/service-errors';
import type Database from 'better-sqlite3';

describe('LicenseService - Trial License', () => {
  let db: Database.Database;
  let licenseService: LicenseService;

  beforeEach(() => {
    db = createTestDatabase();
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
  let db: Database.Database;
  let licenseService: LicenseService;

  beforeEach(() => {
    db = createTestDatabase();
    licenseService = new LicenseService();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  it('should return invalid for no license', () => {
    const validation = licenseService.isLicenseValid();
    
    expect(validation.isValid).toBe(false);
    expect(validation.reason).toBe('No license found');
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

  it('should deactivate license', () => {
    const trialKey = licenseService.generateTrialLicense(30);
    licenseService.activateLicense({ licenseKey: trialKey });

    licenseService.deactivateLicense();

    const validation = licenseService.isLicenseValid();
    expect(validation.isValid).toBe(false);
  });

  it('should get license info', () => {
    const trialKey = licenseService.generateTrialLicense(30);
    licenseService.activateLicense({ licenseKey: trialKey });

    const info = licenseService.getLicenseInfo();
    
    expect(info.activated).toBe(true);
    expect(info.expiresAt).toBeDefined();
    expect(info.daysRemaining).toBeGreaterThan(29);
    expect(info.machineFingerprint).toBeDefined();
  });
});

describe('LicenseService - Machine Fingerprint', () => {
  let db: Database.Database;
  let licenseService: LicenseService;

  beforeEach(() => {
    db = createTestDatabase();
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
    
    expect(info.machineFingerprint).toBeDefined();
    expect(typeof info.machineFingerprint).toBe('string');
    expect(info.machineFingerprint.length).toBe(32); // SHA-256 hash (32 chars)
  });
});
