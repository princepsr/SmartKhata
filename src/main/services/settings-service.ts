/**
 * Settings Service
 *
 * Manages application settings with in-memory caching.
 * Provides defaults and validates configuration values.
 */

import { EventEmitter } from 'events';
import { BaseService } from './base-service';
import { SettingsRepository, AppConfig } from '../repositories/settings-repository';
import { ValidationError } from './errors/service-errors';

/**
 * Settings Service
 */
export class SettingsService extends BaseService {
  private static instance: SettingsService;
  private settingsRepo: SettingsRepository;
  private configCache: AppConfig | null;
  private events: EventEmitter;

  constructor() {
    super();
    this.settingsRepo = new SettingsRepository();
    this.configCache = null;
    this.events = new EventEmitter();
  }

  /**
   * Get Singleton Instance
   */
  public static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  /**
   * Initialize Service
   * Loads settings into memory on start
   */
  public initialize(): void {
    try {
      this.reloadCache();
      const config = this.getConfig();
      this.logInfo('Settings service initialized', {
        shopName: config.shopName,
        printer: config.printerName || 'Default',
        paperSize: config.paperSize,
        gstEnabled: config.gstEnabled,
        autoPrint: config.autoPrint,
        printCopies: config.printCopies,
      });
    } catch (error) {
      this.logError('Failed to initialize settings service', error);
      // Don't throw, use defaults from repository if possible
    }
  }

  /**
   * Subscribe to setting changes
   */
  public onChange(callback: (config: AppConfig) => void): void {
    this.events.on('settings-changed', callback);
  }

  /**
   * Get application configuration
   *
   * @returns AppConfig object
   */
  public getConfig(): AppConfig {
    if (!this.configCache) {
      this.reloadCache();
    }
    return this.configCache as AppConfig;
  }

  /**
   * Update application configuration
   *
   * @param config - Partial config object
   */
  public updateConfig(config: Partial<Omit<AppConfig, 'updatedAt'>>): void {
    // Validate config fields
    this._validateConfig(config);

    // Update database
    this.settingsRepo.updateConfig(config);

    // Update cache
    this.reloadCache();

    // Emit event
    if (this.configCache) {
      this.events.emit('settings-changed', this.configCache);
    }

    this.logInfo('Application configuration updated', { updatedFields: Object.keys(config) });
  }

  /**
   * Reload cache from database
   */
  public reloadCache(): void {
    this.configCache = this.settingsRepo.getConfig();
    this.logInfo('Settings cache reloaded');
  }

  /**
   * Validate config fields
   */
  private _validateConfig(config: Partial<AppConfig>): void {
    // Shop Name validation
    if (config.shopName !== undefined && config.shopName.trim() === '') {
      throw new ValidationError('Shop name cannot be empty', 'shopName');
    }

    // Paper Size validation
    if (config.paperSize !== undefined) {
      const validSizes = ['58mm', '80mm'];
      if (!validSizes.includes(config.paperSize)) {
        throw new ValidationError('Invalid paper size. Must be 58mm or 80mm', 'paperSize');
      }
    }

    // Phone validation
    if (config.phone !== undefined && config.phone !== null && config.phone !== '') {
      const cleanPhone = config.phone.replace(/[\s-()]/g, '');
      if (!/^\d{10}$/.test(cleanPhone)) {
        throw new ValidationError('Shop phone must be 10 digits', 'phone');
      }
    }

    // GSTIN validation
    if (config.gstNumber !== undefined && config.gstNumber !== null && config.gstNumber !== '') {
      if (!/^[0-9A-Z]{15}$/.test(config.gstNumber)) {
        throw new ValidationError('GST number must be 15 alphanumeric characters', 'gstNumber');
      }
    }

    // GST Percentage validation
    if (config.gstPercentage !== undefined) {
      if (![0, 5, 12, 18, 28].includes(config.gstPercentage)) {
        throw new ValidationError(
          'Invalid GST percentage. Must be 0, 5, 12, 18, or 28',
          'gstPercentage'
        );
      }
    }

    // Footer Message validation
    if (config.footerMessage !== undefined && config.footerMessage.length > 200) {
      throw new ValidationError('Footer message is too long (max 200 chars)', 'footerMessage');
    }

    // Print Copies validation
    if (config.printCopies !== undefined) {
      if (
        !Number.isInteger(config.printCopies) ||
        config.printCopies < 1 ||
        config.printCopies > 5
      ) {
        throw new ValidationError('Print copies must be between 1 and 5', 'printCopies');
      }
    }

    // Auto-Print validation
    if (config.autoPrint !== undefined && typeof config.autoPrint !== 'boolean') {
      throw new ValidationError('Auto-print must be a boolean value', 'autoPrint');
    }

    // Billing Only validation
    if (config.billingOnly !== undefined && typeof config.billingOnly !== 'boolean') {
      throw new ValidationError('Billing only must be a boolean value', 'billingOnly');
    }

    // Auto Update validation
    if (config.autoUpdateEnabled !== undefined && typeof config.autoUpdateEnabled !== 'boolean') {
      throw new ValidationError('Auto-update must be a boolean value', 'autoUpdateEnabled');
    }

    // Auto Backup Interval validation
    if (config.autoBackupIntervalUnit !== undefined) {
      if (!['days', 'hours'].includes(config.autoBackupIntervalUnit)) {
        throw new ValidationError('Invalid backup interval unit', 'autoBackupIntervalUnit');
      }
    }

    if (config.autoBackupIntervalDays !== undefined) {
      const unit =
        config.autoBackupIntervalUnit || this.configCache?.autoBackupIntervalUnit || 'days';
      if (unit === 'days') {
        if (
          !Number.isInteger(config.autoBackupIntervalDays) ||
          config.autoBackupIntervalDays < 1 ||
          config.autoBackupIntervalDays > 30
        ) {
          throw new ValidationError(
            'Backup interval must be between 1 and 30 days',
            'autoBackupIntervalDays'
          );
        }
      } else {
        // Hours
        if (
          !Number.isInteger(config.autoBackupIntervalDays) ||
          config.autoBackupIntervalDays < 1 ||
          config.autoBackupIntervalDays > 24
        ) {
          throw new ValidationError(
            'Backup interval must be between 1 and 24 hours',
            'autoBackupIntervalDays'
          );
        }
      }
    }

    // Auto Backup Retain Count validation
    if (config.autoBackupRetainCount !== undefined) {
      if (
        !Number.isInteger(config.autoBackupRetainCount) ||
        config.autoBackupRetainCount < 1 ||
        config.autoBackupRetainCount > 50
      ) {
        throw new ValidationError('Retain count must be between 1 and 50', 'autoBackupRetainCount');
      }
    }
  }
}
