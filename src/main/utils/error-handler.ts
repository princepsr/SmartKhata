import { app, dialog } from 'electron';
import { logger } from './logger';

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
}

/**
 * Format error for logging
 */
function formatError(error: Error | any, type: ErrorDetails['type']): ErrorDetails {
  return {
    message: error?.message || String(error),
    stack: error?.stack,
    timestamp: new Date().toISOString(),
    type,
  };
}

/**
 * Show crash dialog to user
 */
async function showCrashDialog(errorDetails: ErrorDetails): Promise<void> {
  const { type, message, timestamp } = errorDetails;

  const title = type === 'uncaughtException' 
    ? 'SmartKhata - Unexpected Error'
    : 'SmartKhata - Promise Error';

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
 * Handle uncaught exception
 */
export function handleUncaughtException(error: Error): void {
  const errorDetails = formatError(error, 'uncaughtException');
  
  logger.error('=== UNCAUGHT EXCEPTION ===', errorDetails);
  
  // Show crash dialog
  showCrashDialog(errorDetails).catch((dialogError) => {
    logger.error('Failed to show crash dialog', dialogError);
    app.exit(1);
  });
}

/**
 * Handle unhandled promise rejection
 */
export function handleUnhandledRejection(reason: any): void {
  const errorDetails = formatError(reason, 'unhandledRejection');
  
  logger.error('=== UNHANDLED PROMISE REJECTION ===', errorDetails);
  
  // Show crash dialog
  showCrashDialog(errorDetails).catch((dialogError) => {
    logger.error('Failed to show crash dialog', dialogError);
    app.exit(1);
  });
}

/**
 * Register global error handlers
 */
export function registerGlobalErrorHandlers(): void {
  process.on('uncaughtException', handleUncaughtException);
  process.on('unhandledRejection', handleUnhandledRejection);
  
  logger.info('Global error handlers registered');
}
