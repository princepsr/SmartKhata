/**
 * License Service
 *
 * Offline-first license validation and enforcement.
 * Validates license expiry and machine binding.
 */

import { BaseService } from './base-service';
import { LicenseRepository, SaveLicenseInput } from '../repositories/license-repository';
import { BillRepository } from '../repositories/bill-repository';
import { LicenseError, ValidationError } from './errors/service-errors';
import * as crypto from 'crypto';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { logger } from '../utils/logger';

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
  type: 'TRIAL' | 'PAID';
  reason?: string;
  expiresOn?: Date;
  daysRemaining?: number;
  billsRemaining?: number;
  isLocked: boolean;
  isGracePeriod: boolean;
  graceDaysRemaining?: number;
}

export interface LicenseStatus {
  type: 'TRIAL' | 'PAID';
  isExpired: boolean;
  isLocked: boolean;
  isGracePeriod: boolean;
  graceDaysRemaining?: number;
  expiresOn?: Date;
  daysRemaining?: number;
  billsRemaining?: number;
  maxBills: number;
  maxDays: number;
  activated: boolean;
  deviceId: string;
}

/**
 * License Service
 */
export class LicenseService extends BaseService {
  private licenseRepo: LicenseRepository;
  private billRepo: BillRepository;
  private readonly SECRET_KEY = process.env.LICENSE_SECRET || '';
  // NOTE: If missing, all license validations will fail with INVALID_SIGNATURE.
  // This is intentional to ensure security in production.

  private readonly TRIAL_DAYS = 30;
  private readonly TRIAL_BILLS = 300;
  private readonly GRACE_DAYS = 3;

  constructor() {
    super();
    this.logger = logger.forModule('LICENSE');
    this.licenseRepo = new LicenseRepository();
    this.billRepo = new BillRepository();
  }

  /**
   * Get paths for hidden marker files (Trial Reset Prevention)
   * Uses multiple system locations for redundancy.
   */
  private _getMarkerPaths(): string[] {
    const roaming =
      process.env.APPDATA ||
      (process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library', 'Application Support')
        : os.homedir());

    const local =
      process.env.LOCALAPPDATA || (process.platform === 'darwin' ? roaming : os.homedir());

    const paths = [
      path.join(roaming, 'SmartKhata', '.system_info', '.t_marker'),
      path.join(local, '.sys_data', '.cache_bin'), // Obscure location 2
      path.join(os.homedir(), '.config', '.sys_meta'), // Obscure location 3 (User Home)
    ];

    // Ensure directories exist
    paths.forEach((p) => {
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch (error) {
          this.logger.error('Failed to create marker directory', { error, dir });
        }
      }
    });

