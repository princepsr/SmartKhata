import React, { useState } from 'react';
import { useLicense } from '../../hooks/useLicense';
import { Portal } from '../common/Portal';
import './LicenseActivationModal.css';

interface LicenseActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LicenseActivationModal: React.FC<LicenseActivationModalProps> = ({ isOpen, onClose }) => {
  const { status, activateLicense } = useLicense();
  const [segments, setSegments] = useState(['', '', '']);
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) {
    return null;
  }

  const handleSegmentChange = (index: number, value: string) => {
    const newSegments = [...segments];
    // Only allow alphanumeric, max 4 chars
    const sanitized = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 4);
    newSegments[index] = sanitized;
    setSegments(newSegments);

    // Auto-focus next field
    if (sanitized.length === 4 && index < 2) {
      const nextInput = document.getElementById(`key-segment-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    const licenseKey = segments.join('');
    if (licenseKey.length !== 12) {
      setMessage({ text: 'Please enter the full 12-character key.', type: 'error' });
      return;
    }

    setActivating(true);
    setMessage(null);

    const result = await activateLicense(`KRN-${segments.join('-')}`);
    if (result.success) {
      setMessage({
        text: 'Verification complete. SmartKhata is now fully activated!',
        type: 'success',
      });
      setTimeout(onClose, 2000);
    } else {
      setMessage({
        text: result.error || 'Verification failed. Please check your key.',
        type: 'error',
      });
    }
    setActivating(false);
  };

  return (
    <Portal>
      <div className="modal-overlay">
        <div className="modal-content license-modal">
          <div className="modal-header">
            <h2>License Verification</h2>
            <button className="close-btn" onClick={onClose}>
              &times;
            </button>
          </div>
          <div className="modal-body">
            <p className="description">
              Please enter your verification key to unlock full features.
            </p>

            <div className="info-section">
              <div className="info-row">
                <span className="info-label">System ID:</span>
                <code className="system-id">{status?.deviceId}</code>
                <button
                  className="copy-btn"
                  onClick={() => navigator.clipboard.writeText(status?.deviceId || '')}
                  title="Copy to clipboard"
                  style={{ fontSize: '0.8rem', padding: '2px 8px' }}
                >
                  Copy
                </button>
              </div>
              <p className="info-note">Provide this System ID to get your Activation Key.</p>
            </div>

            <form onSubmit={handleActivate}>
              <div className="form-group">
                <label>Activation Key</label>
                <div className="key-input-container">
                  <span className="key-prefix">KRN</span>
                  <span className="key-dash">-</span>
                  {segments.map((seg, i) => (
                    <React.Fragment key={i}>
                      <input
                        id={`key-segment-${i}`}
                        className="key-segment-input"
                        type="text"
                        value={seg}
                        onChange={(e) => handleSegmentChange(i, e.target.value)}
                        placeholder="XXXX"
                        maxLength={4}
                        autoComplete="off"
                      />
                      {i < 2 && <span className="key-dash">-</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {message && <div className={`message ${message.type}`}>{message.text}</div>}
            </form>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Later
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={activating || segments.join('').length !== 12}
              onClick={(e: any) => handleActivate(e)}
            >
              {activating ? 'Verifying...' : 'Verify License'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default LicenseActivationModal;
