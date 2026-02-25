import React, { useEffect, useState } from 'react';
import { useAppSettingsStore } from '../../store/useAppSettingsStore';
import { useLicense } from '../../hooks/useLicense';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import '../ConfirmModal.css'; // Leverage existing modal styles

export const ReferralModal: React.FC = () => {
  const { settings, updateSettings, saveSettings } = useAppSettingsStore();
  const { status } = useLicense();
  const [isVisible, setIsVisible] = useState(false);
  const [referralCode, setReferralCode] = useState<string>('');

  useEffect(() => {
    const checkAndShowModal = async () => {
      const today = new Date().toDateString();
      const lastSeen = settings.lastReferralBannerSeen
        ? new Date(settings.lastReferralBannerSeen).toDateString()
        : null;

      // Only show once daily
      if (lastSeen !== today) {
        try {
          const res = await window.api.invoke<string>(IPC_CHANNELS.LICENSE_REFERRAL_CODE);
          if (res.success && res.data) {
            setReferralCode(res.data);
            setIsVisible(true);
          }
        } catch (error) {
          console.error('Failed to load referral code:', error);
        }
      }
    };

    checkAndShowModal();
  }, [settings.lastReferralBannerSeen]);

  const handleClose = async () => {
    setIsVisible(false);

    // Update local and DB state
    const now = new Date().toISOString();
    updateSettings({ lastReferralBannerSeen: now });
    await saveSettings({ lastReferralBannerSeen: now });
  };

  if (!isVisible) {
    return null;
  }

  const isPaid = status && status.type === 'PAID';

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content confirm-modal"
        style={{ maxWidth: '400px', borderTop: '4px solid #4f46e5' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-header info">
          <h3>🎁 Earn 10% Cashback!</h3>
          <button className="close-btn" onClick={handleClose}>
            &times;
          </button>
        </div>
        <div className="confirm-body" style={{ textAlign: 'center', paddingTop: '1rem' }}>
          <p style={{ fontSize: '1.05rem', marginBottom: '1.5rem', color: '#4b5563' }}>
            Love SmartKhata? Refer another shop and get <strong>10% commission</strong> on their
            license purchase!
          </p>

          {isPaid ? (
            <div
              style={{
                backgroundColor: '#f3f4f6',
                padding: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid #e5e7eb',
              }}
            >
              <p
                style={{
                  fontSize: '0.85rem',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.5rem',
                }}
              >
                Your Customer ID
              </p>
              <div
                className="font-mono"
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: '#4f46e5',
                  letterSpacing: '4px',
                  userSelect: 'all',
                }}
              >
                {referralCode}
              </div>
              <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                Share this code with your friends when they purchase a license.
              </p>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: '#fef2f2',
                padding: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid #fecaca',
              }}
            >
              <p style={{ fontSize: '0.9rem', color: '#991b1b', marginBottom: '0.5rem' }}>
                Activate a full license to get your unique referral code.
              </p>
              <button
                onClick={handleClose}
                className="btn-primary"
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                Okay
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
