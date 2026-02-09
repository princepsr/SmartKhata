import React, { useEffect } from 'react';
import './ConfirmModal.css';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning' | 'info';
  isAlert?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  type = 'warning',
  isAlert = false,
}) => {
  // Default confirm label based on type/mode
  const finalConfirmLabel = confirmLabel || (isAlert ? 'OK' : 'Confirm');

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      // Also handle Enter to close/confirm for alerts
      if (isAlert && e.key === 'Enter') {
        onClose();
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, isAlert, onConfirm]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-header ${type}`}>
          <h3>{title}</h3>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="confirm-body">
          <p>{message}</p>
        </div>
        <div className="confirm-footer">
          {!isAlert && (
            <button className="btn-secondary" onClick={onClose}>
              {cancelLabel}
            </button>
          )}
          <button
            className={`btn-${type === 'danger' ? 'danger' : 'primary'}`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            ref={(btn) => {
              // Auto-focus the primary button for alerts
              if (isAlert && btn) {
                btn.focus();
              }
            }}
          >
            {finalConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
