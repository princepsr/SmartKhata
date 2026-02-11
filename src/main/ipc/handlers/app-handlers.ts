import { app } from 'electron';
import { IPCHandler } from '../ipc-handler';
import { IPC_CHANNELS } from '@shared/ipc/channels';

/**
 * Register App Handlers
 */
export function registerAppHandlers(): void {
  // Get App Version
  IPCHandler.handle<void, string>(IPC_CHANNELS.APP_VERSION, () => {
    return app.getVersion();
  });

  // Get App Config (safe subset)
  IPCHandler.handle<void, any>(IPC_CHANNELS.APP_CONFIG, () => {
    return {
      version: app.getVersion(),
      userData: app.getPath('userData'),
      // Add other safe config values here
    };
  });

  // Restart Application
  IPCHandler.handle<void, void>(IPC_CHANNELS.APP_RESTART, () => {
    app.relaunch();
    app.exit(0);
  });
}
