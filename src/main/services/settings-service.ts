/**
 * Settings Service
 * 
 * Manages application settings with in-memory caching.
 * Provides defaults and validates configuration values.
 */

import { BaseService } from './base-service';
import { SettingsRepository } from '../repositories/settings-repository';
import { ValidationError } from './errors/service-errors';

/**
 * Default Settings
 */
const DEFAULT_SETTINGS: Record<string, string> = {
  // Shop Information
  'shop_name': 'My Shop',
  'shop_address': '',
  'shop_phone': '',
  'shop_gstin': '',
  
  // GST Configuration
  'gst_enabled': 'true',
  'default_gst_rate': '18',
  
  // Printer Configuration
  'printer_enabled': 'false',
  'printer_name': '',
  'auto_print': 'false',
  
  // Language
  'language': 'en',
  
  // Currency
  'currency_symbol': '₹',
  'currency_code': 'INR',
  
  // Business Rules
  'allow_negative_stock': 'false',
  'low_stock_alert_enabled': 'true',
  
  // UI Preferences
  'theme': 'light',
  'date_format': 'DD/MM/YYYY',
  'time_format': '24h'
};

/**
 * Settings Service
 */
export class SettingsService extends BaseService {
  private settingsRepo: SettingsRepository;
  private cache: Map<string, string>;
  private cacheLoaded: boolean;

  constructor() {
    super();
    this.settingsRepo = new SettingsRepository();
    this.cache = new Map();
    this.cacheLoaded = false;
  }

  /**
   * Get a setting value (from cache)
   * 
   * @param key - Setting key
   * @param defaultValue - Optional default value
   * @returns Setting value or default
   */
  public getSetting(key: string, defaultValue?: string): string {
    // Load cache if not loaded
    if (!this.cacheLoaded) {
      this._loadCache();
    }

    // Check cache
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // Check default settings
    if (DEFAULT_SETTINGS[key] !== undefined) {
      return DEFAULT_SETTINGS[key];
    }

    // Return provided default or empty string
    return defaultValue ?? '';
  }

  /**
   * Get setting as boolean
   */
  public getBoolean(key: string, defaultValue: boolean = false): boolean {
    const value = this.getSetting(key);
    if (value === '') {
      return defaultValue;
    }
    return value === 'true' || value === '1';
  }

