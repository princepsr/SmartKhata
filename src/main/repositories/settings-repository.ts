import { BaseRepository, DatabaseError } from './base-repository';
import { logger } from '../utils/logger';

/**
 * Setting Domain Object (application layer)
 */
export interface Setting {
  key: string;
  value: string;
  updatedAt: Date;
}

/**
 * App Configuration Domain Object
 */
export interface AppConfig {
  shopName: string;
  ownerName: string | null;
  address: string | null;
  phone: string | null;
  gstNumber: string | null;
  printerName: string | null;
  paperSize: '58mm' | '80mm';
  gstEnabled: boolean;
  roundOffEnabled: boolean;
  gstPercentage: number;
  showLogo: boolean;
  showCustomerDetails: boolean;
  footerMessage: string;
  printCopies: number;
  autoPrint: boolean;
  updatedAt: Date;
}

/**
 * Settings Repository
 *
 * Handles all database operations for application settings.
 * Settings are stored as key-value pairs (both TEXT).
 * Type conversion is handled by the application layer.
 */
export class SettingsRepository extends BaseRepository {
  /**
   * Get a setting value by key
   *
   * @param key - Setting key
   * @returns Setting value as string, or null if not found
   */
  public get(key: string): string | null {
    const sql = `SELECT value FROM settings WHERE key = ?`;
    const row = this.queryOne<{ value: string }>(sql, [key]);
    return row?.value || null;
  }

  /**
   * Get a setting with metadata
   *
   * @param key - Setting key
   * @returns Complete setting object or null
   */
  public getSetting(key: string): Setting | null {
    const sql = `SELECT * FROM settings WHERE key = ?`;
    const row = this.queryOne<{
      key: string;
      value: string;
      updated_at: string;
    }>(sql, [key]);
    return row ? this._mapToSetting(row) : null;
  }

  /**
   * Set a setting value (INSERT or UPDATE)
   *
   * Uses UPSERT pattern (INSERT ... ON CONFLICT ... DO UPDATE)
   * to handle both new and existing settings.
   *
   * @param key - Setting key
   * @param value - Setting value (as string)
   */
  public set(key: string, value: string): void {
    const sql = `
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = datetime('now')
    `;

    this.execute(sql, [key, value]);

    logger.info('Setting updated', { key, value });
  }

  /**
   * Get all settings
   *
   * @returns Array of all settings
   */
  public getAll(): Setting[] {
    const sql = `SELECT * FROM settings ORDER BY key ASC`;
    const rows = this.queryAll<{
      key: string;
      value: string;
      updated_at: string;
    }>(sql);
    return rows.map((row) => this._mapToSetting(row));
  }

  /**
   * Get all settings as a key-value map
   *
   * @returns Object with key-value pairs
   */
  public getAllAsMap(): Record<string, string> {
    const settings = this.getAll();
    const map: Record<string, string> = {};

    settings.forEach((setting) => {
      map[setting.key] = setting.value;
    });

    return map;
  }

  /**
   * Check if a setting exists
   *
   * @param key - Setting key
   * @returns true if setting exists
   */
  public has(key: string): boolean {
    const sql = `SELECT COUNT(*) as count FROM settings WHERE key = ?`;
    return this.exists(sql, [key]);
  }

  /**
   * Delete a setting
   *
   * @param key - Setting key
   */
  public delete(key: string): void {
    const sql = `DELETE FROM settings WHERE key = ?`;
    const result = this.execute(sql, [key]);

    if (result.changes === 0) {
      throw new DatabaseError('Setting not found', 'NOT_FOUND');
    }

    logger.info('Setting deleted', { key });
  }

  /**
   * Get multiple settings by keys
   *
   * @param keys - Array of setting keys
   * @returns Array of settings (only found ones)
   */
  public getMany(keys: string[]): Setting[] {
    if (keys.length === 0) {
      return [];
    }

    const placeholders = keys.map(() => '?').join(',');
    const sql = `
      SELECT * FROM settings
      WHERE key IN (${placeholders})
    `;

    const rows = this.queryAll<{
      key: string;
      value: string;
      updated_at: string;
    }>(sql, keys);
    return rows.map((row) => this._mapToSetting(row));
  }

  /**
   * Set multiple settings at once (transaction)
   *
   * @param settings - Object with key-value pairs
   */
  public setMany(settings: Record<string, string>): void {
    this.transaction(() => {
      Object.entries(settings).forEach(([key, value]) => {
        this.set(key, value);
      });
    });

    logger.info('Multiple settings updated', { count: Object.keys(settings).length });
  }

  // ============================================
  // Type-Safe Helpers (Optional)
  // ============================================

  /**
   * Get setting as boolean
   *
   * @param key - Setting key
   * @param defaultValue - Default value if not found
   * @returns Boolean value
   */
  public getBoolean(key: string, defaultValue: boolean = false): boolean {
    const value = this.get(key);
    if (value === null) {
      return defaultValue;
    }
    return value === 'true' || value === '1';
  }

