/**
 * IPC Channel Registry
 *
 * Single source of truth for all IPC channels.
 * Shared between main and renderer processes.
 *
 * RULES:
 * - All channels must follow the format: module:action
 * - Channels are grouped by module
 * - Use this registry in both main handlers and preload bridge
 * - Never use string literals for channel names
 */

/**
 * IPC Channel Registry
 *
 * Add new channels here following the module:action pattern
 */
export const IPC_CHANNELS = {
  // ============================================
  // PRODUCT MODULE
  // ============================================
  PRODUCT_LIST: 'product:list',
  PRODUCT_GET: 'product:get',
  PRODUCT_CREATE: 'product:create',
  PRODUCT_UPDATE: 'product:update',
  PRODUCT_DELETE: 'product:delete',
  PRODUCT_SEARCH: 'product:search',
  PRODUCT_IMPORT: 'product:import',
  PRODUCT_HISTORY: 'product:history',
  PRODUCT_TOGGLE_STATUS: 'product:toggleStatus',

  PRODUCT_COUNT: 'product:count',
  PRODUCT_LOW_STOCK: 'product:lowStock',
  PRODUCT_ADJUST_STOCK: 'product:adjustStock',

  // ============================================
  // BILL MODULE
  // ============================================
  BILL_CALCULATE: 'bill:calculate',
  BILL_CREATE: 'bill:create',
  BILL_GENERATE_NUMBER: 'bill:generateNumber',
  BILL_GET: 'bill:get',
  BILL_LIST_BY_DATE_RANGE: 'bill:listByDateRange',
  BILL_TODAY: 'bill:today',
  BILL_SALES_SUMMARY: 'bill:salesSummary',
  BILL_PRINT: 'bill:print',
  BILL_REPRINT_LAST: 'bill:reprint-last',
  PRINTER_LIST: 'printer:list',
  PRINTER_TEST_PRINT: 'printer:testPrint',

  // ============================================
  // SALE MODULE
  // ============================================
  SALE_CREATE: 'sale:create',
  SALE_LIST: 'sale:list',
  SALE_GET: 'sale:get',
  SALE_VOID: 'sale:void',
  SALE_LIST_BY_DATE: 'sale:list-by-date',

  // ============================================
  // CUSTOMER MODULE
  // ============================================
  CUSTOMER_LIST: 'customer:list',
  CUSTOMER_GET: 'customer:get',
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_UPDATE: 'customer:update',
  CUSTOMER_DELETE: 'customer:delete',
  CUSTOMER_SEARCH: 'customer:search',
  CUSTOMER_HISTORY: 'customer:history',
  CUSTOMER_ADD_PAYMENT: 'customer:add-payment',
  CUSTOMER_TOGGLE_STATUS: 'customer:toggleStatus',

  // ============================================
  // REPORT MODULE
  // ============================================
  REPORT_DAILY_SALES: 'report:sales',
  REPORT_PAYMENT_MODE: 'reports:payment-mode', // Kept for backward compat or specialized use if needed, or I could just leave it. Request didn't mention it.
  REPORT_GST: 'report:gst',
  REPORT_STOCK: 'report:stock',
  REPORT_BILL_WISE: 'report:bills',
  REPORT_PRINT: 'report:print',
  REPORT_EXPORT_PDF: 'report:export-pdf',
  REPORT_EXPORT_EXCEL: 'report:export-excel',
  REPORT_ANALYTICS: 'report:analytics',

  // ============================================
  // BACKUP MODULE
  // ============================================
  BACKUP_CREATE: 'backup:create',
  BACKUP_RESTORE: 'backup:restore',
  BACKUP_INFO: 'backup:info',
  BACKUP_OPEN_FOLDER: 'backup:open-folder',
  SYSTEM_EXPORT: 'system:export',
  SYSTEM_IMPORT: 'system:import',
  SYSTEM_PING: 'system:ping',
  SYSTEM_STATUS: 'system:status',
  SYSTEM_CONNECTIVITY_CHANGE: 'system:connectivity-change',
  SYSTEM_GET_APP_INFO: 'system:get-app-info',
  SYSTEM_DB_STATUS: 'system:dbStatus',
  SYSTEM_CHECK_CONNECTIVITY: 'system:check-connectivity',

  // ============================================
  // SETTINGS MODULE
  // ============================================
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_RESET: 'settings:reset',
  SETTINGS_TEST_PRINT: 'settings:testPrint',

  // ============================================
  // APP MODULE
  // ============================================
  APP_VERSION: 'app:version',
  APP_CONFIG: 'app:config',
  APP_LOGS: 'app:logs',
  APP_RESTART: 'app:restart',
  APP_REPORT_ERROR: 'app:report-error',
  APP_OPEN_USER_DATA: 'app:open-user-data',

  // ============================================
  // LICENSE MODULE
  // ============================================
  LICENSE_STATUS: 'license:status',
  LICENSE_ACTIVATE: 'license:activate',
  LICENSE_TRIAL_INFO: 'license:trialInfo',

  // ============================================
  // GOOGLE MODULE
  // ============================================
  GOOGLE_AUTH_URL: 'google:auth-url',
  GOOGLE_AUTHENTICATE: 'google:authenticate',
  GOOGLE_PROFILE: 'google:profile',
  GOOGLE_LOGOUT: 'google:logout',
  GOOGLE_DRIVE_BACKUP_INFO: 'google:drive-backup-info',
  GOOGLE_DOWNLOAD_BACKUP: 'google:download-backup',
  GOOGLE_SYNC_NOW: 'google:sync-now',

  // ============================================
  // UPDATE MODULE
  // ============================================
  UPDATE_CHECK: 'update:check',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL: 'update:install',
  UPDATE_STATUS: 'update:status',
} as const;

