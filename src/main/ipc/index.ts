/**
 * IPC Handler Registration
 * 
 * Central place to register all IPC handlers.
 * Import and call this from main process on app startup.
 */

import { logger } from '../utils/logger';
import { registerProductHandlers } from './handlers/product-handlers';
import { registerSystemHandlers } from './handlers/system-handlers';
// import { registerSaleHandlers } from './handlers/sale-handlers';

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
    // registerAppHandlers();        // TODO: Implement
    // registerSaleHandlers();      // TODO: Implement
  // registerCustomerHandlers(); // TODO: Implement

    logger.info('=== IPC Handlers Registered Successfully ===');
  } catch (error) {
    logger.error('Failed to register IPC handlers', { error });
    throw error;
  }
}
