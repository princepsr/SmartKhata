/**
 * IPC Handler Framework
 *
 * Base wrapper for all IPC handlers in the main process.
 * Provides automatic error handling, validation, and logging.
 *
 * USAGE:
 * ```typescript
 * IPCHandler.handle<RequestType, ResponseType>(
 *   IPC_CHANNELS.PRODUCT_CREATE,
 *   async (request) => {
 *     // Your handler logic here
 *     return product;
 *   },
 *   {
 *     validate: (request) => {
 *       if (!request.name) throw new Error('Name required');
 *     }
 *   }
 * );
 * ```
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { logger } from '../utils/logger';
import { sanitizeIPCError, logIPCError } from './error-utils';
import type { IPCResponse } from '@shared/types/ipc';
import type { IPCChannel } from '@shared/ipc/channels';

/**
 * Handler Options
 */
export interface IPCHandlerOptions<TRequest> {
  /**
   * Zod schema for request validation (recommended)
   * Automatically validates and provides type-safe data
   */
  schema?: { safeParse: (data: unknown) => { success: boolean; data?: any; error?: any } };

  /**
   * Custom validation function called before handler
   * Use this for complex validation logic that can't be expressed in Zod
   * Throw an error to reject the request
   */
  validate?: (request: TRequest) => void | Promise<void>;

  /**
   * Custom error message transformer
   * Sanitize errors before sending to renderer
   */
  transformError?: (error: Error) => string;

  /**
   * Skip logging for this handler (for sensitive data)
   */
  skipLogging?: boolean;

  /**
   * Timeout in milliseconds (default: 30000ms)
   */
  timeout?: number;

  /**
   * Custom timeout message
   */
  timeoutMessage?: string;
}

/**
 * Handler Function Type
 */
export type IPCHandlerFunction<TRequest, TResponse> = (
  request: TRequest,
  event: IpcMainInvokeEvent
) => Promise<TResponse> | TResponse;

const ipcLogger = logger.forModule('IPC');

/**
 * IPC Handler Class
 *
 * Provides a wrapper around ipcMain.handle with automatic:
 * - Error handling (try/catch)
 * - Validation
 * - Logging
 * - Response formatting
 */
export class IPCHandler {
  /**
   * Register a typed IPC handler
   *
   * @param channel - IPC channel name from registry
   * @param handler - Handler function
   * @param options - Optional configuration
   */
  static handle<TRequest = void, TResponse = unknown>(
    channel: IPCChannel,
    handler: IPCHandlerFunction<TRequest, TResponse>,
    options: IPCHandlerOptions<TRequest> = {}
  ): void {
    ipcMain.handle(channel, async (event: IpcMainInvokeEvent, request: TRequest) => {
      const startTime = Date.now();
      const requestId = this.generateRequestId();

      try {
        // Log request (Fail-safe)
        try {
          if (!options.skipLogging) {
            ipcLogger.debug(`IPC Request: ${channel}`, {
              requestId,
              request,
            });
          }
        } catch (logError) {
          console.error('IPC Logging failed:', logError);
        }

        // Validate with Zod schema (if provided)
        let validatedRequest = request;
        if (options.schema) {
          const result = options.schema.safeParse(request);
          if (!result.success) {
            throw result.error;
          }
          validatedRequest = result.data;
        }

        // Custom validation (if provided)
        if (options.validate) {
          await options.validate(validatedRequest);
        }

        // Execute handler with timeout support
        const timeoutMs = options.timeout ?? 30000;
        const handlerPromise = handler(validatedRequest, event);

        const data = await Promise.race([
          handlerPromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => {
              reject(
                new Error(options.timeoutMessage ?? `IPC Request timeout after ${timeoutMs}ms`)
              );
            }, timeoutMs)
          ),
        ]);

        // Log success (Fail-safe)
        try {
          if (!options.skipLogging) {
            const duration = Date.now() - startTime;
            ipcLogger.debug(`IPC Response: ${channel}`, {
              requestId,
              success: true,
              duration: `${duration}ms`,
            });
          }
        } catch (logError) {
          console.error('IPC Logging failed:', logError);
        }

        // Return success response
        return {
          success: true,
          data,
        } as IPCResponse<TResponse>;
      } catch (error) {
        const duration = Date.now() - startTime;

        // Log error using centralized utility (Fail-safe)
        try {
          logIPCError(channel, error, requestId, duration);
        } catch (logError) {
          console.error('IPC Error Logging failed:', logError, { channel, error, requestId });
        }

        // Transform/Sanitize error message
        let errorMessage: string;

        if (options.transformError && error instanceof Error) {
          errorMessage = options.transformError(error);
        } else {
          errorMessage = sanitizeIPCError(error);
        }

        // Return error response
        return {
          success: false,
          error: errorMessage,
        } as IPCResponse<TResponse>;
      }
    });

    // Log handler registration
    ipcLogger.info(`IPC Handler registered: ${channel}`);
  }

  /**
   * Generate unique request ID for tracking
   */
  private static generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Remove all registered handlers (for testing/cleanup)
   */
  static removeAllHandlers(): void {
    ipcMain.removeAllListeners();
    ipcLogger.info('All IPC handlers removed');
  }

  /**
   * Remove specific handler
   */
  static removeHandler(channel: IPCChannel): void {
    ipcMain.removeHandler(channel);
    ipcLogger.info(`IPC Handler removed: ${channel}`);
  }
}
