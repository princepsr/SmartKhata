/**
 * System IPC Handlers
 * 
 * Handles general system operations.
 */

import { app } from 'electron';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { IPCHandler } from '../ipc-handler';

export function registerSystemHandlers(): void {
  /**
   * Ping Handler
   * Returns "pong" to verify connectivity
   */
  IPCHandler.handle<void, string>(
    IPC_CHANNELS.SYSTEM_PING,
    async () => {
      return 'pong';
    }
  );

  /**
   * Get App Info Handler
   * Returns application name and version
   */
  IPCHandler.handle<void, { name: string; version: string; platform: string }>(
    IPC_CHANNELS.SYSTEM_GET_APP_INFO,
    async () => {
      return {
        name: app.getName(),
        version: app.getVersion(),
        platform: process.platform,
      };
    }
  );
}
