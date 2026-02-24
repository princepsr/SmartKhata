import React, { useState, useEffect } from 'react';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { BackupMeta } from '@shared/types/ipc';
import { useAppSettingsStore } from '../../store';
import { RestoreConfirmationModal } from './RestoreConfirmationModal';
import { RestoreSuccessModal } from './RestoreSuccessModal';

/**
 * Data Management Component
 *
 * Provides UI for database backup and restoration.
 * Includes safety confirmations for high-risk operations.
 */
export function DataManagement() {
  const {
    settings,
    updateSettings,
    saveSettings,
    isLoading: settingsLoading,
  } = useAppSettingsStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAction, setLastAction] = useState<{
    type: 'backup' | 'restore';
    success: boolean;
    message: string;
  } | null>(null);

  // Restore Modal State
  const [restoreMeta, setRestoreMeta] = useState<BackupMeta | null>(null);
  const [restorePath, setRestorePath] = useState<string | null>(null);
  const [isRestoreSuccess, setIsRestoreSuccess] = useState(false);

  // Google Drive State
  const [googleProfile, setGoogleProfile] = useState<{ email: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Local state for numeric inputs to allow clearing/typing
  const [intervalInput, setIntervalInput] = useState(settings.autoBackupIntervalDays.toString());
  const [retainInput, setRetainInput] = useState(settings.autoBackupRetainCount.toString());

  useEffect(() => {
    fetchGoogleProfile();
  }, []);

  // Update local state when settings change (e.g. on load)
  useEffect(() => {
    setIntervalInput(settings.autoBackupIntervalDays.toString());
    setRetainInput(settings.autoBackupRetainCount.toString());
  }, [settings.autoBackupIntervalDays, settings.autoBackupRetainCount]);

  const fetchGoogleProfile = async () => {
    try {
      const result = await window.api.invoke<{ email: string } | null>(IPC_CHANNELS.GOOGLE_PROFILE);
      if (result.success && result.data) {
        setGoogleProfile(result.data);
      } else {
        setGoogleProfile(null);
      }
    } catch (err) {
      console.error('Failed to fetch Google profile:', err);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setIsProcessing(true);
      const result = await window.api.invoke<boolean>(IPC_CHANNELS.GOOGLE_AUTHENTICATE);

      if (result.success) {
        await fetchGoogleProfile();
        // Auto-enable sync by default and save
        updateSettings({ googleDriveSyncEnabled: true });
        await saveSettings({ ...settings, googleDriveSyncEnabled: true });
      }
    } catch (err) {
      console.error('Google auth error:', err);
      if (err instanceof Error && !err.message.includes('closed')) {
        alert(`Authentication failed: ${err.message}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoogleLogout = async () => {
    if (confirm('Are you sure you want to unlink your Google account?')) {
      try {
        await window.api.invoke(IPC_CHANNELS.GOOGLE_LOGOUT);
        setGoogleProfile(null);
        updateSettings({ googleDriveSyncEnabled: false });
      } catch (err) {
        console.error('Google logout error:', err);
      }
    }
  };

  const handleManualCloudSync = async () => {
    try {
      setIsSyncing(true);
      setLastAction(null);

      const response = await window.api.invoke<string>(IPC_CHANNELS.GOOGLE_SYNC_NOW);

      if (response.success && response.data) {
        // Update local settings with new sync time
        const syncTime = response.data;
        const updated = {
          ...settings,
          lastCloudSync: syncTime,
        };
        updateSettings({ lastCloudSync: syncTime });
        await saveSettings(updated);

        setLastAction({
          type: 'backup',
          success: true,
          message: 'Cloud sync successful! Your data is now safely backed up to Google Drive.',
        });

        // Refresh profile info
        await fetchGoogleProfile();
      } else {
        throw new Error(response.error || 'Sync failed');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      console.error('Manual sync error:', err);
      setLastAction({
        type: 'backup',
        success: false,
        message: message,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDriveRestore = async () => {
    try {
      setIsProcessing(true);
      setLastAction(null);

      // 1. Fetch metadata from Drive
      const infoResponse = await window.api.invoke<{
        name: string;
        size: string;
        modifiedTime: string;
      }>(IPC_CHANNELS.GOOGLE_DRIVE_BACKUP_INFO);

      if (!infoResponse.success || !infoResponse.data) {
        throw new Error(infoResponse.error || 'No backup found on Google Drive');
      }

      const driveInfo = infoResponse.data;

      // 2. Download to temp location
      setIsSyncing(true);
      const downloadResult = await window.api.invoke<string>(IPC_CHANNELS.GOOGLE_DOWNLOAD_BACKUP);

      if (!downloadResult.success || !downloadResult.data) {
        throw new Error(downloadResult.error || 'Failed to download backup from Google Drive');
      }

      const tempRestorePath = downloadResult.data;

      // 3. Trigger premium confirmation modal with Drive metadata
      setRestorePath(tempRestorePath);
      setRestoreMeta({
        appName: 'SmartKhata',
        version: 'Cloud Backup',
        timestamp: driveInfo.modifiedTime,
        shopName: 'Google Drive Backup',
        schemaVersion: 1, // Default to 1, system-handlers will handle validation
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown Drive restore error';
      console.error('Drive restore error:', err);
      setLastAction({
        type: 'restore',
        success: false,
        message: message,
      });
    } finally {
      setIsProcessing(false);
      setIsSyncing(false);
    }
  };

  const handleBackup = async () => {
    try {
      setIsProcessing(true);
      setLastAction(null);

      const response = await window.api.invoke<{ path: string }>(IPC_CHANNELS.BACKUP_CREATE);

      if (response.success && response.data) {
        setLastAction({
          type: 'backup',
          success: true,
          message: `Backup created successfully at: ${response.data.path}`,
        });
      } else {
        setLastAction({
          type: 'backup',
          success: false,
          message: response.error || 'Backup failed',
        });
      }
    } catch (error) {
      console.error('Backup error:', error);
      if (error instanceof Error && error.message.includes('canceled')) {
        return;
      }
      setLastAction({
        type: 'backup',
        success: false,
        message:
          error instanceof Error ? error.message : 'An unexpected error occurred during backup',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreSelect = async () => {
    try {
      setIsProcessing(true);
      setLastAction(null);

      const response = await window.api.invoke<{ path: string; meta: BackupMeta }>(
        IPC_CHANNELS.BACKUP_INFO
      );

      if (response.success && response.data) {
        setRestorePath(response.data.path);
        setRestoreMeta(response.data.meta);
      }
    } catch (error) {
      console.error('Restore select error:', error);
      if (
        error instanceof Error &&
        (error.message.includes('canceled') || error.message.includes('Selection canceled'))
      ) {
        return;
      }
      setLastAction({
        type: 'restore',
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred selection',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmRestore = async () => {
    if (!restorePath) {
      return;
    }

    try {
      setIsProcessing(true);
      setRestoreMeta(null);

      const response = await window.api.invoke<{ success: boolean }>(
        IPC_CHANNELS.BACKUP_RESTORE,
        restorePath
      );

      if (response.success) {
        setIsRestoreSuccess(true);
      } else {
        setLastAction({
          type: 'restore',
          success: false,
          message: response.error || 'Restore failed',
        });
      }
    } catch (error) {
      console.error('Restore error:', error);
      setLastAction({
        type: 'restore',
        success: false,
        message: 'An unexpected error occurred during restore',
      });
    } finally {
      setIsProcessing(false);
      setRestorePath(null);
    }
  };

  return (
    <div className="data-management-wrapper">
      {/* 1. Manual Backup & Restore */}
      <div className="settings-section-card">
        <div className="section-header">
          <h2>Backup & Restore</h2>
        </div>
        <p className="settings-description">
          Keep your data safe by creating regular backups. You can restore data from a previous
          backup if needed.
        </p>

        <div className="data-actions" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleBackup}
            disabled={isProcessing}
            className="btn btn-primary"
            style={{ flex: '1 1 200px' }}
          >
            {isProcessing ? 'Processing...' : 'Create Backup'}
          </button>

          <button
            onClick={handleRestoreSelect}
            disabled={isProcessing}
            className="btn btn-danger"
            style={{ flex: '1 1 200px' }}
          >
            {isProcessing ? 'Processing...' : 'Restore Data'}
          </button>
        </div>
      </div>

      {/* 2. Automated Backups */}
      <div className="settings-section-card">
        <div className="section-header">
          <h3>Automated Backups</h3>
          <div className="status-indicator">
            {settings.autoBackupEnabled && (
              <span
                className="status-badge"
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  borderRadius: '12px',
                }}
              >
                ACTIVE
              </span>
            )}
          </div>
        </div>

        <p className="settings-description" style={{ marginBottom: '1.5rem' }}>
          SmartKhata can automatically back up your data in the background to ensure you never lose
          your records.
        </p>

        <div
          className="settings-form"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
          }}
        >
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.autoBackupEnabled}
                onChange={(e) => updateSettings({ autoBackupEnabled: e.target.checked })}
              />
              Enable Automated Background Backups
            </label>
            <p className="help-text">
              When enabled, the system will silently create backups at fixed intervals.
            </p>
          </div>

          <div
            className="form-group"
            style={{
              opacity: settings.autoBackupEnabled ? 1 : 0.5,
              pointerEvents: settings.autoBackupEnabled ? 'all' : 'none',
              gridColumn: '1 / -1',
            }}
          >
            <label htmlFor="backupInterval">Backup Frequency</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Every</span>
                <input
                  id="backupInterval"
                  type="number"
                  min="1"
                  max={settings.autoBackupIntervalUnit === 'hours' ? 24 : 30}
                  value={intervalInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setIntervalInput(val);
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed) && parsed > 0) {
                      updateSettings({ autoBackupIntervalDays: parsed });
                    }
                  }}
                  onBlur={() => {
                    if (intervalInput === '' || isNaN(parseInt(intervalInput, 10))) {
                      setIntervalInput(settings.autoBackupIntervalDays.toString());
                    }
                  }}
                  className="form-input"
                  style={{ width: '80px' }}
                />
              </div>

              <select
                className="form-input"
                style={{ width: '120px' }}
                value={settings.autoBackupIntervalUnit}
                onChange={(e) => {
                  const unit = e.target.value as 'days' | 'hours';
                  updateSettings({ autoBackupIntervalUnit: unit });

                  // Cap value if unit changed to hours and current value > 24
                  if (unit === 'hours' && settings.autoBackupIntervalDays > 24) {
                    updateSettings({ autoBackupIntervalDays: 24 });
                    setIntervalInput('24');
                  }
                }}
              >
                <option value="days">Day(s)</option>
                <option value="hours">Hour(s)</option>
              </select>
            </div>
            <p className="help-text">
              Choose how frequently the system should automatically back up your data.
            </p>
          </div>

          <div
            className="form-group"
            style={{
              opacity: settings.autoBackupEnabled ? 1 : 0.5,
              pointerEvents: settings.autoBackupEnabled ? 'all' : 'none',
            }}
          >
            <label htmlFor="retainCount">Keep Last N Backups</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                id="retainCount"
                type="number"
                min="1"
                max="50"
                value={retainInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setRetainInput(val);
                  const parsed = parseInt(val, 10);
                  if (!isNaN(parsed) && parsed > 0) {
                    updateSettings({ autoBackupRetainCount: parsed });
                  }
                }}
                onBlur={() => {
                  if (retainInput === '' || isNaN(parseInt(retainInput, 10))) {
                    setRetainInput(settings.autoBackupRetainCount.toString());
                  }
                }}
                className="form-input"
                style={{ width: '100px' }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>Files</span>
            </div>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Last Auto-Backup:{' '}
              {settings.lastAutoBackup
                ? new Date(settings.lastAutoBackup).toLocaleString('en-IN', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  })
                : 'Never performed yet'}
            </div>
          </div>
        </div>

        <div
          className="settings-footer"
          style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}
        >
          <button
            type="button"
            onClick={() => saveSettings(settings)}
            className="btn btn-primary"
            disabled={settingsLoading}
          >
            {settingsLoading ? 'Saving...' : 'Save Backup Settings'}
          </button>
        </div>
      </div>

      {/* 3. Google Drive Sync */}
      <div className="settings-section-card">
        <div className="section-header">
          <h3>Google Drive Sync</h3>
          <div className="status-indicator">
            {googleProfile && (
              <span
                className="status-badge"
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  color: '#3b82f6',
                  borderRadius: '12px',
                }}
              >
                LINKED
              </span>
            )}
          </div>
        </div>

        <p className="settings-description" style={{ marginBottom: '1.5rem' }}>
          Securely sync your latest backup to Google Drive for ultimate data safety.
        </p>

        {!googleProfile ? (
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              textAlign: 'center',
              border: '1px dashed var(--border-color)',
            }}
          >
            <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              No Google account linked. Link your account to enable cloud backups.
            </p>
            <button
              onClick={handleGoogleAuth}
              disabled={isProcessing}
              className="btn btn-primary"
              style={{ margin: '0 auto' }}
            >
              🔗 Link Google Drive Account
            </button>
          </div>
        ) : (
          <div
            className="settings-form"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
            }}
          >
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Linked Account
                  </div>
                  <div style={{ fontWeight: '450', color: 'var(--primary-accent)' }}>
                    {googleProfile.email}
                  </div>
                </div>
                <button
                  onClick={handleGoogleLogout}
                  className="btn btn-secondary btn-sm"
                  style={{ color: '#ef4444' }}
                >
                  Unlink
                </button>
              </div>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.googleDriveSyncEnabled}
                  onChange={(e) => updateSettings({ googleDriveSyncEnabled: e.target.checked })}
                />
                Auto-sync backups to Google Drive
              </label>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Last Cloud Sync:{' '}
                {settings.lastCloudSync
                  ? new Date(settings.lastCloudSync).toLocaleString('en-IN', {
                      dateStyle: 'long',
                      timeStyle: 'short',
                    })
                  : 'Not synced yet'}
              </div>
            </div>

            <div
              className="form-group"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                gridColumn: '1 / -1',
              }}
            >
              <button
                onClick={handleManualCloudSync}
                disabled={isSyncing || isProcessing}
                className="btn btn-primary"
              >
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
              <button
                onClick={handleDriveRestore}
                disabled={isSyncing || isProcessing}
                className="btn btn-danger"
              >
                {isSyncing ? 'Restoring...' : 'Restore from Drive'}
              </button>
            </div>
          </div>
        )}

        <div
          className="settings-footer"
          style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}
        >
          <button
            type="button"
            onClick={() => saveSettings(settings)}
            className="btn btn-primary"
            disabled={settingsLoading}
          >
            {settingsLoading ? 'Saving...' : 'Save Cloud Settings'}
          </button>
        </div>
      </div>

      {lastAction && (
        <div
          className="fade-in"
          style={{
            marginTop: '1.5rem',
            padding: '1.25rem',
            borderRadius: '0.5rem',
            backgroundColor: lastAction.success
              ? 'rgba(16, 185, 129, 0.08)'
              : 'rgba(239, 68, 68, 0.08)',
            color: lastAction.success ? '#059669' : '#dc2626',
            border: `1.5px solid ${lastAction.success ? '#10b981' : '#ef4444'}`,
            fontSize: '1rem',
          }}
        >
          <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
            {lastAction.type === 'backup' ? 'Backup Result' : 'Restore Result'}
          </div>
          <div>{lastAction.message}</div>
        </div>
      )}

      {restoreMeta && restorePath && (
        <RestoreConfirmationModal
          isOpen={true}
          onClose={() => {
            setRestoreMeta(null);
            setRestorePath(null);
          }}
          onConfirm={confirmRestore}
          meta={restoreMeta}
          path={restorePath}
        />
      )}

      <RestoreSuccessModal
        isOpen={isRestoreSuccess}
        onRestart={async () => {
          await window.api.invoke(IPC_CHANNELS.APP_RESTART);
        }}
      />
    </div>
  );
}
