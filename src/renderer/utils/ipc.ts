import { useUIStore } from '../store/useUIStore';

/**
 * IPC Client Wrapper
 * 
 * Provides a standardized way to call IPC methods with:
 * - Automatic loading state management
 * - Error handling
 * - Success notifications
 * - TypeScript type safety
 */

export interface IPCOptions {
  showLoading?: boolean;
  showSuccess?: boolean;
  successMessage?: string;
  showError?: boolean;
  errorMessage?: string;
}

const defaultOptions: IPCOptions = {
  showLoading: true,
  showSuccess: false,
  showError: true,
};

/**
 * Call an IPC method with standardized error handling
 * 
 * @param method - The IPC method to call (e.g., window.electron.products.getAll)
 * @param options - Configuration for loading/success/error states
 * @returns Promise with the result
 * 
 * @example
 * const products = await ipcCall(
 *   () => window.electron.products.getAll(),
 *   { showLoading: true, showError: true }
 * );
 */
export async function ipcCall<T>(
  method: () => Promise<T>,
  options: IPCOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  const { setLoading, setError, setSuccess, clearMessages } = useUIStore.getState();

  try {
    // Clear previous messages
    clearMessages();

    // Show loading state
    if (opts.showLoading) {
      setLoading(true);
    }

    // Call the IPC method
    const result = await method();

    // Show success message if configured
    if (opts.showSuccess && opts.successMessage) {
      setSuccess(opts.successMessage);
    }

    return result;
  } catch (error) {
    // Show error message
    if (opts.showError) {
      const errorMsg = opts.errorMessage || getErrorMessage(error);
      setError(errorMsg);
    }

    // Re-throw for component-level handling if needed
    throw error;
  } finally {
    // Hide loading state
    if (opts.showLoading) {
      setLoading(false);
    }
  }
}

/**
 * Extract error message from various error types
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

/**
 * Hook-based IPC caller for use in React components
 * 
 * @example
 * function ProductList() {
 *   const callIPC = useIPCCall();
 *   
 *   const fetchProducts = async () => {
 *     const products = await callIPC(
 *       () => window.electron.products.getAll(),
 *       { showLoading: true }
 *     );
 *     setProducts(products);
 *   };
 * }
 */
export function useIPCCall() {
  return ipcCall;
}
