import { useState } from 'react';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import './DatabaseStatus.css';

/**
 * Database Status Component
 * 
 * Displays database connection status and metadata.
 * Proof of concept for IPC → DB wiring.
 */

interface DatabaseStatus {
  path: string;
  schemaVersion: number;
  tableCount: number;
  isReady: boolean;
}

export function DatabaseStatus() {
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDatabaseStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await window.api.invoke<DatabaseStatus>(
        IPC_CHANNELS.SYSTEM_DB_STATUS
      );

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
    <div className="database-status">
      <h3>Database Status</h3>
      
      <button 
        onClick={fetchDatabaseStatus} 
        disabled={loading}
        className="btn btn-primary"
      >
        {loading ? 'Loading...' : 'Check Database Status'}
      </button>

      {error && (
        <div className="status-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {status && (
        <div className="status-info">
          <div className="status-item">
            <span className="status-label">Status:</span>
            <span className={`status-value ${status.isReady ? 'ready' : 'not-ready'}`}>
              {status.isReady ? '✓ Ready' : '✗ Not Ready'}
            </span>
          </div>

          <div className="status-item">
            <span className="status-label">Database Path:</span>
            <span className="status-value path">{status.path}</span>
          </div>

          <div className="status-item">
            <span className="status-label">Schema Version:</span>
            <span className="status-value">{status.schemaVersion}</span>
          </div>

          <div className="status-item">
            <span className="status-label">Table Count:</span>
            <span className="status-value">{status.tableCount}</span>
          </div>
        </div>
      )}
    </div>
  );
}
