import { app, dialog } from 'electron';
import os from 'os';
import { logger } from './logger';
import { shutdownManager } from './shutdown-manager';
import { configManager } from '../config/app-config';

/**
 * Global Error Handler
 *
 * Handles uncaught exceptions and unhandled promise rejections.
 * Logs errors and shows user-friendly crash dialogs.
 */

interface ErrorDetails {
  message: string;
  stack?: string;
  timestamp: string;
  type: 'uncaughtException' | 'unhandledRejection';
  system: {
    os: string;
    arch: string;
    totalMem: string;
    freeMem: string;
    appVersion: string;
  };
}

/**
 * Format error for logging with system context
 */
function formatError(error: unknown, type: ErrorDetails['type']): ErrorDetails {
  const err = error instanceof Error ? error : null;
  const config = configManager.getConfig();
  return {
    message: err?.message || String(error),
    stack: err?.stack,
    timestamp: new Date().toISOString(),
    type,
    system: {
      os: `${os.type()} ${os.release()}`,
      arch: os.arch(),
      totalMem: `${Math.round(os.totalmem() / 1024 / 1024)} MB`,
      freeMem: `${Math.round(os.freemem() / 1024 / 1024)} MB`,
      appVersion: config.appVersion,
    },
  };
}

/**
 * Show crash dialog to user
 */
async function showCrashDialog(errorDetails: ErrorDetails): Promise<void> {
  const { type, message, timestamp } = errorDetails;

  const title =
    type === 'uncaughtException' ? 'SmartKhata - Unexpected Error' : 'SmartKhata - Promise Error';

  const userMessage = `An unexpected error occurred and the application may need to restart.
  
Error: ${message}

Time: ${new Date(timestamp).toLocaleString()}

The error has been logged for debugging. You can find logs at:
${logger.getLogsDirectory()}

Would you like to restart the application?`;

  const result = await dialog.showMessageBox({
    type: 'error',
    title,
    message: userMessage,
    buttons: ['Restart', 'Close'],
    defaultId: 0,
    cancelId: 1,
  });

  if (result.response === 0) {
    // Restart app
    app.relaunch();
    app.exit(0);
  } else {
    // Close app
    app.exit(1);
  }
}

/**
 * Generic error handler that ensures data safety before dialog
 */
async function processError(error: unknown, type: ErrorDetails['type']): Promise<void> {
  const errorDetails = formatError(error, type);

  logger.error(`=== ${type.toUpperCase()} ===`, errorDetails);

  // Attempt to trigger graceful shutdown to save data (DB closing)
  if (!shutdownManager.isShutdownInProgress()) {
    try {
      logger.info('Attempting graceful shutdown after crash...');
      await shutdownManager.shutdown();
    } catch (shutdownError) {
      logger.error('Shutdown failed during crash handling', shutdownError);
    }
  }

  // Show crash dialog
  try {
    await showCrashDialog(errorDetails);
  } catch (dialogError) {
    logger.error('Failed to show crash dialog', dialogError);
    app.exit(1);
  }
}

/**
 * Handle uncaught exception
 */
export function handleUncaughtException(error: Error): void {
  processError(error, 'uncaughtException');
}

/**
 * Handle unhandled promise rejection
 */
export function handleUnhandledRejection(reason: unknown): void {
  processError(reason, 'unhandledRejection');
}

/**
 * Register global error handlers
 */
export function registerGlobalErrorHandlers(): void {
  process.on('uncaughtException', (error) => {
    handleUncaughtException(error);
  });

  process.on('unhandledRejection', (reason) => {
    handleUnhandledRejection(reason);
  });

  logger.info('Global error handlers registered');
}
