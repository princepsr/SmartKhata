import { BaseRepository, DatabaseError } from './base-repository';
import { logger } from '../utils/logger';

/**
 * License Domain Object (application layer)
 */
export interface License {
  id: number;
  licenseKey: string;
  activatedOn: Date;
  expiresOn: Date;
  deviceId: string;
  trialStartedOn: Date | null;
  isTrial: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create/Update License Input
 */
export interface SaveLicenseInput {
  licenseKey: string;
  expiresOn: Date;
  deviceId: string;
}

/**
 * License Validation Result
 */
export interface LicenseValidationResult {
  isValid: boolean;
  reason?: string;
  license?: License;
}

/**
 * License Repository
 *
 * Handles database operations for the license table.
 * The license table is a single-row table (id = 1).
 *
 * IMPORTANT: This repository only handles data access.
 * License validation logic (encryption, fingerprinting, etc.)
 * should be handled by a separate LicenseService.
 */
export class LicenseRepository extends BaseRepository {
  /**
   * Save or update license (UPSERT)
   *
   * The license table only allows one row (id = 1).
   * This method will insert or update that single row.
   *
   * @param data - License data
   * @returns Saved license
   */
  public save(data: SaveLicenseInput): License {
    const sql = `
      INSERT INTO license (id, license_key, expires_on, device_id, is_trial)
      VALUES (1, ?, ?, ?, 0)
      ON CONFLICT(id) DO UPDATE SET
        license_key = excluded.license_key,
        expires_on = excluded.expires_on,
        device_id = excluded.device_id,
        is_trial = 0,
        updated_at = datetime('now')
    `;

    this.execute(sql, [data.licenseKey, data.expiresOn.toISOString(), data.deviceId]);

    logger.info('License saved');

    const license = this.get();
    if (!license) {
      throw new Error('Failed to retrieve saved license');
    }

    return license;
  }

  /**
   * Get the license
   *
   * @returns License or null if not activated
   */
  public get(): License | null {
    const sql = `SELECT * FROM license WHERE id = 1`;
    const row = this.queryOne<any>(sql);
    return row ? this._mapToLicense(row) : null;
  }

  /**
   * Check if license exists
   *
   * @returns true if license is activated
   */
  public exists(): boolean {
    const sql = `SELECT COUNT(*) as count FROM license WHERE id = 1`;
    return super.exists(sql);
  }

  /**
   * Update trial start date
   *
   * @param date - Trial start date
   */
  public updateTrialStart(date: Date): void {
    // Check if record exists
    const exists = this.queryOne<{ id: number }>('SELECT id FROM license WHERE id = 1');

    if (exists) {
      const sql = `
        UPDATE license SET
          trial_started_on = COALESCE(trial_started_on, ?),
          is_trial = CASE WHEN license_key = '' OR license_key IS NULL THEN 1 ELSE is_trial END,
          updated_at = datetime('now')
        WHERE id = 1
      `;
      this.execute(sql, [date.toISOString()]);
    } else {
      const sql = `
        INSERT INTO license (id, license_key, expires_on, device_id, trial_started_on, is_trial)
        VALUES (1, '', '9999-12-31', '', ?, 1)
      `;
      this.execute(sql, [date.toISOString()]);
    }
    logger.info('Trial start date updated');
  }

  /**
   * Delete the license (deactivate)
   *
   * NOTE: This keeps the trial_started_at to prevent trial reset.
   */
  public delete(): void {
    const sql = `
      UPDATE license 
      SET license_key = '', 
          expires_on = '1970-01-01', 
          device_id = '',
          is_trial = 1,
          updated_at = datetime('now')
      WHERE id = 1
    `;
    const result = this.execute(sql);

    if (result.changes > 0) {
      logger.info('License cleared');
    }
  }

  /**
   * Check if license is valid (basic offline check)
   *
   * This performs a simple expiry check only.
   * For complete validation (encryption, fingerprint, signature),
   * use a LicenseService.
   *
   * @returns Validation result
   */
  public isValid(): LicenseValidationResult {
    const license = this.get();

    // No license
    if (!license) {
      return {
        isValid: false,
        reason: 'No license found',
      };
    }

    // Check expiry
    const now = new Date();
    if (license.expiresOn < now) {
      return {
        isValid: false,
        reason: 'License expired',
        license,
      };
    }

    // Basic validation passed
    return {
      isValid: true,
      license,
    };
  }

  /**
   * Get days until expiry
   *
   * @returns Days until expiry, or null if no license
   */
  public getDaysUntilExpiry(): number | null {
    const license = this.get();
    if (!license) {
      return null;
    }

    const now = new Date();
    const diffMs = license.expiresOn.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Check if license is expiring soon
   *
   * @param daysThreshold - Number of days to consider "soon" (default 7)
   * @returns true if license expires within threshold
   */
  public isExpiringSoon(daysThreshold: number = 7): boolean {
    const daysUntilExpiry = this.getDaysUntilExpiry();

    if (daysUntilExpiry === null) {
      return false;
    }

    return daysUntilExpiry > 0 && daysUntilExpiry <= daysThreshold;
  }

  /**
   * Map database row to License domain object
   */
  private _mapToLicense(row: any): License {
    return {
      id: row.id,
      licenseKey: row.license_key,
      activatedOn: this.parseDate(row.activated_on),
      expiresOn: this.parseDate(row.expires_on),
      deviceId: row.device_id,
      trialStartedOn: row.trial_started_on ? this.parseDate(row.trial_started_on) : null,
      isTrial: Boolean(row.is_trial),
      createdAt: this.parseDate(row.created_at),
      updatedAt: this.parseDate(row.updated_at),
    };
  }
}
