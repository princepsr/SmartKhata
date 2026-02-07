import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * App Settings Store
 * 
 * Manages application-wide settings and configuration.
 */

export interface AppSettings {
  shopName: string;
  shopAddress: string;
  taxRate: number;
  currency: string;
  receiptFooter: string;
}

interface AppSettingsState {
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const defaultSettings: AppSettings = {
  shopName: 'My Kirana Store',
  shopAddress: '',
  taxRate: 0,
  currency: '₹',
  receiptFooter: 'Thank you for shopping with us!',
};

export const useAppSettingsStore = create<AppSettingsState>()(
  devtools(
    (set) => ({
      settings: defaultSettings,
      
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      
      resetSettings: () =>
        set({ settings: defaultSettings }),
    }),
    { name: 'AppSettings' }
  )
);
