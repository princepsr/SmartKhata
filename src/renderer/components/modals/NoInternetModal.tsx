import React from 'react';
import { Portal } from '../common/Portal';
import './NoInternetModal.css';

interface NoInternetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NoInternetModal: React.FC<NoInternetModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Portal>
      <div className="modal-overlay">
        <div className="modal-content no-internet-modal">
          <div className="modal-icon warning">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-wifi-off"
            >
              <line x1="2" y1="2" x2="22" y2="22" />
              <path d="M8.5 8.5c.2-1.3.8-2 1.5-2" />
              <path d="M16.1 11.5c.9-2.2 2.3-3.6 3.9-4.5" />
              <path d="M1.3 7.1C5 4.8 10.5 3.3 16 3.8" />
              <path d="M11.4 15.8c1.6.8 3.3 1.2 5.1 1.2" />
              <path d="M5 13c1.7-1.4 3.7-2.1 5.8-2.1" />
              <circle cx="12" cy="18" r="2" />
            </svg>
          </div>
          <h2>No Internet Connection</h2>
          <p>
            SmartKhata requires an active internet connection to check for or download updates.
            Please check your network settings and try again.
          </p>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={onClose}>
              Understood
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default NoInternetModal;
