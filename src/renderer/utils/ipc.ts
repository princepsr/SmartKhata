/**
 * IPC Client Wrapper
 * 
 * Reusable utility for making IPC calls from React components.
 * Handles loading states, errors, and timeouts automatically.
 * 
 * USAGE:
 * ```typescript
 * const { data, loading, error } = await ipcClient.call('product:list');
 * ```
 */

import type { IPCChannel } from '@shared/ipc/channels';

/**
 * IPC Call Options
 */
export interface IPCCallOptions {
  /**
   * Timeout in milliseconds (default: 30000 = 30 seconds)
   */
  timeout?: number;

  /**
   * Custom error message to show on failure
   */
  errorMessage?: string;

  /**
   * Whether to throw on error (default: false)
   * If false, returns { data: null, error: string }
   * If true, throws error
   */
  throwOnError?: boolean;

  /**
   * Whether to log the call (default: true in development)
   */
  log?: boolean;
}

/**
 * IPC Call Result
 */
export interface IPCCallResult<T> {
  /**
   * Response data (null if error)
   */
  data: T | null;

  /**
   * Error message (null if success)
   */
  error: string | null;

  /**
   * Whether the call was successful
   */
  success: boolean;
}

/**
 * IPC Client Class
 * 
 * Provides methods for making IPC calls with automatic error handling
 */
class IPCClient {
  private defaultTimeout = 30000; // 30 seconds

  /**
   * Make an IPC call
   * 
   * @param channel - IPC channel name
   * @param payload - Request payload (optional)
   * @param options - Call options
   * @returns Promise resolving to call result
   * 
   * @example
   * ```typescript
   * // Simple call
   * const result = await ipcClient.call('product:list');
   * if (result.success) {
   *   console.log(result.data);
   * }
   * 
   * // With payload
   * const result = await ipcClient.call('product:create', {
   *   name: "Product",
   *   price: 100
   * });
   * 
   * // With options
   * const result = await ipcClient.call('product:get', 123, {
   *   timeout: 5000,
   *   errorMessage: 'Failed to load product'
   * });
   * ```
   */
  async call<T = unknown>(
    channel: IPCChannel,
    payload?: unknown,
    options: IPCCallOptions = {}
  ): Promise<IPCCallResult<T>> {
    const {
      timeout = this.defaultTimeout,
      errorMessage,
      throwOnError = false,
      log = import.meta.env.DEV,
    } = options;

    // Log call in development
    if (log) {
      console.log(`[IPC] Calling: ${channel}`, payload);
    }

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`IPC call timed out after ${timeout}ms`));
        }, timeout);
      });

      // Race between IPC call and timeout
      const response = await Promise.race([
        window.api.invoke<T>(channel, payload),
        timeoutPromise,
      ]);

      // Check if IPC call succeeded
      if (!response.success) {
        const error = errorMessage || response.error || 'Request failed';
        
        if (log) {
          console.error(`[IPC] Error: ${channel}`, error);
        }

        if (throwOnError) {
          throw new Error(error);
        }

        return {
          data: null,
          error,
          success: false,
        };
      }

      // Success
      if (log) {
        console.log(`[IPC] Success: ${channel}`, response.data);
      }

      return {
        data: response.data as T,
        error: null,
        success: true,
      };

    } catch (error) {
      const errorMsg = errorMessage || 
        (error instanceof Error ? error.message : 'An unexpected error occurred');

      if (log) {
        console.error(`[IPC] Exception: ${channel}`, error);
      }

      if (throwOnError) {
        throw error;
      }

      return {
        data: null,
        error: errorMsg,
        success: false,
      };
    }
  }

  /**
   * Make an IPC call and throw on error
   * 
   * Convenience method for when you want to use try/catch
   * 
   * @example
   * ```typescript
   * try {
   *   const data = await ipcClient.callOrThrow('product:list');
   *   console.log(data);
   * } catch (error) {
   *   console.error(error);
   * }
   * ```
   */
  async callOrThrow<T = unknown>(
    channel: IPCChannel,
    payload?: unknown,
    options: Omit<IPCCallOptions, 'throwOnError'> = {}
  ): Promise<T> {
    const result = await this.call<T>(channel, payload, {
      ...options,
      throwOnError: true,
    });

    // TypeScript knows this won't be null because throwOnError is true
    return result.data as T;
  }

  /**
   * Set default timeout for all calls
   */
  setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }
}

/**
 * Singleton IPC client instance
 */
export const ipcClient = new IPCClient();

/**
 * Default export for convenience
 */
export default ipcClient;
