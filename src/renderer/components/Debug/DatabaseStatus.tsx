import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      <h3 className="debug-sub-title">{t('settings_tabs.debug.db_status.title')}</h3>

      <div className="debug-row">
        <div className="debug-info">
          <span className="debug-label">{t('settings_tabs.debug.db_status.engine_status')}</span>
          <p className="debug-description">{t('settings_tabs.debug.db_status.engine_desc')}</p>
        </div>
        <button onClick={fetchDatabaseStatus} disabled={loading} className="btn btn-secondary">
          {loading
            ? t('settings_tabs.debug.db_status.checking')
            : t('settings_tabs.debug.db_status.check_btn')}
        </button>
      </div>

      {error && (
        <div className="debug-alert error">
          <span className="icon">❌</span>
          <span className="message">
            <strong>{t('settings_tabs.debug.db_status.error')}:</strong> {error}
          </span>
        </div>
      )}

      {status && (
        <div className="debug-data-grid database-grid">
          <div className="grid-item">
            <span className="label">{t('settings_tabs.debug.db_status.status_label')}</span>
            <span className={`value status-badge ${status.isReady ? 'ready' : 'not-ready'}`}>
              {status.isReady
                ? `✓ ${t('settings_tabs.debug.db_status.healthy')}`
                : `✗ ${t('settings_tabs.debug.db_status.unreachable')}`}
            </span>
          </div>
          <div className="grid-item">
            <span className="label">{t('settings_tabs.debug.db_status.db_path')}</span>
            <span className="value font-mono text-xs">{status.path}</span>
          </div>
          <div className="grid-item">
            <span className="label">{t('settings_tabs.debug.db_status.schema')}</span>
            <span className="value">v{status.schemaVersion}</span>
          </div>
          <div className="grid-item">
            <span className="label">{t('settings_tabs.debug.db_status.total_tables')}</span>
            <span className="value">{status.tableCount}</span>
          </div>
        </div>
      )}

      <div className="debug-footer-note">{t('settings_tabs.debug.db_status.note')}</div>
    </div>
  );
}
