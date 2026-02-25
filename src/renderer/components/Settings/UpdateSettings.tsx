import React, { useState, useEffect } from 'react';
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
          <h2>Critical Update Required</h2>
          <p>
            A mandatory security or stability update (v{updateInfo.version}) is required to continue
            using SmartKhata.
          </p>

          {status === UpdateStatus.AVAILABLE && (
            <button className="btn btn-primary" onClick={handleDownload}>
              Download and Install Now
            </button>
          )}

          {status === UpdateStatus.DOWNLOADING && (
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${progress?.percent || 0}%` }} />
              <span>Downloading... {Math.round(progress?.percent || 0)}%</span>
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

      <h3 className="debug-sub-title">Software Update Channel</h3>

      <div className="debug-row">
        <div className="debug-info">
          <span className="debug-label">Automatic Updates</span>
          <p className="debug-description">
            Periodically check for the latest releases and notify via banner.
          </p>
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
          <span className="debug-label">Update Status</span>
          <p className="debug-description">
            {status === UpdateStatus.IDLE && 'Ready to check for the latest release.'}
            {status === UpdateStatus.CHECKING && 'Retrieving release information from GitHub...'}
            {status === UpdateStatus.AVAILABLE &&
              `New version (v${updateInfo?.version}) is available for download.`}
            {status === UpdateStatus.DOWNLOADING &&
              `Downloading update... ${Math.round(progress?.percent || 0)}% complete.`}
            {status === UpdateStatus.DOWNLOADED &&
              'Update package is ready to be installed. A restart is required.'}
            {status === UpdateStatus.NOT_AVAILABLE &&
              'System is up to date with the latest production release.'}
            {status === UpdateStatus.ERROR && (error || 'Failed to sync with update server.')}
          </p>
        </div>
        <div className={`status-badge ${status.toLowerCase()}`}>
          {status === UpdateStatus.IDLE ? '• Ready' : ''}
          {status === UpdateStatus.CHECKING ? '◌ Checking' : ''}
          {status === UpdateStatus.AVAILABLE ? '↓ Available' : ''}
          {status === UpdateStatus.DOWNLOADING ? '⇣ Downloading' : ''}
          {status === UpdateStatus.DOWNLOADED ? '✓ Ready' : ''}
          {status === UpdateStatus.NOT_AVAILABLE ? '✓ Latest' : ''}
          {status === UpdateStatus.ERROR ? '✗ Sync Error' : ''}
        </div>
      </div>

      <div className="debug-row">
        <div className="debug-info">
          <span className="debug-label">Maintenance Controls</span>
          <p className="debug-description">
            Manually trigger a check or manage the current update lifecycle.
          </p>
        </div>
        <div className="debug-actions">
          {status === UpdateStatus.DOWNLOADED ? (
            <button className="btn btn-primary" onClick={installUpdate}>
              Install & Restart
            </button>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={handleCheck}
              disabled={status === UpdateStatus.CHECKING || status === UpdateStatus.DOWNLOADING}
            >
              {status === UpdateStatus.CHECKING ? 'Checking...' : 'Check for Updates'}
            </button>
          )}

          {status === UpdateStatus.AVAILABLE && (
            <button
              className="btn btn-primary"
              onClick={handleDownload}
              style={{ marginLeft: '8px' }}
            >
              Download Now
            </button>
          )}
        </div>
      </div>

      <div className="debug-data-grid">
        <div className="grid-item">
          <span className="label">Installed Version</span>
          <span className="value">v{currentVersion}</span>
        </div>
        <div className="grid-item">
          <span className="label">Update Channel</span>
          <span className="value">Production (Stable)</span>
        </div>
        <div className="grid-item">
          <span className="label">Release Date</span>
          <span className="value">
            {updateInfo?.releaseDate
              ? new Date(updateInfo.releaseDate).toLocaleDateString()
              : 'N/A'}
          </span>
        </div>
        <div className="grid-item">
          <span className="label">Priority</span>
          <span className="value">{updateInfo?.isMandatory ? 'Critical' : 'Routine'}</span>
        </div>
      </div>

      {status === UpdateStatus.AVAILABLE && updateInfo?.releaseNotes && (
        <div className="debug-alert info" style={{ marginTop: '1.5rem' }}>
          <span className="icon">📝</span>
          <div className="message">
            <strong>Release Notes (v{updateInfo.version}):</strong>
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

      <div className="debug-footer-note">Updates: Managed by GitHub Releases API</div>
    </div>
  );
}
