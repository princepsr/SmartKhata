import { IPC_CHANNELS } from '@shared/ipc/channels';
import { IPCHandler } from '../ipc-handler';
import { SettingsService } from '@main/services/settings-service';

export function registerSettingsHandlers(): void {
  const settingsService = new SettingsService();

  /**
   * Get all settings
   */
  IPCHandler.handle<void, Record<string, string>>(IPC_CHANNELS.SETTINGS_GET, async () => {
    return settingsService.getAllSettings();
  });

  /**
   * Update settings
   */
  IPCHandler.handle<Record<string, string>, { success: boolean; error?: string }>(
    IPC_CHANNELS.SETTINGS_UPDATE,
    async (payload) => {
      try {
        settingsService.updateSettings(payload);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  /**
   * Reset all settings
   */
  IPCHandler.handle<void, { success: boolean; error?: string }>(
    IPC_CHANNELS.SETTINGS_RESET,
    async () => {
      try {
        settingsService.resetAllSettings();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
}
