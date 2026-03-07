import React from 'react';
import { useTranslation } from 'react-i18next';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { useIPC } from '../../hooks/useIPC';

/**
 * IPC Proof of Concept Component
 *
 * Standardized for the POS "Rich App" theme.
 * Provides diagnostic tools for system health.
 */
export const IPCPoc: React.FC = () => {
  const { t } = useTranslation();
  // Use IPC Hook for App Info
  const {
    data: appInfo,
    loading: loadingInfo,
    error: errorInfo,
    execute: fetchAppInfo,
  } = useIPC<{ name: string; version: string; platform: string }>(IPC_CHANNELS.SYSTEM_GET_APP_INFO);

  const {
    data: pingData,
    loading: loadingPing,
    execute: executePing,
  } = useIPC<string>(IPC_CHANNELS.SYSTEM_PING);

  return (
    <div className="debug-component-content">
      {/* IPC Connectivity Test */}
      <h3 className="debug-sub-title">{t('settings_tabs.debug.ipc_poc.title')}</h3>

      <div className="debug-row">
        <div className="debug-info">
          <span className="debug-label">{t('settings_tabs.debug.ipc_poc.ping_title')}</span>
          <p className="debug-description">{t('settings_tabs.debug.ipc_poc.ping_desc')}</p>
        </div>
        <button onClick={() => executePing()} disabled={loadingPing} className="btn btn-secondary">
          {loadingPing
            ? t('settings_tabs.debug.ipc_poc.pinging')
            : t('settings_tabs.debug.ipc_poc.send_ping')}
        </button>
      </div>

      {pingData && (
        <div className="debug-alert success">
          <span className="icon">✅</span>
          <span className="message">
            {t('settings_tabs.debug.ipc_poc.response')}: <strong>{pingData}</strong>
          </span>
        </div>
      )}

      {/* App Info Test */}
      <div className="debug-row">
        <div className="debug-info">
          <span className="debug-label">{t('settings_tabs.debug.ipc_poc.meta_title')}</span>
          <p className="debug-description">{t('settings_tabs.debug.ipc_poc.meta_desc')}</p>
        </div>
        <button onClick={() => fetchAppInfo()} disabled={loadingInfo} className="btn btn-secondary">
          {loadingInfo
            ? t('settings_tabs.debug.ipc_poc.loading')
            : t('settings_tabs.debug.ipc_poc.get_details')}
        </button>
      </div>

      {errorInfo && (
        <div className="debug-alert error">
          <span className="icon">❌</span>
          <span className="message">Error: {errorInfo}</span>
        </div>
      )}

      {appInfo && (
        <div className="debug-data-grid">
          <div className="grid-item">
            <span className="label">{t('settings_tabs.debug.ipc_poc.name')}</span>
            <span className="value">{appInfo.name}</span>
          </div>
          <div className="grid-item">
            <span className="label">{t('settings_tabs.debug.ipc_poc.version')}</span>
            <span className="value">{appInfo.version}</span>
          </div>
          <div className="grid-item">
            <span className="label">{t('settings_tabs.debug.ipc_poc.platform')}</span>
            <span className="value">{appInfo.platform}</span>
          </div>
        </div>
      )}

      <div className="debug-footer-note">{t('settings_tabs.debug.ipc_poc.powered_by')}</div>
    </div>
  );
};
