/**
 * Application Constants
 * 
 * These are compile-time constants that don't change between environments.
 * For runtime configuration, see src/main/config/app-config.ts
 */

export const APP_CONSTANTS = {
  // Application metadata
  APP_NAME: 'SmartKhata',
  APP_VERSION: '0.1.0',
  APP_ID: 'com.smartkhata.pos',

  // Database
  DB_NAME: 'smartkhata.db',
  DB_VERSION: 1,

  // Window settings
  WINDOW: {
    MIN_WIDTH: 1024,
    MIN_HEIGHT: 768,
    DEFAULT_WIDTH: 1280,
    DEFAULT_HEIGHT: 800,
  },

  // Business logic
  BUSINESS: {
    CURRENCY: 'INR',
    CURRENCY_SYMBOL: '₹',
    TAX_RATE: 0, // No GST for now, can be configured later
    LOW_STOCK_THRESHOLD: 10,
  },

  // Printing
  PRINT: {
    PAPER_WIDTH_MM: 80, // Thermal printer standard
    MAX_ITEMS_PER_BILL: 100,
  },

  // Validation
  VALIDATION: {
    MAX_PRODUCT_NAME_LENGTH: 100,
    MAX_CUSTOMER_NAME_LENGTH: 50,
    MIN_PRICE: 0.01,
    MAX_PRICE: 999999.99,
  },
} as const;

/**
 * IPC Event Channel Names
 * 
 * Centralized IPC channel names to avoid typos and ensure consistency
 * between main and renderer processes.
 */
export const IPC_EVENTS = {
  // Products
  PRODUCTS_GET_ALL: 'products:getAll',
  PRODUCTS_GET_BY_ID: 'products:getById',
  PRODUCTS_CREATE: 'products:create',
  PRODUCTS_UPDATE: 'products:update',
  PRODUCTS_DELETE: 'products:delete',
  PRODUCTS_SEARCH: 'products:search',

  // Sales
  SALES_CREATE: 'sales:create',
  SALES_GET_ALL: 'sales:getAll',
  SALES_GET_BY_ID: 'sales:getById',
  SALES_GET_BY_DATE_RANGE: 'sales:getByDateRange',

  // Customers
  CUSTOMERS_GET_ALL: 'customers:getAll',
  CUSTOMERS_CREATE: 'customers:create',
  CUSTOMERS_UPDATE: 'customers:update',

  // Printing
  PRINT_INVOICE: 'print:invoice',

  // App
  APP_GET_VERSION: 'app:getVersion',
  APP_GET_CONFIG: 'app:getConfig',
} as const;

/**
 * Database Table Names
 */
export const DB_TABLES = {
  PRODUCTS: 'products',
  SALES: 'sales',
  SALE_ITEMS: 'sale_items',
  CUSTOMERS: 'customers',
  SETTINGS: 'settings',
} as const;

/**
 * Error Messages
 */
export const ERROR_MESSAGES = {
  PRODUCT_NOT_FOUND: 'Product not found',
  SALE_NOT_FOUND: 'Sale not found',
  CUSTOMER_NOT_FOUND: 'Customer not found',
  INVALID_PRICE: 'Invalid price',
  INVALID_QUANTITY: 'Invalid quantity',
  DATABASE_ERROR: 'Database error occurred',
  PRINT_ERROR: 'Failed to print invoice',
} as const;
