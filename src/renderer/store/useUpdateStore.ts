import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { UpdateStatus, UpdateInfo, UpdateProgress } from '@shared/types/update';
import { IPC_CHANNELS } from '@shared/ipc/channels';

/**
 * Update Store
 *
 * Manages global update state, download progress, and internet connectivity.
 */

interface UpdateState {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: string | null;
  isOnline: boolean;
  showDismissedBanner: boolean;

  // Actions
  setStatus: (status: UpdateStatus, info?: UpdateInfo | null) => void;
  setProgress: (progress: UpdateProgress) => void;
  setError: (error: string | null) => void;
  setOnline: (isOnline: boolean) => void;
  checkConnectivity: () => Promise<boolean>;
  dismissBanner: () => void;
  resetUpdateState: () => void;

  // Async Actions (Bridge to Main)
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

export const useUpdateStore = create<UpdateState>()(
  devtools(
    (set, get) => ({
      status: UpdateStatus.IDLE,
      updateInfo: null,
      progress: null,
      error: null,
      isOnline: navigator.onLine,
      showDismissedBanner: false,

      setStatus: (status, info = get().updateInfo) =>
        set({ status, updateInfo: info, error: null }),

      setProgress: (progress) => set({ progress }),

      setError: (error) => set({ error, status: UpdateStatus.ERROR }),

      setOnline: (isOnline) => set({ isOnline }),

      checkConnectivity: async (): Promise<boolean> => {
        try {
          const response = (await window.api.invoke(IPC_CHANNELS.SYSTEM_CHECK_CONNECTIVITY)) as {
            success: boolean;
            data: boolean;
          };
          const online = !!response.success && response.data === true;
          set({ isOnline: online });
          return online;
        } catch {
          set({ isOnline: false });
          return false;
        }
      },

      dismissBanner: () => set({ showDismissedBanner: true }),

      resetUpdateState: () =>
        set({ status: UpdateStatus.IDLE, updateInfo: null, progress: null, error: null }),

      refreshStatus: async () => {
        const response = (await window.api.invoke(IPC_CHANNELS.UPDATE_STATUS)) as {
          success: boolean;
          data: { status: UpdateStatus; updateInfo: UpdateInfo | null };
        };
        if (response && response.success) {
          const { status, updateInfo } = response.data;
          set({ status, updateInfo });
        }
      },

      checkForUpdates: async () => {
        const online = await get().checkConnectivity();
        if (!online) {
          set({ error: 'Internet connection required to check for updates.' });
          return;
        }
        set({ status: UpdateStatus.CHECKING, error: null });
        await window.api.invoke(IPC_CHANNELS.UPDATE_CHECK);
      },

      downloadUpdate: async () => {
        const online = await get().checkConnectivity();
        if (!online) {
          set({ error: 'Internet connection required to download update.' });
          return;
        }
        set({ status: UpdateStatus.DOWNLOADING, error: null });
        await window.api.invoke(IPC_CHANNELS.UPDATE_DOWNLOAD);
      },

      installUpdate: async () => {
        await window.api.invoke(IPC_CHANNELS.UPDATE_INSTALL);
      },
    }),
    { name: 'UpdateStore' }
  )
);
