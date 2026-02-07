/**
 * Preload Script - Secure IPC Bridge
 * 
 * This script runs in a privileged context with access to both:
 * - Node.js APIs (ipcRenderer)
 * - Renderer process (via contextBridge)
 * 
 * SECURITY MODEL:
 * - contextIsolation: true (renderer cannot access this script's scope)
 * - nodeIntegration: false (renderer has no Node.js access)
 * - Only exposes a single, validated invoke() method
 * - All channels validated against IPC registry
 * - No raw ipcRenderer exposure
 * 
 * USAGE IN RENDERER:
 * ```typescript
 * const response = await window.api.invoke('product:list');
 * ```
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, isValidChannel, type IPCChannel } from '@shared/ipc/channels';
import type { IPCResponse } from '@shared/types/ipc';

/**
 * Secure IPC API
 * 
 * Exposes a single invoke() method that validates channels
 * against the IPC registry before forwarding to ipcRenderer.
 */
const api = {
  /**
   * Invoke an IPC handler in the main process
   * 
   * @param channel - IPC channel name (must be registered in IPC_CHANNELS)
   * @param payload - Request payload (optional)
   * @returns Promise resolving to IPCResponse<T>
   * 
   * @throws Error if channel is not registered
   * 
   * @example
   * ```typescript
   * // List all products
   * const response = await window.api.invoke('product:list');
   * 
   * // Get product by ID
   * const response = await window.api.invoke('product:get', 123);
   * 
   * // Create product
   * const response = await window.api.invoke('product:create', {
   *   name: "New Product",
   *   price: 100,
   *   stock: 50
   * });
   * ```
   */
  invoke: <T = unknown>(channel: string, payload?: unknown): Promise<IPCResponse<T>> => {
    // SECURITY: Validate channel against registry
    if (!isValidChannel(channel)) {
      console.error(`[Preload] Invalid IPC channel: ${channel}`);
      console.error(`[Preload] Allowed channels:`, Object.values(IPC_CHANNELS));
      
      // Return error response instead of throwing
      // This prevents the renderer from crashing
      return Promise.resolve({
        success: false,
        error: `Invalid IPC channel: ${channel}`,
      } as IPCResponse<T>);
    }

    // Channel is valid, forward to main process
    return ipcRenderer.invoke(channel, payload);
  },
};

/**
 * Expose API to renderer via contextBridge
 * 
 * The renderer will access this via window.api
 */
contextBridge.exposeInMainWorld('api', api);

/**
 * Log successful preload initialization
 */
console.log('[Preload] IPC bridge initialized');
console.log('[Preload] Registered channels:', Object.keys(IPC_CHANNELS).length);

/**
 * Export type for renderer TypeScript definitions
 */
export type PreloadAPI = typeof api;
