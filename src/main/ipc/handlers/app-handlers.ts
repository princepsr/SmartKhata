import { app } from 'electron';
import { logger } from '../../utils/logger';
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
  IPCHandler.handle<void, Record<string, unknown>>(IPC_CHANNELS.APP_CONFIG, () => {
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

  // Report Renderer Error
  IPCHandler.handle<
    { error: { message: string; stack?: string }; errorInfo?: { componentStack?: string } },
    void
  >(IPC_CHANNELS.APP_REPORT_ERROR, (payload) => {
    logger.error('=== RENDERER ERROR ===', {
      message: payload.error?.message,
      stack: payload.error?.stack,
      componentStack: payload.errorInfo?.componentStack,
    });
  });
}
