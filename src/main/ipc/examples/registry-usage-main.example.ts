/**
 * Example: Using IPC Channel Registry in Main Process
 * 
 * This file demonstrates how to use the IPC channel registry
 * when creating IPC handlers in the main process.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS, IPCChannel } from '@shared/ipc/channels';
import { logger } from '../../utils/logger';

/**
 * Example 1: Basic Handler Registration
 */
export function exampleBasicHandler(): void {
  // ✅ GOOD: Use registry constant
  ipcMain.handle(IPC_CHANNELS.PRODUCT_LIST, async () => {
    logger.debug(`IPC Request: ${IPC_CHANNELS.PRODUCT_LIST}`);
    
    // Handler logic here
    const products = await getProductsFromDatabase();
    
    return {
      success: true,
      data: products,
    };
  });

  // ❌ BAD: String literal (TypeScript will error)
  // ipcMain.handle('product:list', async () => { ... });
}

/**
 * Example 2: Handler with Parameters
 */
export function exampleHandlerWithParams(): void {
  ipcMain.handle(IPC_CHANNELS.PRODUCT_GET, async (_event, productId: number) => {
    logger.debug(`IPC Request: ${IPC_CHANNELS.PRODUCT_GET}`, { productId });
    
    // Validate input
    if (!productId || productId <= 0) {
      return {
        success: false,
        error: 'Invalid product ID',
      };
    }
    
    // Handler logic
    const product = await getProductById(productId);
    
    if (!product) {
      return {
        success: false,
        error: 'Product not found',
      };
    }
    
    return {
      success: true,
      data: product,
    };
  });
}

/**
 * Example 3: Multiple Handlers in a Loop
 */
export function exampleMultipleHandlers(): void {
  // Register all product handlers
  const productHandlers: Partial<Record<IPCChannel, () => Promise<unknown>>> = {
    [IPC_CHANNELS.PRODUCT_LIST]: async () => {
      return { success: true, data: [] };
    },
    [IPC_CHANNELS.PRODUCT_GET]: async () => {
      return { success: true, data: null };
    },
    [IPC_CHANNELS.PRODUCT_CREATE]: async () => {
      return { success: true, data: {} };
    },
  };

  // Register all handlers
  Object.entries(productHandlers).forEach(([channel, handler]) => {
    ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
      logger.debug(`IPC Request: ${channel}`, { args });
      return handler();
    });
  });
}

/**
 * Example 4: Type-Safe Channel Usage
 */
export function exampleTypeSafeUsage(): void {
  // TypeScript knows this is a valid channel
  const channel: IPCChannel = IPC_CHANNELS.PRODUCT_LIST;
  
  ipcMain.handle(channel, async () => {
    return { success: true, data: [] };
  });

  // ❌ TypeScript error: Type '"invalid:channel"' is not assignable to type 'IPCChannel'
  // const invalidChannel: IPCChannel = 'invalid:channel';
}

/**
 * Example 5: Autocomplete in IDE
 */
export function exampleAutocomplete(): void {
  // When you type IPC_CHANNELS., your IDE will show all available channels
  ipcMain.handle(IPC_CHANNELS.PRODUCT_LIST, async () => { /* ... */ });
  ipcMain.handle(IPC_CHANNELS.PRODUCT_GET, async () => { /* ... */ });
  ipcMain.handle(IPC_CHANNELS.SALE_CREATE, async () => { /* ... */ });
  // ... IDE autocomplete shows all registered channels
}

// Mock functions for examples
async function getProductsFromDatabase() {
  return [];
}

async function getProductById(_id: number) {
  return null;
}
