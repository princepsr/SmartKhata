/**
 * Example: Using IPC Channel Registry in Preload Script
 * 
 * This file demonstrates how to use the IPC channel registry
 * when creating the preload bridge.
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, isValidChannel, getAllChannels } from '@shared/ipc/channels';

/**
 * Example 1: Basic API Exposure
 */
export function exampleBasicAPI(): void {
  const electronAPI = {
    products: {
      // ✅ GOOD: Use registry constants
      list: () => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_LIST),
      get: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_GET, id),
      create: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_CREATE, data),
    },
  };

  contextBridge.exposeInMainWorld('electron', electronAPI);

  // ❌ BAD: String literals
  // list: () => ipcRenderer.invoke('product:list'),
}

/**
 * Example 2: Typed API with Generics
 */
export function exampleTypedAPI(): void {
  interface Product {
    id: number;
    name: string;
    price: number;
  }

  interface IPCResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
  }

  const electronAPI = {
    products: {
      list: (): Promise<IPCResponse<Product[]>> => 
        ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_LIST),
      
      get: (id: number): Promise<IPCResponse<Product>> => 
        ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_GET, id),
      
      create: (data: Partial<Product>): Promise<IPCResponse<Product>> => 
        ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_CREATE, data),
    },
  };

  contextBridge.exposeInMainWorld('electron', electronAPI);
}

/**
 * Example 3: Validation with isValidChannel
 */
export function exampleValidation(): void {
  // Optional: Generic invoke with validation
  const safeInvoke = (channel: string, ...args: any[]) => {
    if (!isValidChannel(channel)) {
      console.error(`Invalid IPC channel: ${channel}`);
      throw new Error(`Invalid IPC channel: ${channel}`);
    }
    
    // TypeScript knows channel is IPCChannel here
    return ipcRenderer.invoke(channel, ...args);
  };

  const electronAPI = {
    // Expose safe invoke (not recommended for production)
    invoke: safeInvoke,
  };

  contextBridge.exposeInMainWorld('electron', electronAPI);
}

/**
 * Example 4: Logging All Registered Channels
 */
export function exampleLogging(): void {
  // Log all registered channels on startup
  console.log('Registered IPC Channels:', getAllChannels());
  
  // Output:
  // [
  //   'product:list',
  //   'product:get',
  //   'product:create',
  //   'sale:create',
  //   ...
  // ]
}

/**
 * Example 5: Organized API Structure
 */
export function exampleOrganizedAPI(): void {
  const electronAPI = {
    // Product module
    products: {
      list: () => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_LIST),
      get: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_GET, id),
      create: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_CREATE, data),
      update: (id: number, data: any) => 
        ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_UPDATE, id, data),
      delete: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_DELETE, id),
      search: (query: string) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_SEARCH, query),
    },

    // Sale module
    sales: {
      create: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.SALE_CREATE, data),
      list: () => ipcRenderer.invoke(IPC_CHANNELS.SALE_LIST),
      get: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.SALE_GET, id),
    },

    // Customer module
    customers: {
      list: () => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_LIST),
      get: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_GET, id),
      create: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_CREATE, data),
    },

    // App module
    app: {
      version: () => ipcRenderer.invoke(IPC_CHANNELS.APP_VERSION),
      config: () => ipcRenderer.invoke(IPC_CHANNELS.APP_CONFIG),
    },
  };

  contextBridge.exposeInMainWorld('electron', electronAPI);

  // Export type for renderer
  type ElectronAPI = typeof electronAPI;
}

/**
 * Example 6: Runtime Channel Validation
 */
export function exampleRuntimeValidation(): void {
  // Intercept all IPC calls for logging/validation
  const createValidatedAPI = () => {
    return new Proxy({} as any, {
      get: (target, module: string) => {
        return new Proxy({}, {
          get: (_, action: string) => {
            return (...args: any[]) => {
              const channel = `${module}:${action}`;
              
              if (!isValidChannel(channel)) {
                console.error(`Attempted to invoke invalid channel: ${channel}`);
                throw new Error(`Invalid IPC channel: ${channel}`);
              }
              
              console.log(`IPC Call: ${channel}`, args);
              return ipcRenderer.invoke(channel, ...args);
            };
          },
        });
      },
    });
  };

  const electronAPI = createValidatedAPI();
  contextBridge.exposeInMainWorld('electron', electronAPI);
}