/**
 * Type-safe channel names
 *
 * Use this type to ensure only registered channels are used
 */
export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/**
 * Get all registered channel names as an array
 *
 * Useful for validation in preload script
 */
export const getAllChannels = (): readonly IPCChannel[] => {
  return Object.values(IPC_CHANNELS);
};

/**
 * Check if a channel is registered
 *
 * @param channel - Channel name to check
 * @returns true if channel is registered, false otherwise
 */
export const isValidChannel = (channel: string): channel is IPCChannel => {
  return getAllChannels().includes(channel as IPCChannel);
};

/**
 * Channel groups for organization
 *
 * Useful for logging, debugging, and documentation
 */
export const CHANNEL_GROUPS = {
  PRODUCT: [
    IPC_CHANNELS.PRODUCT_LIST,
    IPC_CHANNELS.PRODUCT_GET,
    IPC_CHANNELS.PRODUCT_CREATE,
    IPC_CHANNELS.PRODUCT_UPDATE,
    IPC_CHANNELS.PRODUCT_DELETE,
    IPC_CHANNELS.PRODUCT_SEARCH,
    IPC_CHANNELS.PRODUCT_IMPORT,
    IPC_CHANNELS.PRODUCT_COUNT,
    IPC_CHANNELS.PRODUCT_LOW_STOCK,
    IPC_CHANNELS.PRODUCT_ADJUST_STOCK,
  ],
  SALE: [
    IPC_CHANNELS.SALE_CREATE,
    IPC_CHANNELS.SALE_LIST,
    IPC_CHANNELS.SALE_GET,
    IPC_CHANNELS.SALE_VOID,
    IPC_CHANNELS.SALE_LIST_BY_DATE,
  ],
  BILL: [
    IPC_CHANNELS.BILL_CALCULATE,
    IPC_CHANNELS.BILL_CREATE,
    IPC_CHANNELS.BILL_GENERATE_NUMBER,
    IPC_CHANNELS.BILL_GET,
    IPC_CHANNELS.BILL_LIST_BY_DATE_RANGE,
    IPC_CHANNELS.BILL_TODAY,
    IPC_CHANNELS.BILL_SALES_SUMMARY,
    IPC_CHANNELS.BILL_PRINT,
    IPC_CHANNELS.BILL_REPRINT_LAST,
    IPC_CHANNELS.PRINTER_LIST,
    IPC_CHANNELS.PRINTER_TEST_PRINT,
  ],
  CUSTOMER: [
    IPC_CHANNELS.CUSTOMER_LIST,
    IPC_CHANNELS.CUSTOMER_GET,
    IPC_CHANNELS.CUSTOMER_CREATE,
    IPC_CHANNELS.CUSTOMER_UPDATE,
    IPC_CHANNELS.CUSTOMER_DELETE,
    IPC_CHANNELS.CUSTOMER_SEARCH,
    IPC_CHANNELS.CUSTOMER_HISTORY,
    IPC_CHANNELS.CUSTOMER_ADD_PAYMENT,
    IPC_CHANNELS.CUSTOMER_TOGGLE_STATUS,
  ],
  REPORT: [
    IPC_CHANNELS.REPORT_DAILY_SALES,
    IPC_CHANNELS.REPORT_PAYMENT_MODE,
    IPC_CHANNELS.REPORT_GST,
    IPC_CHANNELS.REPORT_STOCK,
    IPC_CHANNELS.REPORT_BILL_WISE,
    IPC_CHANNELS.REPORT_ANALYTICS,
  ],
  BACKUP: [
    IPC_CHANNELS.BACKUP_CREATE,
    IPC_CHANNELS.BACKUP_RESTORE,
    IPC_CHANNELS.BACKUP_INFO,
    IPC_CHANNELS.BACKUP_OPEN_FOLDER,
  ],
  SYSTEM: [
    IPC_CHANNELS.SYSTEM_EXPORT,
    IPC_CHANNELS.SYSTEM_IMPORT,
    IPC_CHANNELS.SYSTEM_PING,
    IPC_CHANNELS.SYSTEM_STATUS,
    IPC_CHANNELS.SYSTEM_CONNECTIVITY_CHANGE,
    IPC_CHANNELS.SYSTEM_GET_APP_INFO,
    IPC_CHANNELS.SYSTEM_DB_STATUS,
  ],
  SETTINGS: [
    IPC_CHANNELS.SETTINGS_GET,
    IPC_CHANNELS.SETTINGS_UPDATE,
    IPC_CHANNELS.SETTINGS_RESET,
    IPC_CHANNELS.SETTINGS_TEST_PRINT,
  ],
  APP: [
    IPC_CHANNELS.APP_VERSION,
    IPC_CHANNELS.APP_CONFIG,
    IPC_CHANNELS.APP_LOGS,
    IPC_CHANNELS.APP_OPEN_USER_DATA,
  ],
  LICENSE: [
    IPC_CHANNELS.LICENSE_STATUS,
    IPC_CHANNELS.LICENSE_ACTIVATE,
    IPC_CHANNELS.LICENSE_TRIAL_INFO,
  ],
  GOOGLE: [
    IPC_CHANNELS.GOOGLE_AUTH_URL,
    IPC_CHANNELS.GOOGLE_AUTHENTICATE,
    IPC_CHANNELS.GOOGLE_PROFILE,
    IPC_CHANNELS.GOOGLE_LOGOUT,
    IPC_CHANNELS.GOOGLE_DRIVE_BACKUP_INFO,
    IPC_CHANNELS.GOOGLE_DOWNLOAD_BACKUP,
    IPC_CHANNELS.GOOGLE_SYNC_NOW,
  ],
  UPDATE: [
    IPC_CHANNELS.UPDATE_CHECK,
    IPC_CHANNELS.UPDATE_DOWNLOAD,
    IPC_CHANNELS.UPDATE_INSTALL,
    IPC_CHANNELS.UPDATE_STATUS,
  ],
} as const;
