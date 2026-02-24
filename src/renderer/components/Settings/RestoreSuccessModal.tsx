import React, { useEffect, useState } from 'react';
import { Portal } from '../common/Portal';
import './RestoreSuccessModal.css';

interface RestoreSuccessModalProps {
  isOpen: boolean;
  onRestart: () => void;
}

export function RestoreSuccessModal({ isOpen, onRestart }: RestoreSuccessModalProps) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onRestart();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, onRestart]);

  if (!isOpen) {
    return null;
  }

  return (
    <Portal>
      <div className="modal-overlay">
        <div className="modal-content success-modal">
          <div className="modal-header">
            <h3>Restore Successful</h3>
          </div>

          <div className="modal-body">
            <div className="success-icon-container">
              <div className="success-check">✓</div>
            </div>

            <h2 className="success-title">Database Restored!</h2>

            <p className="success-message">
              Your data has been successfully restored. To apply the changes and ensure system
              stability, the application needs to restart.
            </p>

            <div className="countdown-container">
              Restarting automatically in <strong>{countdown}</strong> seconds...
            </div>
          </div>

          <div className="modal-footer">
            <button onClick={onRestart} className="btn btn-primary restart-btn">
              Restart Now
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
