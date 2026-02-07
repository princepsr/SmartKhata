/// <reference types="vite/client" />

/**
 * Type definitions for window.api
 * 
 * This file provides TypeScript autocomplete and type checking
 * for the IPC API exposed by the preload script.
 */

import type { PreloadAPI } from '../preload/index';
import type { IPCResponse } from '@shared/types/ipc';
import type { IPCChannel } from '@shared/ipc/channels';

declare global {
  interface Window {
    /**
     * IPC API exposed by preload script
     * 
     * @example
     * ```typescript
     * // Invoke IPC handler
     * const response = await window.api.invoke('product:list');
     * 
     * if (response.success) {
     *   console.log(response.data);
     * } else {
     *   console.error(response.error);
     * }
     * ```
     */
    api: PreloadAPI;
  }
}

/**
 * Type-safe invoke helper
 * 
 * Provides better type inference for specific channels
 */
export type InvokeFunction = <T = unknown>(
  channel: IPCChannel,
  payload?: unknown
) => Promise<IPCResponse<T>>;
