import { IPC_CHANNELS } from '@shared/ipc/channels';
import { IPCHandler } from '../ipc-handler';
import { LicenseService } from '@main/services/license-service';

export function registerLicenseHandlers(): void {
  const licenseService = new LicenseService();

  /**
   * Get current license info
   */
  IPCHandler.handle<
    void,
    {
      activated: boolean;
      expiresAt?: Date;
      daysRemaining?: number;
      machineFingerprint: string;
    }
  >(IPC_CHANNELS.LICENSE_GET, async () => {
    return licenseService.getLicenseInfo();
  });

  /**
   * Activate license
   */
  IPCHandler.handle<{ licenseKey: string }, { success: boolean; error?: string }>(
    IPC_CHANNELS.LICENSE_ACTIVATE,
    async (payload) => {
      try {
        licenseService.activateLicense(payload);
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
   * Check if license is valid
   */
  IPCHandler.handle<void, { isValid: boolean; reason?: string }>(
    IPC_CHANNELS.LICENSE_CHECK,
    async () => {
      return licenseService.isLicenseValid();
    }
  );
}
