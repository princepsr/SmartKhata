import React, { useState } from 'react';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { BackupMeta } from '@shared/types/ipc';
import { RestoreConfirmationModal } from './RestoreConfirmationModal';

/**
 * Data Management Component
 *
 * Provides UI for database backup and restoration.
 * Includes safety confirmations for high-risk operations.
 */
export function DataManagement() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAction, setLastAction] = useState<{
    type: 'backup' | 'restore';
    success: boolean;
    message: string;
  } | null>(null);

  // Restore Modal State
  const [restoreMeta, setRestoreMeta] = useState<BackupMeta | null>(null);
  const [restorePath, setRestorePath] = useState<string | null>(null);

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
      // Don't show error if user canceled
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

      // Select file and get metadata (Combines selection and reading)
      const response = await window.api.invoke<{ path: string; meta: BackupMeta }>(
        IPC_CHANNELS.BACKUP_INFO
      );

      if (response.success && response.data) {
        setRestorePath(response.data.path);
        setRestoreMeta(response.data.meta);
      }
    } catch (error) {
      console.error('Restore select error:', error);
      // Don't show error if user canceled
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
      setRestoreMeta(null); // Close modal

      const response = await window.api.invoke<{ success: boolean }>(
        IPC_CHANNELS.BACKUP_RESTORE,
        restorePath
      );

      if (response.success) {
        alert('Data restored successfully! The application will now restart to apply changes.');
        await window.api.invoke(IPC_CHANNELS.APP_RESTART);
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
    <div className="settings-section-card">
      <h2>Backup & Restore</h2>
      <p
        className="settings-description"
        style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}
      >
        Keep your data safe by creating regular backups. You can restore data from a previous backup
        if needed.
      </p>

      <div className="data-actions" style={{ display: 'flex', gap: '1rem' }}>
        <button
          onClick={handleBackup}
          disabled={isProcessing}
          className="btn btn-primary"
          style={{ flex: 1 }}
        >
          {isProcessing ? 'Processing...' : 'Create Backup'}
        </button>

        <button
          onClick={handleRestoreSelect}
          disabled={isProcessing}
          className="btn btn-danger"
          style={{ flex: 1 }}
        >
          {isProcessing ? 'Processing...' : 'Restore Data'}
        </button>
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
          {!lastAction.success && (
            <div
              style={{
                marginTop: '0.75rem',
                fontSize: '0.85rem',
                opacity: 0.85,
                paddingTop: '0.5rem',
                borderTop: '1px border-top solid rgba(220, 53, 69, 0.1)',
                fontStyle: 'italic',
              }}
            >
              <strong>Tip:</strong>{' '}
              {lastAction.message.includes('permission')
                ? 'Try picking a different folder (like Documents) or check if you have permission to write to that location.'
                : lastAction.message.includes('space')
                  ? 'Try cleaning up unnecessary files to free up disk space.'
                  : lastAction.message.includes('newer version')
                    ? 'Go to "About" to check for the latest application updates.'
                    : lastAction.message.includes('valid SmartKhata backup')
                      ? 'Ensure you are selecting the .zip file that was created during the backup process.'
                      : 'If this message persists, please take a screenshot and contact support.'}
            </div>
          )}
        </div>
      )}

      {/* Restore Confirmation Modal */}
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
    </div>
  );
}