  /**
   * Get setting as number
   */
  public getNumber(key: string, defaultValue: number = 0): number {
    const value = this.getSetting(key);
    if (value === '') {
      return defaultValue;
    }
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * Get setting as integer
   */
  public getInt(key: string, defaultValue: number = 0): number {
    const value = this.getSetting(key);
    if (value === '') {
      return defaultValue;
    }
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * Update a setting (updates DB + cache)
   * 
   * @param key - Setting key
   * @param value - Setting value
   */
  public updateSetting(key: string, value: string): void {
    // Validate setting
    this._validateSetting(key, value);

    // Update database
    this.settingsRepo.set(key, value);

    // Update cache
    this.cache.set(key, value);

    this.logInfo('Setting updated', { key, value });
  }

  /**
   * Update multiple settings (batch update)
   */
  public updateSettings(settings: Record<string, string>): void {
    // Validate all settings first
    Object.entries(settings).forEach(([key, value]) => {
      this._validateSetting(key, value);
    });

    // Update database (in transaction)
    this.settingsRepo.setMany(settings);

    // Update cache
    Object.entries(settings).forEach(([key, value]) => {
      this.cache.set(key, value);
    });

    this.logInfo('Multiple settings updated', { count: Object.keys(settings).length });
  }

  /**
   * Get all settings
   */
  public getAllSettings(): Record<string, string> {
    // Load cache if not loaded
    if (!this.cacheLoaded) {
      this._loadCache();
    }

    // Convert cache to object
    const settings: Record<string, string> = {};
    this.cache.forEach((value, key) => {
      settings[key] = value;
    });

    // Add defaults for missing keys
    Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => {
      if (settings[key] === undefined) {
        settings[key] = value;
      }
    });

    return settings;
  }

  /**
   * Reset setting to default
   */
  public resetSetting(key: string): void {
    const defaultValue = DEFAULT_SETTINGS[key];
    
    if (defaultValue === undefined) {
      throw new ValidationError(`No default value for setting: ${key}`, 'key');
    }

    this.updateSetting(key, defaultValue);
    
    this.logInfo('Setting reset to default', { key, value: defaultValue });
  }

  /**
   * Reset all settings to defaults
   */
  public resetAllSettings(): void {
    this.updateSettings(DEFAULT_SETTINGS);
    this.logInfo('All settings reset to defaults');
  }

  /**
   * Reload cache from database
   */
  public reloadCache(): void {
    this._loadCache();
    this.logInfo('Settings cache reloaded');
  }

  /**
   * Load cache from database
   */
  private _loadCache(): void {
    const settings = this.settingsRepo.getAllAsMap();
    
    this.cache.clear();
    Object.entries(settings).forEach(([key, value]) => {
      this.cache.set(key, value);
    });

    this.cacheLoaded = true;
  }

  /**
   * Validate setting value
   */
  private _validateSetting(key: string, value: string): void {
    // GST rate validation
    if (key === 'default_gst_rate') {
      const gstRate = parseFloat(value);
      if (isNaN(gstRate) || gstRate < 0 || gstRate > 100) {
        throw new ValidationError(
          'GST rate must be between 0 and 100',
          'default_gst_rate'
        );
      }
    }

    // Language validation
    if (key === 'language') {
      const validLanguages = ['en', 'hi', 'mr', 'gu', 'ta', 'te', 'kn', 'ml'];
      if (!validLanguages.includes(value)) {
        throw new ValidationError(
          `Invalid language. Must be one of: ${validLanguages.join(', ')}`,
          'language'
        );
      }
    }

    // Theme validation
    if (key === 'theme') {
      const validThemes = ['light', 'dark'];
      if (!validThemes.includes(value)) {
        throw new ValidationError(
          `Invalid theme. Must be one of: ${validThemes.join(', ')}`,
          'theme'
        );
      }
    }

    // Date format validation
    if (key === 'date_format') {
      const validFormats = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
      if (!validFormats.includes(value)) {
        throw new ValidationError(
          `Invalid date format. Must be one of: ${validFormats.join(', ')}`,
          'date_format'
        );
      }
    }

    // Time format validation
    if (key === 'time_format') {
      const validFormats = ['12h', '24h'];
      if (!validFormats.includes(value)) {
        throw new ValidationError(
          `Invalid time format. Must be one of: ${validFormats.join(', ')}`,
          'time_format'
        );
      }
    }

    // Boolean settings validation
    const booleanSettings = [
      'gst_enabled',
      'printer_enabled',
      'auto_print',
      'allow_negative_stock',
      'low_stock_alert_enabled'
    ];
    
    if (booleanSettings.includes(key)) {
      const validValues = ['true', 'false', '0', '1'];
      if (!validValues.includes(value)) {
        throw new ValidationError(
          `${key} must be true or false`,
          key
        );
      }
    }

    // Phone validation (if shop_phone)
    if (key === 'shop_phone' && value !== '') {
      const cleanPhone = value.replace(/[\s\-\(\)]/g, '');
      if (!/^\d{10}$/.test(cleanPhone)) {
        throw new ValidationError(
          'Shop phone must be 10 digits',
          'shop_phone'
        );
      }
    }

    // GSTIN validation (if shop_gstin)
    if (key === 'shop_gstin' && value !== '') {
      // Basic GSTIN format: 15 characters (alphanumeric)
      if (!/^[0-9A-Z]{15}$/.test(value)) {
        throw new ValidationError(
          'GSTIN must be 15 alphanumeric characters',
          'shop_gstin'
        );
      }
    }
  }
}
