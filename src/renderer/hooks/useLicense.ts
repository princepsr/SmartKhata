import { useState, useEffect, useCallback } from 'react';
import { IPC_CHANNELS } from '@shared/ipc/channels';

export interface LicenseStatus {
  type: 'TRIAL' | 'PAID';
  isExpired: boolean;
  isLocked: boolean;
  isGracePeriod: boolean;
  graceDaysRemaining?: number;
  expiresOn?: Date;
  daysRemaining?: number;
  billsRemaining?: number;
  maxBills: number;
  maxDays: number;
  activated: boolean;
  deviceId: string;
}

export function useLicense() {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await window.api.invoke<LicenseStatus>(IPC_CHANNELS.LICENSE_STATUS);
      if (response.success && response.data) {
        setStatus(response.data);
      } else {
        setError(response.error || 'Failed to fetch license status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const activateLicense = async (licenseKey: string) => {
    try {
      const response = await window.api.invoke<void>(IPC_CHANNELS.LICENSE_ACTIVATE, { licenseKey });
      if (response.success) {
        await fetchStatus();
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, loading, error, refresh: fetchStatus, activateLicense };
}
