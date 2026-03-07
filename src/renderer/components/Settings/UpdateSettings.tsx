import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUpdateStore } from '../../store/useUpdateStore';
import { useAppSettingsStore } from '../../store/useAppSettingsStore';
import { UpdateStatus } from '@shared/types/update';
import NoInternetModal from '../modals/NoInternetModal';
import { IPC_CHANNELS } from '@shared/ipc/channels';

/**
 * Update Settings Component
 *
 * Handles update checks, downloads, and mandatory update UI.
 */
export function UpdateSettings() {
  const { t } = useTranslation();
  const { settings, updateSettings, saveSettings } = useAppSettingsStore();
  const {
    status,
    updateInfo,
    progress,
    error,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    refreshStatus,
    checkConnectivity,
  } = useUpdateStore();

  const [currentVersion, setCurrentVersion] = useState<string>('...');
  const [showOfflineModal, setShowOfflineModal] = useState(false);

  useEffect(() => {
    refreshStatus();

    const fetchVersion = async () => {
      const version = await window.api.invoke<string>(IPC_CHANNELS.APP_VERSION);
      if (version.success && version.data) {
        setCurrentVersion(version.data);
      }
    };
    fetchVersion();

    // Listen for progress updates from main
    const unbindProgress = window.api.onUpdateProgress((data) => {
      useUpdateStore.getState().setProgress(data);
    });

    // Listen for status changes from main
    const unbindStatus = window.api.onUpdateStatus((data) => {
      useUpdateStore.getState().setStatus(data.status, data.updateInfo);
    });

    return () => {
      unbindProgress();
      unbindStatus();
    };
  }, [refreshStatus]);

  const handleCheck = async () => {
    const online = await checkConnectivity();
    if (!online) {
      setShowOfflineModal(true);
      return;
    }
    await checkForUpdates();
  };

  const handleDownload = async () => {
    const online = await checkConnectivity();
    if (!online) {
      setShowOfflineModal(true);
      return;
    }
    await downloadUpdate();
  };

  // Mandatory Update Overlay
  if (
    status !== UpdateStatus.IDLE &&
    updateInfo?.isMandatory &&
    status !== UpdateStatus.DOWNLOADED
  ) {
    return (
      <div className="mandatory-update-overlay">
        <NoInternetModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
        <div className="mandatory-modal">
          <h2>{t('settings_tabs.debug.update.critical_req')}</h2>
          <p>{t('settings_tabs.debug.update.mandatory_desc', { version: updateInfo.version })}</p>

          {status === UpdateStatus.AVAILABLE && (
            <button className="btn btn-primary" onClick={handleDownload}>
              {t('settings_tabs.debug.update.download_now')}
            </button>
          )}

          {status === UpdateStatus.DOWNLOADING && (
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${progress?.percent || 0}%` }} />
              <span>
                {t('settings_tabs.debug.update.downloading', {
                  percent: Math.round(progress?.percent || 0),
                })}
              </span>
            </div>
          )}

          {error && <p className="error-text">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="debug-component-content">
      <NoInternetModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />

      <h3 className="debug-sub-title">{t('settings_tabs.debug.update.channel_title')}</h3>

      <div className="debug-row">
        <div className="debug-info">
          <span className="debug-label">{t('settings_tabs.debug.update.auto_update')}</span>
          <p className="debug-description">{t('settings_tabs.debug.update.auto_desc')}</p>
        </div>
        <div className="debug-actions">
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.autoUpdateEnabled}
              onChange={(e) => {
                updateSettings({ autoUpdateEnabled: e.target.checked });
                saveSettings({ autoUpdateEnabled: e.target.checked });
              }}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      <div className="debug-row">
        <div className="debug-info">
          <span className="debug-label">{t('settings_tabs.debug.update.status_title')}</span>
          <p className="debug-description">
            {status === UpdateStatus.IDLE && t('settings_tabs.debug.update.status_idle')}
            {status === UpdateStatus.CHECKING && t('settings_tabs.debug.update.status_checking')}
            {status === UpdateStatus.AVAILABLE &&
              t('settings_tabs.debug.update.status_available', { version: updateInfo?.version })}
            {status === UpdateStatus.DOWNLOADING &&
              t('settings_tabs.debug.update.status_downloading', {
                percent: Math.round(progress?.percent || 0),
              })}
            {status === UpdateStatus.DOWNLOADED &&
              t('settings_tabs.debug.update.status_downloaded')}
            {status === UpdateStatus.NOT_AVAILABLE &&
              t('settings_tabs.debug.update.status_not_available')}
            {status === UpdateStatus.ERROR &&
              (error || t('settings_tabs.debug.update.status_error'))}
          </p>
        </div>
        <div className={`status-badge ${status.toLowerCase()}`}>
          {status === UpdateStatus.IDLE ? `• ${t('settings_tabs.debug.update.badge_ready')}` : ''}
          {status === UpdateStatus.CHECKING
            ? `◌ ${t('settings_tabs.debug.update.badge_checking')}`
            : ''}
          {status === UpdateStatus.AVAILABLE
            ? `↓ ${t('settings_tabs.debug.update.badge_available')}`
            : ''}
          {status === UpdateStatus.DOWNLOADING
            ? `⇣ ${t('settings_tabs.debug.update.badge_downloading')}`
            : ''}
          {status === UpdateStatus.DOWNLOADED
            ? `✓ ${t('settings_tabs.debug.update.badge_ready')}`
            : ''}
          {status === UpdateStatus.NOT_AVAILABLE
            ? `✓ ${t('settings_tabs.debug.update.badge_latest')}`
            : ''}
          {status === UpdateStatus.ERROR ? `✗ ${t('settings_tabs.debug.update.badge_error')}` : ''}
        </div>
      </div>

      <div className="debug-row">
        <div className="debug-info">
          <span className="debug-label">{t('settings_tabs.debug.update.controls_title')}</span>
          <p className="debug-description">{t('settings_tabs.debug.update.controls_desc')}</p>
        </div>
        <div className="debug-actions">
          {status === UpdateStatus.DOWNLOADED ? (
            <button className="btn btn-primary" onClick={installUpdate}>
              {t('settings_tabs.debug.update.install_restart')}
            </button>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={handleCheck}
              disabled={status === UpdateStatus.CHECKING || status === UpdateStatus.DOWNLOADING}
            >
              {status === UpdateStatus.CHECKING
                ? t('settings_tabs.debug.update.checking_btn')
                : t('settings_tabs.debug.update.check_btn')}
            </button>
          )}

          {status === UpdateStatus.AVAILABLE && (
            <button
              className="btn btn-primary"
              onClick={handleDownload}
              style={{ marginLeft: '8px' }}
            >
              {t('settings_tabs.debug.update.download_btn')}
            </button>
          )}
        </div>
      </div>

      <div className="debug-data-grid">
        <div className="grid-item">
          <span className="label">{t('settings_tabs.debug.update.installed_ver')}</span>
          <span className="value">v{currentVersion}</span>
        </div>
        <div className="grid-item">
          <span className="label">{t('settings_tabs.debug.update.channel_label')}</span>
          <span className="value">{t('settings_tabs.debug.update.production')}</span>
        </div>
        <div className="grid-item">
          <span className="label">{t('settings_tabs.debug.update.release_date')}</span>
          <span className="value">
            {updateInfo?.releaseDate
              ? new Date(updateInfo.releaseDate).toLocaleDateString()
              : 'N/A'}
          </span>
        </div>
        <div className="grid-item">
          <span className="label">{t('settings_tabs.debug.update.priority')}</span>
          <span className="value">
            {updateInfo?.isMandatory
              ? t('settings_tabs.debug.update.critical')
              : t('settings_tabs.debug.update.routine')}
          </span>
        </div>
      </div>

      {status === UpdateStatus.AVAILABLE && updateInfo?.releaseNotes && (
        <div className="debug-alert info" style={{ marginTop: '1.5rem' }}>
          <span className="icon">📝</span>
          <div className="message">
            <strong>
              {t('settings_tabs.debug.update.release_notes', { version: updateInfo.version })}
            </strong>
            <pre
              style={{
                fontSize: '11px',
                marginTop: '5px',
                opacity: 0.8,
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
              }}
            >
              {updateInfo.releaseNotes}
            </pre>
          </div>
        </div>
      )}

      {status === UpdateStatus.ERROR && (
        <div className="debug-alert error" style={{ marginTop: '1.5rem' }}>
          <span className="icon">⚠️</span>
          <span className="message">{error}</span>
        </div>
      )}

      <div className="debug-footer-note">{t('settings_tabs.debug.update.managed_by')}</div>
    </div>
  );
}
