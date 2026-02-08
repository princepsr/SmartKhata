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
  schema?: any; // Using any here to avoid dragging in Zod types directly if not needed, or use ZodSchema

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
}

/**
 * Handler Function Type
 */
export type IPCHandlerFunction<TRequest, TResponse> = (
  request: TRequest,
  event: IpcMainInvokeEvent
) => Promise<TResponse> | TResponse;

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
        // Log request
        if (!options.skipLogging) {
          logger.debug(`IPC Request: ${channel}`, {
            requestId,
            request: this.sanitizeForLog(request),
          });
        }

        // Validate with Zod schema (if provided)
        let validatedRequest = request;
        if (options.schema) {
          const result = options.schema.safeParse(request);
          if (!result.success) {
            // Throw the Zod error directly, sanitizeIPCError will handle it
            throw result.error;
          }
          validatedRequest = result.data;
        }

        // Custom validation (if provided)
        if (options.validate) {
          await options.validate(validatedRequest);
        }

        // Execute handler with validated data
        const data = await handler(validatedRequest, event);

        // Log success
        if (!options.skipLogging) {
          const duration = Date.now() - startTime;
          logger.debug(`IPC Response: ${channel}`, {
            requestId,
            success: true,
            duration: `${duration}ms`,
          });
        }
        
        // logger.info(`Raw handler response for ${channel}:`, { data });

        // Return success response
        return {
          success: true,
          data,
        } as IPCResponse<TResponse>;

      } catch (error) {
        // Log error using centralized utility
        const duration = Date.now() - startTime;
        logIPCError(channel, error, requestId, duration);

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
    logger.info(`IPC Handler registered: ${channel}`);
  }

  /**
   * Generate unique request ID for tracking
   */
  private static generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize request data for logging
   * Remove sensitive fields like passwords
   */
  private static sanitizeForLog(data: unknown): unknown {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data } as any;
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey'];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }

  /**
   * Remove all registered handlers (for testing/cleanup)
   */
  static removeAllHandlers(): void {
    ipcMain.removeAllListeners();
    logger.info('All IPC handlers removed');
  }

  /**
   * Remove specific handler
   */
  static removeHandler(channel: IPCChannel): void {
    ipcMain.removeHandler(channel);
    logger.info(`IPC Handler removed: ${channel}`);
  }
}
