/**
 * React Hook for IPC Calls
 * 
 * Provides a React hook for making IPC calls with automatic
 * loading state, error handling, and UI integration.
 */

import { useState, useCallback } from 'react';
import { ipcClient, type IPCCallOptions } from '../utils/ipc';
import type { IPCChannel } from '@shared/ipc/channels';

/**
 * Hook State
 */
export interface UseIPCState<T> {
  /**
   * Response data (null if not loaded or error)
   */
  data: T | null;

  /**
   * Loading state
   */
  loading: boolean;

  /**
   * Error message (null if no error)
   */
  error: string | null;

  /**
   * Function to execute the IPC call
   */
  execute: (payload?: unknown) => Promise<void>;

  /**
   * Reset state to initial values
   */
  reset: () => void;
}

/**
 * React Hook for IPC Calls
 * 
 * @param channel - IPC channel name
 * @param options - IPC call options
 * @returns Hook state with data, loading, error, and execute function
 * 
 * @example
 * ```typescript
 * function ProductList() {
 *   const { data, loading, error, execute } = useIPC<Product[]>('product:list');
 * 
 *   useEffect(() => {
 *     execute();
 *   }, []);
 * 
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *   if (!data) return null;
 * 
 *   return (
 *     <ul>
 *       {data.map(product => (
 *         <li key={product.id}>{product.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useIPC<T = unknown>(
  channel: IPCChannel,
  options: IPCCallOptions = {}
): UseIPCState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (payload?: unknown) => {
    setLoading(true);
    setError(null);

    const result = await ipcClient.call<T>(channel, payload, options);

    if (result.success) {
      setData(result.data);
      setError(null);
    } else {
      setData(null);
      setError(result.error);
    }

    setLoading(false);
  }, [channel, options]);

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
}

/**
 * React Hook for IPC Mutations
 * 
 * Similar to useIPC but designed for create/update/delete operations
 * 
 * @example
 * ```typescript
 * function CreateProduct() {
 *   const { loading, error, execute } = useIPCMutation('product:create');
 * 
 *   const handleSubmit = async (formData) => {
 *     await execute(formData);
 *     // Success! Navigate away or show success message
 *   };
 * 
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       {error && <div className="error">{error}</div>}
 *       <button disabled={loading}>
 *         {loading ? 'Creating...' : 'Create Product'}
 *       </button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useIPCMutation<TRequest = unknown, TResponse = unknown>(
  channel: IPCChannel,
  options: IPCCallOptions = {}
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (payload: TRequest): Promise<TResponse | null> => {
    setLoading(true);
    setError(null);

    const result = await ipcClient.call<TResponse>(channel, payload, options);

    setLoading(false);

    if (result.success) {
      setError(null);
      return result.data;
    } else {
      setError(result.error);
      return null;
    }
  }, [channel, options]);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return {
    loading,
    error,
    execute,
    reset,
  };
}
