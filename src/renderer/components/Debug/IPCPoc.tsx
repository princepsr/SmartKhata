import React from 'react';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { useIPC } from '../../hooks/useIPC';

/**
 * IPC Proof of Concept Component
 *
 * Standardized for the POS "Rich App" theme.
 * Provides diagnostic tools for system health.
 */
export const IPCPoc: React.FC = () => {
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
      <h3 className="debug-sub-title">IPC Connectivity Test</h3>

      <div className="debug-row">
        <div className="debug-info">
          <span className="debug-label">System Ping</span>
          <p className="debug-description">
            Verify the communication bridge with the main process.
          </p>
        </div>
        <button onClick={() => executePing()} disabled={loadingPing} className="btn btn-secondary">
          {loadingPing ? 'Pinging...' : 'Send Ping'}
        </button>
      </div>

      {pingData && (
        <div className="debug-alert success">
          <span className="icon">✅</span>
          <span className="message">
            Response: <strong>{pingData}</strong>
          </span>
        </div>
      )}

      {/* App Info Test */}
      <div className="debug-row">
        <div className="debug-info">
          <span className="debug-label">Application Metadata</span>
          <p className="debug-description">Retrieve build version and environment details.</p>
        </div>
        <button onClick={() => fetchAppInfo()} disabled={loadingInfo} className="btn btn-secondary">
          {loadingInfo ? 'Loading...' : 'Get Details'}
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
            <span className="label">Name</span>
            <span className="value">{appInfo.name}</span>
          </div>
          <div className="grid-item">
            <span className="label">Version</span>
            <span className="value">{appInfo.version}</span>
          </div>
          <div className="grid-item">
            <span className="label">Platform</span>
            <span className="value">{appInfo.platform}</span>
          </div>
        </div>
      )}

      <div className="debug-footer-note">Powered by SmartKhata IPC Client Wrapper</div>
    </div>
  );
};
