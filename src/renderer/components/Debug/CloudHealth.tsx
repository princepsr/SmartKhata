import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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

      <h3 className="debug-sub-title">{t('settings_tabs.debug.cloud_health.title')}</h3>

      <div className="debug-row">
        <div className="debug-info">
          <span className="debug-label">
            {t('settings_tabs.debug.cloud_health.account_status')}
          </span>
          <p className="debug-description">
            {profile
              ? t('settings_tabs.debug.cloud_health.linked_to', { email: profile.email })
              : t('settings_tabs.debug.cloud_health.not_linked')}
          </p>
        </div>
        <div className={`status-badge ${profile ? 'ready' : 'not-ready'}`}>
          {profile
            ? `✓ ${t('settings_tabs.debug.cloud_health.connected')}`
            : `✗ ${t('settings_tabs.debug.cloud_health.disconnected')}`}
        </div>
      </div>

      <div className="debug-row">
        <div className="debug-info">
          <span className="debug-label">
            {t('settings_tabs.debug.cloud_health.metadata_title')}
          </span>
          <p className="debug-description">{t('settings_tabs.debug.cloud_health.metadata_desc')}</p>
        </div>
        <button
          onClick={handleFetchMetadata}
          disabled={loading || !profile}
          className="btn btn-secondary"
        >
          {loading
            ? t('settings_tabs.debug.cloud_health.fetching')
            : t('settings_tabs.debug.cloud_health.fetch_btn')}
        </button>
      </div>

      {backupInfo && (
        <div className="debug-data-grid">
          <div className="grid-item full-width">
            <span className="label">{t('settings_tabs.debug.cloud_health.file_name')}</span>
            <span className="value">{backupInfo.name}</span>
          </div>
          <div className="grid-item">
            <span className="label">{t('settings_tabs.debug.cloud_health.file_size')}</span>
            <span className="value">{backupInfo.size}</span>
          </div>
          <div className="grid-item">
            <span className="label">{t('settings_tabs.debug.cloud_health.last_modified')}</span>
            <span className="value">{new Date(backupInfo.modifiedTime).toLocaleString()}</span>
          </div>
          <div className="grid-item">
            <span className="label">{t('settings_tabs.debug.cloud_health.provider')}</span>
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

      <div className="debug-footer-note">
        {t('settings_tabs.debug.cloud_health.automated_note')}
      </div>
    </div>
  );
}