  /**
   * Get setting as number
   *
   * @param key - Setting key
   * @param defaultValue - Default value if not found
   * @returns Number value
   */
  public getNumber(key: string, defaultValue: number = 0): number {
    const value = this.get(key);
    if (value === null) {
      return defaultValue;
    }
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * Get setting as integer
   *
   * @param key - Setting key
   * @param defaultValue - Default value if not found
   * @returns Integer value
   */
  public getInt(key: string, defaultValue: number = 0): number {
    const value = this.get(key);
    if (value === null) {
      return defaultValue;
    }
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * Set boolean setting
   *
   * @param key - Setting key
   * @param value - Boolean value
   */
  public setBoolean(key: string, value: boolean): void {
    this.set(key, value ? 'true' : 'false');
  }

  /**
   * Set number setting
   *
   * @param key - Setting key
   * @param value - Number value
   */
  public setNumber(key: string, value: number): void {
    this.set(key, value.toString());
  }

  /**
   * Get application configuration (singleton)
   *
   * @returns AppConfig object
   */
  public getConfig(): AppConfig {
    const sql = `SELECT * FROM app_config WHERE id = 1`;
    const row = this.queryOne<{
      shop_name: string;
      owner_name: string | null;
      address: string | null;
      phone: string | null;
      gst_number: string | null;
      printer_name: string | null;
      paper_size: '58mm' | '80mm';
      gst_enabled: number;
      round_off_enabled: number;
      gst_percentage: number;
      show_logo: number;
      show_customer_details: number;
      footer_message: string;
      print_copies: number;
      auto_print: number;
      updated_at: string;
    }>(sql);

    if (!row) {
      // Return hardcoded defaults if DB row is missing (should not happen after migration)
      logger.warn('Application configuration row not found in DB, using hardcoded defaults');
      return {
        shopName: 'SmartKhata Shop',
        ownerName: null,
        address: null,
        phone: null,
        gstNumber: null,
        printerName: null,
        paperSize: '58mm',
        gstEnabled: true,
        roundOffEnabled: true,
        gstPercentage: 18,
        showLogo: false,
        showCustomerDetails: true,
        footerMessage: 'Thank you! Visit Again',
        printCopies: 1,
        autoPrint: true,
        updatedAt: new Date(),
      };
    }

    return this._mapToAppConfig(row);
  }

  /**
   * Update application configuration
   *
   * @param config - Partial config object
   */
  public updateConfig(config: Partial<Omit<AppConfig, 'updatedAt'>>): void {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    // Map camelCase to snake_case for DB
    const mapping: Record<string, string> = {
      shopName: 'shop_name',
      ownerName: 'owner_name',
      address: 'address',
      phone: 'phone',
      gstNumber: 'gst_number',
      printerName: 'printer_name',
      paperSize: 'paper_size',
      gstEnabled: 'gst_enabled',
      roundOffEnabled: 'round_off_enabled',
      gstPercentage: 'gst_percentage',
      showLogo: 'show_logo',
      showCustomerDetails: 'show_customer_details',
      footerMessage: 'footer_message',
      printCopies: 'print_copies',
      autoPrint: 'auto_print',
    };

    Object.entries(config).forEach(([key, value]) => {
      if (mapping[key]) {
        fields.push(`${mapping[key]} = ?`);

        // Convert boolean to integer for SQLite
        if (typeof value === 'boolean') {
          values.push(value ? 1 : 0);
        } else {
          values.push(value);
        }
      }
    });

    if (fields.length === 0) {
      return;
    }

    fields.push("updated_at = datetime('now')");

    const sql = `
      UPDATE app_config 
      SET ${fields.join(', ')}
      WHERE id = 1
    `;

    this.execute(sql, values);
    logger.info('Application configuration updated', { updatedFields: Object.keys(config) });
  }

  /**
   * Map database row to Setting domain object
   */
  private _mapToSetting(row: { key: string; value: string; updated_at: string }): Setting {
    return {
      key: row.key,
      value: row.value,
      updatedAt: this.parseDate(row.updated_at),
    };
  }

  /**
   * Map database row to AppConfig domain object
   */
  private _mapToAppConfig(row: {
    shop_name: string;
    owner_name: string | null;
    address: string | null;
    phone: string | null;
    gst_number: string | null;
    printer_name: string | null;
    paper_size: string;
    gst_enabled: number;
    round_off_enabled: number;
    gst_percentage: number;
    show_logo: number;
    show_customer_details: number;
    footer_message: string;
    print_copies: number;
    auto_print: number;
    updated_at: string;
  }): AppConfig {
    return {
      shopName: row.shop_name,
      ownerName: row.owner_name,
      address: row.address,
      phone: row.phone,
      gstNumber: row.gst_number,
      printerName: row.printer_name,
      paperSize: row.paper_size as '58mm' | '80mm',
      gstEnabled: row.gst_enabled === 1,
      roundOffEnabled: row.round_off_enabled === 1,
      gstPercentage: row.gst_percentage,
      showLogo: row.show_logo === 1,
      showCustomerDetails: row.show_customer_details === 1,
      footerMessage: row.footer_message,
      printCopies: row.print_copies,
      autoPrint: row.auto_print === 1,
      updatedAt: this.parseDate(row.updated_at),
    };
  }
}
