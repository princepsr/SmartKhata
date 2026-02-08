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
    const row = this.queryOne<any>(sql, [key]);
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
    const rows = this.queryAll<any>(sql);
    return rows.map(row => this._mapToSetting(row));
  }

  /**
   * Get all settings as a key-value map
   * 
   * @returns Object with key-value pairs
   */
  public getAllAsMap(): Record<string, string> {
    const settings = this.getAll();
    const map: Record<string, string> = {};
    
    settings.forEach(setting => {
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

    const rows = this.queryAll<any>(sql, keys);
    return rows.map(row => this._mapToSetting(row));
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
    if (value === null) return defaultValue;
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
    if (value === null) return defaultValue;
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
    if (value === null) return defaultValue;
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
   * Map database row to Setting domain object
   */
  private _mapToSetting(row: any): Setting {
    return {
      key: row.key,
      value: row.value,
      updatedAt: new Date(row.updated_at)
    };
  }
}
