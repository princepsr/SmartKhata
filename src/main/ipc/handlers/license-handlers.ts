import { IPC_CHANNELS } from '@shared/ipc/channels';
import { IPCHandler } from '../ipc-handler';
import { LicenseService, LicenseStatus } from '@main/services/license-service';
import { getUserFriendlyMessage } from '@main/services/errors/service-errors';

export function registerLicenseHandlers(): void {
  const licenseService = new LicenseService();

  /**
   * Get current license status
   */
  IPCHandler.handle<void, LicenseStatus>(
    IPC_CHANNELS.LICENSE_STATUS,
    async () => {
      return licenseService.getLicenseStatus();
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  /**
   * Activate license
   */
  IPCHandler.handle<{ licenseKey: string }, void>(
    IPC_CHANNELS.LICENSE_ACTIVATE,
    async (payload) => {
      licenseService.activateLicense(payload);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  /**
   * Get trial specific info (days/bills)
   */
  IPCHandler.handle<
    void,
    {
      type: string;
      daysRemaining?: number;
      billsRemaining?: number;
      isExpired: boolean;
      isGracePeriod: boolean;
    }
  >(
    IPC_CHANNELS.LICENSE_TRIAL_INFO,
    async () => {
      const status = licenseService.getLicenseStatus();
      return {
        type: status.type,
        daysRemaining: status.daysRemaining,
        billsRemaining: status.billsRemaining,
        isExpired: status.isExpired,
        isGracePeriod: status.isGracePeriod,
      };
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  /**
   * Get unique Referral Code
   */
  IPCHandler.handle<void, string>(
    IPC_CHANNELS.LICENSE_REFERRAL_CODE,
    async () => {
      return licenseService.getReferralCode();
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );
}
