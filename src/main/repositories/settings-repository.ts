import { BaseRepository } from './base-repository';
import { logger } from '../utils/logger';

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
  billingOnly: boolean;
  customersEnabled: boolean;
  updatedAt: Date;
}

/**
 * Settings Repository
 *
 * Handles all database operations for application settings.
 * Stores configuration in the structured 'app_config' table.
 */
export class SettingsRepository extends BaseRepository {
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
      billing_only: number;
      customers_enabled: number;
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
        billingOnly: false,
        customersEnabled: true,
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
      billingOnly: 'billing_only',
      customersEnabled: 'customers_enabled',
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
    billing_only: number;
    customers_enabled: number;
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
      billingOnly: row.billing_only === 1,
      customersEnabled: row.customers_enabled === 1,
      updatedAt: this.parseDate(row.updated_at),
    };
  }
}
