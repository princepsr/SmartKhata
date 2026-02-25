import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * App Settings Store
 *
 * Manages application-wide settings and configuration.
 */

export interface AppSettings {
  shopName: string;
  ownerName: string | null;
  address: string | null;
  phone: string | null;
  gstNumber: string | null;
  printerName: string | null;
  paperSize: '58mm' | '80mm';
  gstEnabled: boolean;
  roundOffEnabled: boolean;
  gstPercentage: number;
  showLogo: boolean;
  showCustomerDetails: boolean;
  footerMessage: string;
  billingOnly: boolean;
  gstExclusiveMode: boolean;
  customersEnabled: boolean;
  autoPrint: boolean;
  printCopies: number;
  autoBackupEnabled: boolean;
  autoBackupIntervalDays: number;
  autoBackupIntervalUnit: 'days' | 'hours';
  autoBackupRetainCount: number;
  lastAutoBackup: string | null;
  googleDriveSyncEnabled: boolean;
  lastCloudSync: string | null;
  cloudSyncPending: boolean;
  pendingSyncPath: string | null;
  privacyPolicyAccepted: boolean;
  autoUpdateEnabled: boolean;
  lastReferralBannerSeen: string | null;
  updatedAt?: string;
}

interface AppSettingsState {
  settings: AppSettings;
  isLoading: boolean;
  error: string | null;
  fetchSettings: (silent?: boolean) => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => void;
  saveSettings: (settings: Partial<AppSettings>) => Promise<{ success: boolean; error?: string }>;
  resetSettings: () => void;
}

const defaultSettings: AppSettings = {
  shopName: 'SmartKhata Shop',
  ownerName: null,
  address: null,
  phone: null,
  gstNumber: null,
  printerName: null,
  paperSize: '58mm',
  gstEnabled: true,
  roundOffEnabled: true,
  gstPercentage: 5,
  showLogo: false,
  showCustomerDetails: true,
  footerMessage: 'Thank you! Visit Again',
  billingOnly: false,
  gstExclusiveMode: false,
  customersEnabled: true,
  autoPrint: true,
  printCopies: 1,
  autoBackupEnabled: true,
  autoBackupIntervalDays: 1,
  autoBackupIntervalUnit: 'days',
  autoBackupRetainCount: 5,
  lastAutoBackup: null,
  googleDriveSyncEnabled: false,
  lastCloudSync: null,
  cloudSyncPending: false,
  pendingSyncPath: null,
  privacyPolicyAccepted: false,
  autoUpdateEnabled: true,
  lastReferralBannerSeen: null,
};

export const useAppSettingsStore = create<AppSettingsState>()(
  devtools(
    (set) => ({
      settings: defaultSettings,
      isLoading: true,
      error: null,

      fetchSettings: async (silent = false) => {
        if (!silent) {
          set({ isLoading: true });
        }
        try {
          const response = await window.api.invoke('settings:get');
          if (response.success) {
            set({ settings: response.data as AppSettings, isLoading: false });
          } else {
            set({ error: response.error, isLoading: false });
          }
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to fetch settings';
          set({ error: errorMsg, isLoading: false });
          console.error('Settings fetch error:', err);
        }
      },

      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      saveSettings: async (newSettings) => {
        set({ isLoading: true });
        try {
          const result = await window.api.invoke('settings:update', newSettings);
          if (result.success) {
            set((state) => ({
              settings: { ...state.settings, ...newSettings },
              isLoading: false,
              error: null,
            }));
          } else {
            set({ error: result.error, isLoading: false });
          }
          return result;
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to save settings';
          set({ error: errorMsg, isLoading: false });
          return { success: false, error: errorMsg };
        }
      },

      resetSettings: () => set({ settings: defaultSettings }),
    }),
    { name: 'AppSettings' }
  )
);
