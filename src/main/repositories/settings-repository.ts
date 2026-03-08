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
  stateCode: string; // 2-digit Indian state code (e.g. '29' for Karnataka)
  supplyType: 'intrastate' | 'interstate'; // For CGST+SGST vs IGST
  placeOfSupply: string | null; // Optional override
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
  gstExclusiveMode: boolean; // Renamed from gstInclusiveDefault
  customersEnabled: boolean;
  expensesEnabled: boolean;
  quotationsEnabled: boolean;
  barcodeGenEnabled: boolean;
  enableBatchTracking: boolean;
  upiId: string;
  upiName: string;
  autoBackupEnabled: boolean;
  autoBackupIntervalDays: number;
  autoBackupIntervalUnit: 'days' | 'hours';
  autoBackupRetainCount: number;
  lastAutoBackup: string | null;
  googleDriveSyncEnabled: boolean;
  lastCloudSync: string | null;
  cloudSyncPending: boolean;
  pendingSyncPath: string | null;
  privacyPolicyAccepted: boolean;
  autoUpdateEnabled: boolean;
  lastReferralBannerSeen: string | null;
  lastGstReminderSeen: string | null;
  language: 'en' | 'hi';
  appMode: 'GENERAL' | 'KIRANA' | 'MEDICAL';
  whatsappAutoReportEnabled: boolean;
  whatsappRecipientNumber: string | null;
  whatsappReportTime: string; // HH:mm
  lastWhatsappReportDate: string | null; // YYYY-MM-DD
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
      state_code: string | null;
      supply_type: string | null;
      place_of_supply: string | null;
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
      gst_exclusive_mode: number;
      customers_enabled: number;
      expenses_enabled: number;
      quotations_enabled: number;
      barcode_gen_enabled: number;
      enable_batch_tracking: number;
      upi_id: string | null;
      upi_name: string | null;
      auto_backup_enabled: number;
      auto_backup_interval_days: number;
      auto_backup_interval_unit: string;
      auto_backup_retain_count: number;
      last_auto_backup: string | null;
      google_drive_sync_enabled: number;
      last_cloud_sync: string | null;
      cloud_sync_pending: number;
      pending_sync_path: string | null;
      privacy_policy_accepted: number;
      auto_update_enabled: number;
      last_referral_banner_seen: string | null;
      last_gst_reminder_seen: string | null;
      language: string;
      app_mode: string;
      whatsapp_auto_report_enabled: number;
      whatsapp_recipient_number: string | null;
      whatsapp_report_time: string | null;
      last_whatsapp_report_date: string | null;
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
        stateCode: '29',
        supplyType: 'intrastate',
        placeOfSupply: null,
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
        gstExclusiveMode: false,
        customersEnabled: true,
        expensesEnabled: true,
        quotationsEnabled: true,
        barcodeGenEnabled: true,
        enableBatchTracking: false,
        upiId: '',
        upiName: '',
        autoBackupEnabled: true,
        autoBackupIntervalDays: 1,
        autoBackupIntervalUnit: 'days',
        autoBackupRetainCount: 5,
        lastAutoBackup: null,
        googleDriveSyncEnabled: false,
        lastCloudSync: null,
        cloudSyncPending: false,
        pendingSyncPath: null,
        privacyPolicyAccepted: false,
        autoUpdateEnabled: true,
        lastReferralBannerSeen: null,
        lastGstReminderSeen: null,
        language: 'en',
        appMode: 'GENERAL',
        whatsappAutoReportEnabled: false,
        whatsappRecipientNumber: null,
        whatsappReportTime: '20:00',
        lastWhatsappReportDate: null,
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
      stateCode: 'state_code',
      supplyType: 'supply_type',
      placeOfSupply: 'place_of_supply',
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
      gstExclusiveMode: 'gst_exclusive_mode',
      customersEnabled: 'customers_enabled',
      expensesEnabled: 'expenses_enabled',
      quotationsEnabled: 'quotations_enabled',
      barcodeGenEnabled: 'barcode_gen_enabled',
      enableBatchTracking: 'enable_batch_tracking',
      upiId: 'upi_id',
      upiName: 'upi_name',
      autoBackupEnabled: 'auto_backup_enabled',
      autoBackupIntervalDays: 'auto_backup_interval_days',
      autoBackupIntervalUnit: 'auto_backup_interval_unit',
      autoBackupRetainCount: 'auto_backup_retain_count',
      lastAutoBackup: 'last_auto_backup',
      googleDriveSyncEnabled: 'google_drive_sync_enabled',
      lastCloudSync: 'last_cloud_sync',
      cloudSyncPending: 'cloud_sync_pending',
      pendingSyncPath: 'pending_sync_path',
      privacyPolicyAccepted: 'privacy_policy_accepted',
      autoUpdateEnabled: 'auto_update_enabled',
      lastReferralBannerSeen: 'last_referral_banner_seen',
      lastGstReminderSeen: 'last_gst_reminder_seen',
      language: 'language',
      appMode: 'app_mode',
      whatsappAutoReportEnabled: 'whatsapp_auto_report_enabled',
      whatsappRecipientNumber: 'whatsapp_recipient_number',
      whatsappReportTime: 'whatsapp_report_time',
      lastWhatsappReportDate: 'last_whatsapp_report_date',
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
    state_code: string | null;
    supply_type: string | null;
    place_of_supply: string | null;
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
    gst_exclusive_mode: number;
    customers_enabled: number;
    expenses_enabled: number;
    quotations_enabled: number;
    barcode_gen_enabled: number;
    enable_batch_tracking: number;
    upi_id: string | null;
    upi_name: string | null;
    auto_backup_enabled: number;
    auto_backup_interval_days: number;
    auto_backup_interval_unit: string;
    auto_backup_retain_count: number;
    last_auto_backup: string | null;
    google_drive_sync_enabled: number;
    last_cloud_sync: string | null;
    cloud_sync_pending: number;
    pending_sync_path: string | null;
    privacy_policy_accepted: number;
    auto_update_enabled: number;
    last_referral_banner_seen: string | null;
    last_gst_reminder_seen: string | null;
    language: string;
    app_mode: string;
    whatsapp_auto_report_enabled: number;
    whatsapp_recipient_number: string | null;
    whatsapp_report_time: string | null;
    last_whatsapp_report_date: string | null;
    updated_at: string;
  }): AppConfig {
    return {
      shopName: row.shop_name,
      ownerName: row.owner_name,
      address: row.address,
      phone: row.phone,
      gstNumber: row.gst_number,
      stateCode: row.state_code || '29',
      supplyType: (row.supply_type as 'intrastate' | 'interstate') || 'intrastate',
      placeOfSupply: row.place_of_supply,
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
      gstExclusiveMode: row.gst_exclusive_mode === 1,
      customersEnabled: row.customers_enabled === 1,
      expensesEnabled: row.expenses_enabled !== 0,
      quotationsEnabled: row.quotations_enabled !== 0,
      barcodeGenEnabled: row.barcode_gen_enabled !== 0,
      enableBatchTracking: row.enable_batch_tracking === 1,
      upiId: row.upi_id || '',
      upiName: row.upi_name || '',
      autoBackupEnabled: row.auto_backup_enabled === 1,
      autoBackupIntervalDays: row.auto_backup_interval_days,
      autoBackupIntervalUnit: (row.auto_backup_interval_unit as 'days' | 'hours') || 'days',
      autoBackupRetainCount: row.auto_backup_retain_count,
      lastAutoBackup: row.last_auto_backup,
      googleDriveSyncEnabled: row.google_drive_sync_enabled === 1,
      lastCloudSync: row.last_cloud_sync,
      cloudSyncPending: row.cloud_sync_pending === 1,
      pendingSyncPath: row.pending_sync_path,
      privacyPolicyAccepted: row.privacy_policy_accepted === 1,
      autoUpdateEnabled: row.auto_update_enabled === 1,
      lastReferralBannerSeen: row.last_referral_banner_seen,
      lastGstReminderSeen: row.last_gst_reminder_seen,
      language: (row.language as 'en' | 'hi') || 'en',
      appMode: (row.app_mode as 'GENERAL' | 'KIRANA' | 'MEDICAL') || 'GENERAL',
      whatsappAutoReportEnabled: row.whatsapp_auto_report_enabled === 1,
      whatsappRecipientNumber: row.whatsapp_recipient_number,
      whatsappReportTime: row.whatsapp_report_time || '20:00',
      lastWhatsappReportDate: row.last_whatsapp_report_date,
      updatedAt: this.parseDate(row.updated_at),
    };
  }
}