    return paths;
  }

  /**
   * Read trial start date and last seen date from hidden markers
   * Returns the EARLIEST trial date and LATEST last-seen date found across all redundant markers.
   */
  private _readMarker(): { trialStartedOn: Date | null; lastSeenDate: Date | null } {
    const markerPaths = this._getMarkerPaths();
    let earliestTrialDate: Date | null = null;
    let latestLastSeenDate: Date | null = null;

    // 1. Read from multi-location files
    for (const markerPath of markerPaths) {
      if (fs.existsSync(markerPath)) {
        try {
          const data = fs.readFileSync(markerPath, 'utf-8');
          const json = JSON.parse(data);

          // trialStartedOn
          if (json && json.trialStartedOn) {
            const date = new Date(json.trialStartedOn);
            if (!isNaN(date.getTime())) {
              if (!earliestTrialDate || date < earliestTrialDate) {
                earliestTrialDate = date;
              }
            }
          }

          // updatedAt
          if (json && json.updatedAt) {
            const date = new Date(json.updatedAt);
            if (!isNaN(date.getTime())) {
              if (!latestLastSeenDate || date > latestLastSeenDate) {
                latestLastSeenDate = date;
              }
            }
          }
        } catch (error) {
          this.logger.error('Failed to read trial marker', { error, markerPath });
        }
      }
    }

    // 2. Read from Windows Registry (Location 4)
    const reg = this._readRegistry();
    if (reg.trialStartedOn) {
      const date = new Date(reg.trialStartedOn);
      if (!isNaN(date.getTime()) && (!earliestTrialDate || date < earliestTrialDate)) {
        earliestTrialDate = date;
      }
    }
    if (reg.updatedAt) {
      const date = new Date(reg.updatedAt);
      if (!isNaN(date.getTime()) && (!latestLastSeenDate || date > latestLastSeenDate)) {
        latestLastSeenDate = date;
      }
    }

    return { trialStartedOn: earliestTrialDate, lastSeenDate: latestLastSeenDate };
  }

  /**
   * Helper to read from Windows Registry via PowerShell
   */
  private _readRegistry(): { trialStartedOn: string | null; updatedAt: string | null } {
    if (process.platform !== 'win32') {
      return { trialStartedOn: null, updatedAt: null };
    }
    try {
      const key = 'HKCU:\\Software\\SmartKhata\\SysData';
      // Use Out-String and strip all whitespace to prevent PowerShell formatting issues
      const command = `powershell -Command "if (Test-Path '${key}') { (Get-ItemProperty -Path '${key}' -ErrorAction SilentlyContinue).Data }"`;
      const result = execSync(command, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });

      // Crucial: Strip ALL whitespace/newlines from PowerShell output
      const cleanResult = result.replace(/\s+/g, '');

      if (cleanResult) {
        const decoded = Buffer.from(cleanResult, 'base64').toString('utf-8');
        const json = JSON.parse(decoded);
        return { trialStartedOn: json.t || null, updatedAt: json.u || null };
      }
    } catch {
      this.logger.debug('Registry read failed (likely key not found yet)');
    }
    return { trialStartedOn: null, updatedAt: null };
  }

  /**
   * Write trial start date to all redundant hidden markers
   */
  private _writeMarker(trialDate: Date, lastSeenDate?: Date): void {
    const markerPaths = this._getMarkerPaths();
    const now = new Date();
    const finalLastSeen = lastSeenDate && lastSeenDate > now ? lastSeenDate : now;

    const payloadObj = {
      trialStartedOn: trialDate.toISOString(),
      deviceId: this._getMachineFingerprint(),
      updatedAt: finalLastSeen.toISOString(),
    };

    // 1. Write to multi-location files
    const payloadStr = JSON.stringify(payloadObj);
    markerPaths.forEach((markerPath) => {
      try {
        fs.writeFileSync(markerPath, payloadStr, { mode: 0o600 });
      } catch (error) {
        this.logger.error('Failed to write trial marker', { error, markerPath });
      }
    });

    // 2. Write to Windows Registry (Location 4)
    this._writeRegistry(trialDate.toISOString(), finalLastSeen.toISOString());
  }

  /**
   * Helper to write to Windows Registry via PowerShell
   */
  private _writeRegistry(trialDate: string, lastSeenDate: string): void {
    if (process.platform !== 'win32') {
      return;
    }
    try {
      const rootKey = 'HKCU:\\Software\\SmartKhata';
      const sysKey = `${rootKey}\\SysData`;
      const payload = JSON.stringify({ t: trialDate, u: lastSeenDate });
      const base64 = Buffer.from(payload).toString('base64');

      // Create keys if they don't exist, then set the property
      const command = `powershell -Command "if (!(Test-Path '${rootKey}')) { New-Item -Path '${rootKey}' -Force }; if (!(Test-Path '${sysKey}')) { New-Item -Path '${sysKey}' -Force }; Set-ItemProperty -Path '${sysKey}' -Name 'Data' -Value '${base64}'"`;

      execSync(command, { stdio: 'ignore' });
    } catch (error) {
      this.logger.error('Failed to write to Registry', error);
    }
  }

  /**
   * Initialize trial if not already done
   * Includes self-healing logic for redundant markers.
   */
  public initializeTrial(): void {
    const license = this.licenseRepo.get();
    const marker = this._readMarker();
    const now = new Date();

    // High-Water Mark for time (protection against backdating)
    const lastSeen = marker.lastSeenDate || (license ? license.updatedAt : null);
    const effectiveNow = lastSeen && lastSeen > now ? lastSeen : now;

    if (!license || !license.trialStartedOn) {
      // No trial in DB
      const startDate = marker.trialStartedOn || effectiveNow;
      this.licenseRepo.updateTrialStart(startDate);

      // Restore/Create markers
      this._writeMarker(startDate, effectiveNow);

      this.logInfo('Trial initialized', {
        restored: !!marker.trialStartedOn,
        startDate: startDate.toISOString(),
        timeTamper: effectiveNow > now,
      });
    } else {
      // Trial exists in DB - perform self-healing and update last seen
      const startDate = license.trialStartedOn;

      // Update markers with the latest time high-water mark
      this._writeMarker(startDate, effectiveNow);

      if (!marker.trialStartedOn || startDate < marker.trialStartedOn) {
        this.logInfo('Trial markers self-healed from DB');
      }
    }
  }

  /**
   * Activate license
   *
   * Validates license key, checks machine fingerprint, and saves to database.
   *
   * @param input - License activation input
   */
  public activateLicense(input: ActivateLicenseInput): void {
    // 1. Detect if this is a short key (KRN- or length around 14-16)
    const cleanKey = input.licenseKey.replace(/-/g, '').toUpperCase();
    if (cleanKey.startsWith('KRN') || cleanKey.length === 12) {
      this._activateShortKey(input.licenseKey);
      return;
    }

    // 2. Fallback to Legacy/JSON activation
    if (!input.licenseKey || input.licenseKey.trim() === '') {
      throw new ValidationError('License key is required', 'licenseKey');
    }

    // 3. Decode and validate license
    const decoded = this._decodeLicenseKey(input.licenseKey);

    // 4. Verify signature
    if (!this._verifySignature(decoded.payload, decoded.signature)) {
      throw new LicenseError('Invalid license key signature', 'INVALID_SIGNATURE');
    }

    // 4. Parse license data
    const licenseData = JSON.parse(decoded.payload);

    // 5. Validate expiry date
    const expiresOn = new Date(licenseData.expiresAt);
    if (isNaN(expiresOn.getTime())) {
      throw new LicenseError('Invalid expiry date in license', 'INVALID_EXPIRY');
    }

    if (expiresOn < new Date()) {
      throw new LicenseError('License has expired', 'EXPIRED');
    }

    // 6. Get device ID
    const deviceId = this._getMachineFingerprint();

    // 7. Check machine binding (if license has fingerprint)
    if (licenseData.machineFingerprint) {
      if (licenseData.machineFingerprint !== deviceId) {
        throw new LicenseError('License is bound to a different machine', 'MACHINE_MISMATCH');
      }
    }

    // 8. Save license
    const saveInput: SaveLicenseInput = {
      licenseKey: input.licenseKey,
      expiresOn,
      deviceId,
    };

    this.licenseRepo.save(saveInput);

    this.logInfo('License activated', {
      expiresOn: expiresOn.toISOString(),
      deviceId,
    });
  }

  /**
   * Activate license via Short Key (KRN-XXXX-XXXX-XXXX)
   */
  private _activateShortKey(licenseKey: string): void {
    const keyData = this._validateShortKey(licenseKey);

    const saveInput: SaveLicenseInput = {
      licenseKey: licenseKey,
      expiresOn: keyData.expiresOn,
      deviceId: this._getMachineFingerprint(),
    };

    this.licenseRepo.save(saveInput);
    this.logInfo('Short License Key activated', { expiresOn: keyData.expiresOn.toISOString() });
  }

  /**
   * Validate Short License Key
   */
  public _validateShortKey(key: string): { expiresOn: Date; deviceHashID: number } {
    const cleanKey = key.replace(/-/g, '').toUpperCase();
    if (cleanKey.startsWith('KRN')) {
      // Stripping KRN prefix if present, though usually key is the 12 chars
      // For this implementation, we assume key is the 12 chars after KRN-
    }

    // Use the 12 chars part
    const dataPart = cleanKey.replace(/^KRN/, '');
    if (dataPart.length !== 12) {
      throw new LicenseError('Invalid license key length', 'INVALID_FORMAT');
    }

    const bits = this._decodeBase32(dataPart);

    // bits is a 60-bit BigInt
    // Expiry: 14 bits (bits 46-59)
    // DeviceHashID: 22 bits (bits 24-45)
    // Signature: 24 bits (bits 0-23)

    const expiryDays = Number((bits >> 46n) & 0x3fffn);
    const deviceHashID = Number((bits >> 24n) & 0x3fffffn);
    const signature = Number(bits & 0xffffffn);

    // Verify Signature
    const expectedSignature = this._generateShortSignature(expiryDays, deviceHashID);
    if (signature !== expectedSignature) {
      throw new LicenseError('Invalid license key signature', 'INVALID_SIGNATURE');
    }

    // Verify Device Binding
    const localDeviceID = this._getMachineFingerprint();
    const localDeviceHashID = this._getTruncatedHash(localDeviceID, 22);
    if (deviceHashID !== localDeviceHashID) {
      throw new LicenseError('License is bound to a different machine', 'MACHINE_MISMATCH');
    }

    // Verify Expiry
    const epoch = new Date('2026-01-01T00:00:00Z').getTime();
    const expiresOn =
      expiryDays === 0
        ? new Date('9999-12-31T23:59:59Z')
        : new Date(epoch + expiryDays * 24 * 60 * 60 * 1000);

    if (expiresOn < new Date()) {
      throw new LicenseError('License has expired', 'EXPIRED');
    }

    return { expiresOn, deviceHashID };
  }

  /**
   * Generate 24-bit signature for short keys
   */
  private _generateShortSignature(expiry: number, deviceHashID: number): number {
    const data = `SHORT:${expiry}:${deviceHashID}`;
    const hmac = crypto.createHmac('sha256', this.SECRET_KEY);
    hmac.update(data);
    const hash = hmac.digest();
    // Use first 3 bytes as 24-bit signature
    return (hash[0] << 16) | (hash[1] << 8) | hash[2];
  }

  /**
   * Get truncated hash for device binding
   */
  private _getTruncatedHash(input: string, bitCount: number): number {
    const hash = crypto.createHash('sha256').update(input).digest();
    // Take first 4 bytes and mask to bitCount
    const val = hash.readUInt32BE(0);
    return val >>> (32 - bitCount);
  }

  private readonly B32_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  private _decodeBase32(str: string): bigint {
    let bits = 0n;
    for (const char of str) {
      const val = BigInt(this.B32_ALPHABET.indexOf(char));
      if (val === -1n) {
        throw new LicenseError('Invalid character in license key', 'INVALID_FORMAT');
      }
      bits = (bits << 5n) | val;
    }
    return bits;
  }

  public _encodeBase32(bits: bigint, length: number): string {
    let str = '';
    for (let i = 0; i < length; i++) {
      const val = Number((bits >> BigInt(5 * (length - 1 - i))) & 0x1fn);
      str += this.B32_ALPHABET[val];
    }
    return str;
  }

  /**
   * Check if license is valid (offline check)
   *
   * @returns License validation result
   */
  public isLicenseValid(): LicenseValidationResult {
    const status = this.getLicenseStatus();

    return {
      isValid: !status.isLocked, // Valid if not hard-locked
      type: status.type,
      reason: status.isLocked ? 'Evaluation period ended' : undefined,
      expiresOn: status.expiresOn,
      daysRemaining: status.daysRemaining,
      billsRemaining: status.billsRemaining,
      isLocked: status.isLocked,
      isGracePeriod: status.isGracePeriod,
      graceDaysRemaining: status.graceDaysRemaining,
    };
  }

  /**
   * Get comprehensive license status
   */
  public getLicenseStatus(): LicenseStatus {
    const license = this.licenseRepo.get();
    const marker = this._readMarker();
    const machineFingerprint = this._getMachineFingerprint();
    const currentBills = this.billRepo.getTotalBillCount();
    const now = new Date();

    // HIGH-WATER MARK: Detect if system clock was moved backward
    const lastSeen = marker.lastSeenDate || (license ? license.updatedAt : null);
    const effectiveNow = lastSeen && lastSeen > now ? lastSeen : now;

    if (effectiveNow > now) {
      this.logger.warn('System clock backdating detected. Using last-seen time for verification.', {
        systemNow: now.toISOString(),
        lastSeen: lastSeen?.toISOString(),
      });
    }

    // 1. If Paid License exists in DB
    if (license && license.licenseKey && license.licenseKey !== '' && !license.isTrial) {
      try {
        let authoritativeExpiresOn: Date;

        // AUTHORITATIVE CHECK: Re-verify signature and hardware binding first
        const cleanKey = license.licenseKey.replace(/-/g, '').toUpperCase();
        if (cleanKey.startsWith('KRN') || cleanKey.length === 12) {
          // Short Key logic (without throwing on expiry yet, we handle that in status)
          const dataPart = cleanKey.replace(/^KRN/, '');
          const bits = this._decodeBase32(dataPart);
          const expiryDays = Number((bits >> 46n) & 0x3fffn);
          const deviceHashID = Number((bits >> 24n) & 0x3fffffn);
          const signature = Number(bits & 0xffffffn);

          // 1a. Signature match check
          const expectedSignature = this._generateShortSignature(expiryDays, deviceHashID);
          if (signature !== expectedSignature) {
            throw new Error('INVALID_SIGNATURE');
          }

          // 1b. Hardware binding check
          const localDeviceHashID = this._getTruncatedHash(machineFingerprint, 22);
          if (deviceHashID !== localDeviceHashID) {
            throw new Error('MACHINE_MISMATCH');
          }

          // Derive expiry (authoritative)
          const epoch = new Date('2026-01-01T00:00:00Z').getTime();
          authoritativeExpiresOn =
            expiryDays === 0
              ? new Date('9999-12-31T23:59:59Z')
              : new Date(epoch + expiryDays * 24 * 60 * 60 * 1000);
        } else {
          // Legacy/JSON activation re-verification
          const decoded = this._decodeLicenseKey(license.licenseKey);
          if (!this._verifySignature(decoded.payload, decoded.signature)) {
            throw new Error('INVALID_SIGNATURE');
          }
          const data = JSON.parse(decoded.payload);

          // Check machine binding if present in payload
          if (data.machineFingerprint && data.machineFingerprint !== machineFingerprint) {
            throw new Error('MACHINE_MISMATCH');
          }
          authoritativeExpiresOn = new Date(data.expiresAt);
        }

        // 2. Use the authoritative date from the CRYPTOGRAPHICALLY SIGNED key
        // Even if someone changes the DB column, this 'authoritativeExpiresOn' remains secure.
        const hardLockDate = new Date(authoritativeExpiresOn);
        hardLockDate.setDate(hardLockDate.getDate() + this.GRACE_DAYS);

        const isExpired = authoritativeExpiresOn < effectiveNow;
        const isLocked = effectiveNow > hardLockDate;
        const isGracePeriod = isExpired && !isLocked;

        const daysRemaining = Math.max(
          0,
          Math.floor(
            (authoritativeExpiresOn.getTime() - effectiveNow.getTime()) / (1000 * 60 * 60 * 24)
          )
        );

        const graceDaysRemaining = isGracePeriod
          ? Math.max(
              0,
              Math.ceil((hardLockDate.getTime() - effectiveNow.getTime()) / (1000 * 60 * 60 * 24))
            )
          : undefined;

        return {
          type: 'PAID',
          isExpired,
          isLocked,
          isGracePeriod,
          graceDaysRemaining,
          expiresOn: authoritativeExpiresOn,
          daysRemaining,
          maxBills: Infinity,
          maxDays: Infinity,
          activated: true,
          deviceId: machineFingerprint,
        };
      } catch (error) {
        // If verification fails (e.g. signature tampered, wrong machine), we treat it as no license
        this.logger.error('License key verification failed - falling back to trial', error);
        // Fall through to trial logic
      }
    }

    // 2. Trial Logic
    this.initializeTrial(); // Ensure trial is initialized
    const licenseFromRepo = this.licenseRepo.get();
    const updatedLicense = licenseFromRepo || { trialStartedOn: effectiveNow };
    const trialStart = updatedLicense.trialStartedOn || effectiveNow;

    const trialExpiryDate = new Date(trialStart);
    trialExpiryDate.setDate(trialExpiryDate.getDate() + this.TRIAL_DAYS);

    const daysRemaining = Math.max(
      0,
      Math.floor((trialExpiryDate.getTime() - effectiveNow.getTime()) / (1000 * 60 * 60 * 24))
    );

    const billsRemaining = Math.max(0, this.TRIAL_BILLS - currentBills);

    const isExpired = daysRemaining <= 0 || billsRemaining <= 0;

    // Trial hard lock is 3 days after date expiry, OR immediately if bills used up
    // (Bills used up usually means deliberate usage, so we lock tighter)
    const hardLockDate = new Date(trialExpiryDate);
    hardLockDate.setDate(hardLockDate.getDate() + this.GRACE_DAYS);

    const isLocked = (daysRemaining <= 0 && effectiveNow > hardLockDate) || billsRemaining <= 0;
    const isGracePeriod = isExpired && !isLocked;

    const graceDaysRemaining =
      isGracePeriod && daysRemaining <= 0
        ? Math.max(
            0,
            Math.ceil((hardLockDate.getTime() - effectiveNow.getTime()) / (1000 * 60 * 60 * 24))
          )
        : undefined;

    return {
      type: 'TRIAL',
      isExpired,
      isLocked,
      isGracePeriod,
      graceDaysRemaining,
      expiresOn: trialExpiryDate,
      daysRemaining,
      billsRemaining,
      maxBills: this.TRIAL_BILLS,
      maxDays: this.TRIAL_DAYS,
      activated: false,
      deviceId: machineFingerprint,
    };
  }

  /**
   * Get license info (legacy support/simplified)
   */
  public getLicenseInfo(): LicenseStatus {
    return this.getLicenseStatus();
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

    const daysRemaining = validation.daysRemaining ?? Infinity;
    return daysRemaining <= daysThreshold;
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
      generatedAt: new Date().toISOString(),
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
    let diskSerial = '';
    try {
      // Get Disk Serial Number via WMIC (Windows only)
      const output = execSync('wmic diskdrive get serialnumber').toString();
      // Parse output: SerialNumber (header) followed by serials
      const lines = output
        .trim()
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && l !== 'SerialNumber');
      diskSerial = lines[0] || '';
    } catch {
      this.logger.warn('Failed to retrieve disk serial number, using fallback');
    }

    // Combine multiple hardware identifiers
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || 'unknown';
    const cpuCount = cpus.length;
    // Round memory to nearest GB to avoid minor reporting variations
    const totalMemoryGB = Math.round(os.totalmem() / (1024 * 1024 * 1024));
    const platform = os.platform();
    const arch = os.arch();

    // Create fingerprint string - NO personal data (no hostname, no username)
    // CPU-Cores-RAM-Disk-Platform-Arch
    const fingerprintData = `CPU:${cpuModel}|CORES:${cpuCount}|MEM:${totalMemoryGB}GB|DISK:${diskSerial}|OS:${platform}-${arch}`;

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
    } catch {
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
