/**
 * IPC Handler Registration
 *
 * Central place to register all IPC handlers.
 * Import and call this from main process on app startup.
 */

import { logger } from '../utils/logger';
import { registerProductHandlers } from './handlers/product-handlers';
import { registerSystemHandlers } from './handlers/system-handlers';
import { registerCustomerHandlers } from './handlers/customer-handlers';
// import { registerSaleHandlers } from './handlers/sale-handlers';
import { registerAppHandlers } from './handlers/app-handlers';
import { registerBillHandlers } from './handlers/bill-handlers';
import { registerReportHandlers } from './handlers/report-handlers';
import { registerSettingsHandlers } from './handlers/settings-handlers';
import { registerLicenseHandlers } from './handlers/license-handlers';
import { registerUpdateHandlers } from './handlers/update-handlers';

/**
 * Register all IPC handlers
 *
 * Call this function once when the app starts
 */
export function registerIPCHandlers(): void {
  logger.info('=== Registering IPC Handlers ===');

  try {
    // Register all handler modules
    registerProductHandlers();
    registerSystemHandlers();
    registerAppHandlers();
    registerBillHandlers();
    registerReportHandlers();
    registerSettingsHandlers();
    registerLicenseHandlers();
    registerCustomerHandlers();
    registerUpdateHandlers();
    // registerSaleHandlers();      // TODO: Implement if needed (Bill handles most sales)

    logger.info('=== IPC Handlers Registered Successfully ===');
  } catch (error) {
    logger.error('Failed to register IPC handlers', { error });
    throw error;
  }
}
