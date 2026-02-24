import { useState } from 'react';
import { IPC_CHANNELS } from '@shared/ipc/channels';

/**
 * Database Status Component
 *
 * Standardized for the POS "Rich App" theme.
 * Displays database connection status and metadata.
 */

interface DatabaseStatusInfo {
  path: string;
  schemaVersion: number;
  tableCount: number;
  isReady: boolean;
}

export function DatabaseStatus() {
  const [status, setStatus] = useState<DatabaseStatusInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDatabaseStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await window.api.invoke<DatabaseStatusInfo>(IPC_CHANNELS.SYSTEM_DB_STATUS);

      if (response.success && response.data) {
        setStatus(response.data);
      } else {
        setError(response.error || 'Failed to fetch database status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="debug-component-content">
      <h3 className="debug-sub-title">Storage Health</h3>

      <div className="debug-row">
        <div className="debug-info">
          <span className="debug-label">SQLite Engine Status</span>
          <p className="debug-description">
            Perform a real-time check of the local database connection.
          </p>
        </div>
        <button onClick={fetchDatabaseStatus} disabled={loading} className="btn btn-secondary">
          {loading ? 'Checking...' : 'Check Status'}
        </button>
      </div>

      {error && (
        <div className="debug-alert error">
          <span className="icon">❌</span>
          <span className="message">
            <strong>Error:</strong> {error}
          </span>
        </div>
      )}

      {status && (
        <div className="debug-data-grid database-grid">
          <div className="grid-item">
            <span className="label">Status</span>
            <span className={`value status-badge ${status.isReady ? 'ready' : 'not-ready'}`}>
              {status.isReady ? '✓ Healthy' : '✗ Unreachable'}
            </span>
          </div>
          <div className="grid-item">
            <span className="label">Database Path</span>
            <span className="value font-mono text-xs">{status.path}</span>
          </div>
          <div className="grid-item">
            <span className="label">Schema</span>
            <span className="value">v{status.schemaVersion}</span>
          </div>
          <div className="grid-item">
            <span className="label">Total Tables</span>
            <span className="value">{status.tableCount}</span>
          </div>
        </div>
      )}

      <div className="debug-footer-note">Database: SQLite 3.x (Local Storage)</div>
    </div>
  );
}
