import React from 'react';
import { Portal } from '../common/Portal';
import './RestoreConfirmationModal.css';

interface BackupMeta {
  appName: string;
  version: string;
  timestamp: string;
  shopName?: string;
  schemaVersion: number;
}

interface RestoreConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  meta: BackupMeta;
  path: string;
}

export function RestoreConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  meta,
  path,
}: RestoreConfirmationModalProps) {
  if (!isOpen) {
    return null;
  }

  const parseBackupDate = (timestamp: string) => {
    try {
      // Handle "24/02/2026, 11:24:00 am" or similar strings from toLocaleString
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString('en-IN', {
          dateStyle: 'long',
          timeStyle: 'short',
        });
      }

      // Fallback for custom formats if new Date() fails
      return timestamp;
    } catch {
      return timestamp;
    }
  };

  const backupDate = parseBackupDate(meta.timestamp);
  const fileName = path.split(/[\\/]/).pop();

  return (
    <Portal>
      <div className="modal-overlay">
        <div className="modal-content restore-modal">
          <div className="modal-header">
            <h3>Critical Action: Restore Database</h3>
          </div>

          <div className="modal-body">
            <div className="warning-banner">
              <span style={{ fontWeight: '800', marginRight: '0.5rem' }}>CRITICAL WARNING:</span>
              This action will <strong>permanently overwrite</strong> your current data. This cannot
              be undone.
            </div>

            <div className="backup-details">
              <h4>Backup Details:</h4>
              <table>
                <tbody>
                  <tr>
                    <td>
                      <strong>File:</strong>
                    </td>
                    <td>{fileName}</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Date:</strong>
                    </td>
                    <td>{backupDate}</td>
                  </tr>
                  {meta.shopName && (
                    <tr>
                      <td>
                        <strong>Shop:</strong>
                      </td>
                      <td>{meta.shopName}</td>
                    </tr>
                  )}
                  <tr>
                    <td>
                      <strong>App Version:</strong>
                    </td>
                    <td>{meta.version}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="confirmation-text">Are you absolutely sure you want to proceed?</p>
          </div>

          <div className="modal-footer">
            <button onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={onConfirm} className="btn btn-danger">
              Yes, Restore Data
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
