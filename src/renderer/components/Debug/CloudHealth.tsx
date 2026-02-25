import React, { useState } from 'react';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { useIPC } from '../../hooks/useIPC';
import { useUpdateStore } from '../../store/useUpdateStore';
import NoInternetModal from '../modals/NoInternetModal';

/**
 * Cloud Health Diagnostic Component
 *
 * Provides visibility into Google Drive sync status.
 */
export function CloudHealth() {
  const { checkConnectivity } = useUpdateStore();
  const [showOfflineModal, setShowOfflineModal] = useState(false);

  const { data: profile, execute: fetchProfile } = useIPC<{ email: string } | null>(
    IPC_CHANNELS.GOOGLE_PROFILE
  );

  const {
    data: backupInfo,
    loading,
    error,
    execute: refreshBackupInfo,
  } = useIPC<{ name: string; size: string; modifiedTime: string }>(
    IPC_CHANNELS.GOOGLE_DRIVE_BACKUP_INFO
  );

  React.useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleFetchMetadata = async () => {
    const online = await checkConnectivity();
    if (!online) {
      setShowOfflineModal(true);
      return;
    }
    refreshBackupInfo();
  };

  return (
    <div className="debug-component-content">
      <NoInternetModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />

      <h3 className="debug-sub-title">Cloud Sync Health</h3>

      <div className="debug-row">
        <div className="debug-info">
          <span className="debug-label">Account Link Status</span>
          <p className="debug-description">
            {profile ? `Linked to ${profile.email}` : 'No Google account linked for cloud backups.'}
          </p>
        </div>
        <div className={`status-badge ${profile ? 'ready' : 'not-ready'}`}>
          {profile ? '✓ Connected' : '✗ Disconnected'}
        </div>
      </div>

      <div className="debug-row">
        <div className="debug-info">
          <span className="debug-label">Cloud Backup Metadata</span>
          <p className="debug-description">
            Retrieve the latest backup information directly from Google Drive.
          </p>
        </div>
        <button
          onClick={handleFetchMetadata}
          disabled={loading || !profile}
          className="btn btn-secondary"
        >
          {loading ? 'Fetching...' : 'Fetch Metadata'}
        </button>
      </div>

      {backupInfo && (
        <div className="debug-data-grid">
          <div className="grid-item full-width">
            <span className="label">Latest File Name</span>
            <span className="value">{backupInfo.name}</span>
          </div>
          <div className="grid-item">
            <span className="label">File Size</span>
            <span className="value">{backupInfo.size}</span>
          </div>
          <div className="grid-item">
            <span className="label">Last Modified</span>
            <span className="value">{new Date(backupInfo.modifiedTime).toLocaleString()}</span>
          </div>
          <div className="grid-item">
            <span className="label">Provider</span>
            <span className="value">Google Drive API v3</span>
          </div>
        </div>
      )}

      {error && (
        <div className="debug-alert error">
          <span className="icon">⚠️</span>
          <span className="message">{error}</span>
        </div>
      )}

      <div className="debug-footer-note">Sync: Automated (On Database Changes)</div>
    </div>
  );
}
