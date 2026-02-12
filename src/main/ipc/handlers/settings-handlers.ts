import { IPC_CHANNELS } from '@shared/ipc/channels';
import { IPCHandler } from '../ipc-handler';
import { SettingsService } from '@main/services/settings-service';
import { AppConfig } from '@main/repositories/settings-repository';
import { PrintService } from '@main/services/print-service';
import { getUserFriendlyMessage } from '../../services/errors/service-errors';

export function registerSettingsHandlers(): void {
  const settingsService = SettingsService.getInstance();

  /**
   * Get application configuration (Unifying settings:get)
   */
  IPCHandler.handle<void, AppConfig>(IPC_CHANNELS.SETTINGS_GET, async () => {
    return settingsService.getConfig();
  });

  /**
   * Update configuration
   */
  IPCHandler.handle<Partial<AppConfig>, { success: boolean; error?: string }>(
    IPC_CHANNELS.SETTINGS_UPDATE,
    async (payload) => {
      try {
        settingsService.updateConfig(payload);
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
   * Test Print (Standardized)
   */
  IPCHandler.handle<{ printerName?: string; paperSize?: '58mm' | '80mm' }, boolean>(
    IPC_CHANNELS.SETTINGS_TEST_PRINT,
    async ({ printerName, paperSize }) => {
      const printService = new PrintService();
      return await printService.testPrint(printerName || '', paperSize || '58mm');
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );
}
