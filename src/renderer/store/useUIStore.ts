import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * UI State Store
 * 
 * Manages global UI state like loading indicators and error messages.
 */

interface UIState {
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
  
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setSuccess: (message: string | null) => void;
  clearMessages: () => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    (set) => ({
      isLoading: false,
      error: null,
      successMessage: null,
      
      setLoading: (isLoading) =>
        set({ isLoading }),
      
      setError: (error) =>
        set({ error, successMessage: null }),
      
      setSuccess: (successMessage) =>
        set({ successMessage, error: null }),
      
      clearMessages: () =>
        set({ error: null, successMessage: null }),
    }),
    { name: 'UI' }
  )
);
