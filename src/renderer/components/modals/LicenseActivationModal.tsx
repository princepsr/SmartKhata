import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLicense } from '../../hooks/useLicense';
import { Portal } from '../common/Portal';
import './LicenseActivationModal.css';

interface LicenseActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LicenseActivationModal: React.FC<LicenseActivationModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
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
      setMessage({ text: t('license.activation.error_full_key'), type: 'error' });
      return;
    }

    setActivating(true);
    setMessage(null);

    const result = await activateLicense(`KRN-${segments.join('-')}`);
    if (result.success) {
      setMessage({
        text: t('license.activation.success_msg'),
        type: 'success',
      });
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 2000);
    } else {
      setMessage({
        text: result.error || t('license.activation.error_generic'),
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
            <h2>{t('license.activation.title')}</h2>
            <button className="close-btn" onClick={onClose}>
              &times;
            </button>
          </div>
          <div className="modal-body">
            <p className="description">{t('license.activation.description')}</p>

            <div className="info-section">
              <div className="info-row">
                <span className="info-label">{t('license.activation.system_id')}</span>
                <code className="system-id">{status?.deviceId}</code>
                <button
                  className="copy-btn"
                  onClick={() => navigator.clipboard.writeText(status?.deviceId || '')}
                  title={t('license.activation.copy_title')}
                  style={{ fontSize: '0.8rem', padding: '2px 8px' }}
                >
                  {t('license.activation.copy')}
                </button>
              </div>
              <p className="info-note">{t('license.activation.note')}</p>
            </div>

            <form onSubmit={handleActivate}>
              <div className="form-group">
                <label>{t('license.activation.key_label')}</label>
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
              {t('license.activation.later')}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={activating || segments.join('').length !== 12}
              onClick={(e: React.MouseEvent) => handleActivate(e as unknown as React.FormEvent)}
            >
              {activating ? t('license.activation.verifying') : t('license.activation.verify_btn')}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default LicenseActivationModal;
