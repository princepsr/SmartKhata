import { contextBridge, ipcRenderer } from 'electron';
import { IPC_EVENTS } from '@shared/constants/app-constants';

/**
 * Preload Script - Secure IPC Bridge
 * 
 * This script runs in the renderer process but has access to Node.js APIs.
 * It uses contextBridge to expose a controlled API to the renderer.
 * 
 * Security:
 * - contextIsolation: true (renderer cannot access this script's scope)
 * - Only exposes specific, validated IPC channels
 * - No direct Node.js access to renderer
 */

/**
 * Exposed API for renderer process
 */
const electronAPI = {
  // Generic IPC invoke (for flexibility)
  invoke: (channel: string, ...args: any[]) => {
    // Whitelist allowed channels for security
    const validChannels = Object.values(IPC_EVENTS) as string[];
    
    if (!validChannels.includes(channel)) {
      throw new Error(`Invalid IPC channel: ${channel}`);
    }
    
    return ipcRenderer.invoke(channel as any, ...args);
  },

  // Products API
  products: {
    getAll: () => ipcRenderer.invoke(IPC_EVENTS.PRODUCTS_GET_ALL),
    getById: (id: number) => ipcRenderer.invoke(IPC_EVENTS.PRODUCTS_GET_BY_ID, id),
    create: (product: any) => ipcRenderer.invoke(IPC_EVENTS.PRODUCTS_CREATE, product),
    update: (id: number, product: any) => ipcRenderer.invoke(IPC_EVENTS.PRODUCTS_UPDATE, id, product),
    delete: (id: number) => ipcRenderer.invoke(IPC_EVENTS.PRODUCTS_DELETE, id),
    search: (query: string) => ipcRenderer.invoke(IPC_EVENTS.PRODUCTS_SEARCH, query),
  },

  // Sales API
  sales: {
    create: (sale: any) => ipcRenderer.invoke(IPC_EVENTS.SALES_CREATE, sale),
    getAll: () => ipcRenderer.invoke(IPC_EVENTS.SALES_GET_ALL),
    getById: (id: number) => ipcRenderer.invoke(IPC_EVENTS.SALES_GET_BY_ID, id),
    getByDateRange: (startDate: string, endDate: string) => 
      ipcRenderer.invoke(IPC_EVENTS.SALES_GET_BY_DATE_RANGE, startDate, endDate),
  },

  // Customers API
  customers: {
    getAll: () => ipcRenderer.invoke(IPC_EVENTS.CUSTOMERS_GET_ALL),
    create: (customer: any) => ipcRenderer.invoke(IPC_EVENTS.CUSTOMERS_CREATE, customer),
    update: (id: number, customer: any) => ipcRenderer.invoke(IPC_EVENTS.CUSTOMERS_UPDATE, id, customer),
  },

  // Printing API
  print: {
    invoice: (saleId: number) => ipcRenderer.invoke(IPC_EVENTS.PRINT_INVOICE, saleId),
  },

  // App API
  app: {
    getVersion: () => ipcRenderer.invoke(IPC_EVENTS.APP_GET_VERSION),
    getConfig: () => ipcRenderer.invoke(IPC_EVENTS.APP_GET_CONFIG),
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electron', electronAPI);

// Type safety: Ensure the exposed API matches the type definition
// The renderer will access this via window.electron
