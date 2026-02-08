/**
 * License Service
 * 
 * Offline-first license validation and enforcement.
 * Validates license expiry and machine binding.
 */

import { BaseService } from './base-service';
import { LicenseRepository, SaveLicenseInput } from '../repositories/license-repository';
import { LicenseError, ValidationError } from './errors/service-errors';
import * as crypto from 'crypto';
import * as os from 'os';

/**
 * License Activation Input
 */
export interface ActivateLicenseInput {
  licenseKey: string;
}

/**
 * License Validation Result
 */
export interface LicenseValidationResult {
  isValid: boolean;
  reason?: string;
  expiresAt?: Date;
  daysRemaining?: number;
}

/**
 * License Service
 */
export class LicenseService extends BaseService {
  private licenseRepo: LicenseRepository;
  private readonly SECRET_KEY = 'SMARTKHATA_LICENSE_SECRET_2026'; // In production, use env variable

  constructor() {
    super();
    this.licenseRepo = new LicenseRepository();
  }

  /**
   * Activate license
   * 
   * Validates license key, checks machine fingerprint, and saves to database.
   * 
   * @param input - License activation input
   */
  public activateLicense(input: ActivateLicenseInput): void {
    // 1. Validate license key format
    if (!input.licenseKey || input.licenseKey.trim() === '') {
      throw new ValidationError('License key is required', 'licenseKey');
    }

    // 2. Decode and validate license
    const decoded = this._decodeLicenseKey(input.licenseKey);

    // 3. Verify signature
    if (!this._verifySignature(decoded.payload, decoded.signature)) {
      throw new LicenseError('Invalid license key signature', 'INVALID_SIGNATURE');
    }

    // 4. Parse license data
    const licenseData = JSON.parse(decoded.payload);

    // 5. Validate expiry date
    const expiresAt = new Date(licenseData.expiresAt);
    if (isNaN(expiresAt.getTime())) {
      throw new LicenseError('Invalid expiry date in license', 'INVALID_EXPIRY');
    }

    if (expiresAt < new Date()) {
      throw new LicenseError('License has expired', 'EXPIRED');
    }

    // 6. Get machine fingerprint
    const machineFingerprint = this._getMachineFingerprint();

    // 7. Check machine binding (if license has fingerprint)
    if (licenseData.machineFingerprint) {
      if (licenseData.machineFingerprint !== machineFingerprint) {
        throw new LicenseError(
          'License is bound to a different machine',
          'MACHINE_MISMATCH'
        );
      }
    }

    // 8. Save license
    const saveInput: SaveLicenseInput = {
      licenseKey: input.licenseKey,
      expiresAt,
      machineFingerprint
    };

    this.licenseRepo.save(saveInput);

    this.logInfo('License activated', {
      expiresAt: expiresAt.toISOString(),
      machineFingerprint
    });
  }

  /**
   * Check if license is valid (offline check)
   * 
   * @returns License validation result
   */
  public isLicenseValid(): LicenseValidationResult {
    // 1. Check if license exists
    const license = this.licenseRepo.get();
    if (!license) {
      return {
        isValid: false,
        reason: 'No license found'
      };
    }

    // 2. Check expiry
    const now = new Date();
    if (license.expiresAt < now) {
      return {
        isValid: false,
        reason: 'License expired',
        expiresAt: license.expiresAt
      };
    }

    // 3. Verify machine fingerprint
    const currentFingerprint = this._getMachineFingerprint();
    if (license.machineFingerprint !== currentFingerprint) {
      return {
        isValid: false,
        reason: 'Machine fingerprint mismatch'
      };
    }

    // 4. Calculate days remaining
    const daysRemaining = Math.ceil(
      (license.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      isValid: true,
      expiresAt: license.expiresAt,
      daysRemaining
    };
  }

  /**
   * Get license info
   */
  public getLicenseInfo(): {
    activated: boolean;
    expiresAt?: Date;
    daysRemaining?: number;
    machineFingerprint: string;
  } {
    const license = this.licenseRepo.get();
    const machineFingerprint = this._getMachineFingerprint();

    if (!license) {
      return {
        activated: false,
        machineFingerprint
      };
    }

    const now = new Date();
    const daysRemaining = Math.ceil(
      (license.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      activated: true,
      expiresAt: license.expiresAt,
      daysRemaining,
      machineFingerprint
    };
  }

  /**
   * Deactivate license (remove from database)
   */
  public deactivateLicense(): void {
    this.licenseRepo.delete();
    this.logInfo('License deactivated');
  }

  /**
   * Check if license is expiring soon
   * 
   * @param daysThreshold - Number of days to consider "soon" (default 7)
   */
  public isExpiringSoon(daysThreshold: number = 7): boolean {
    const validation = this.isLicenseValid();
    
    if (!validation.isValid) {
      return false;
    }

    return validation.daysRemaining! <= daysThreshold;
  }

  /**
   * Generate trial license (for testing/demo)
   * 
   * @param durationDays - Trial duration in days (default 30)
   * @returns Trial license key
   */
  public generateTrialLicense(durationDays: number = 30): string {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const machineFingerprint = this._getMachineFingerprint();

    const licenseData = {
      type: 'TRIAL',
      expiresAt: expiresAt.toISOString(),
      machineFingerprint,
      generatedAt: new Date().toISOString()
    };

    const payload = JSON.stringify(licenseData);
    const signature = this._generateSignature(payload);

    const licenseKey = Buffer.from(`${payload}:${signature}`).toString('base64');

    return licenseKey;
  }

  /**
   * Get machine fingerprint (hardware binding)
   * 
   * Generates a unique identifier based on hardware characteristics.
   * Stable across reboots, changes if hardware is replaced.
   */
  private _getMachineFingerprint(): string {
    // Combine multiple hardware identifiers
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || 'unknown';
    const cpuCount = cpus.length;
    const totalMemory = os.totalmem();
    const hostname = os.hostname();
    const platform = os.platform();
    const arch = os.arch();

    // Create fingerprint string
    const fingerprintData = `${cpuModel}-${cpuCount}-${totalMemory}-${hostname}-${platform}-${arch}`;

    // Hash to create stable fingerprint
    const hash = crypto.createHash('sha256');
    hash.update(fingerprintData);
    
    return hash.digest('hex').substring(0, 32);
  }

  /**
   * Decode license key
   */
  private _decodeLicenseKey(licenseKey: string): {
    payload: string;
    signature: string;
  } {
    try {
      const decoded = Buffer.from(licenseKey, 'base64').toString('utf-8');
      
      // Find the last colon (separator between payload and signature)
      // We can't use split(':') because the JSON payload contains colons in timestamps
      const lastColonIndex = decoded.lastIndexOf(':');
      
      if (lastColonIndex === -1) {
        throw new Error('Invalid license key format');
      }
      
      const payload = decoded.substring(0, lastColonIndex);
      const signature = decoded.substring(lastColonIndex + 1);

      if (!payload || !signature) {
        throw new Error('Invalid license key format');
      }

      return { payload, signature };
    } catch (error) {
      throw new LicenseError('Invalid license key format', 'INVALID_FORMAT');
    }
  }

  /**
   * Generate signature for license payload
   */
  private _generateSignature(payload: string): string {
    const hmac = crypto.createHmac('sha256', this.SECRET_KEY);
    hmac.update(payload);
    return hmac.digest('hex');
  }

  /**
   * Verify license signature
   */
  private _verifySignature(payload: string, signature: string): boolean {
    const expectedSignature = this._generateSignature(payload);
    return signature === expectedSignature;
  }
}
