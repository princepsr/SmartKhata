import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLicense } from '../../hooks/useLicense';
import './LicenseBanner.css';

const InfoIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-info"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

const AlertIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-alert-triangle"
  >
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

interface LicenseBannerProps {
  onActivateClick: () => void;
}

const LicenseBanner: React.FC<LicenseBannerProps> = ({ onActivateClick }) => {
  const { t } = useTranslation();
  const { status, loading } = useLicense();

  if (loading || !status) {
    return null;
  }

  // Don't show banner if Paid and not expiring soon (e.g., > 15 days)
  if (
    status.type === 'PAID' &&
    !status.isExpired &&
    !status.isGracePeriod && // Explicitly check grace period too
    (status.daysRemaining === undefined || status.daysRemaining > 15)
  ) {
    return null;
  }

  const isWarning =
    status.isExpired ||
    (status.daysRemaining !== undefined && status.daysRemaining <= 7) ||
    (status.billsRemaining !== undefined && status.billsRemaining <= 30);
  const isCritical = status.isLocked; // Red only when hard locked

  let message = '';
  if (status.type === 'TRIAL') {
    if (status.isLocked) {
      message = t('license.trial_end');
    } else if (status.isGracePeriod) {
      message = t('license.trial_grace', { days: status.graceDaysRemaining });
    } else {
      message = t('license.trial_status', {
        days: status.daysRemaining,
        bills: status.billsRemaining,
      });
    }
  } else if (status.type === 'PAID') {
    if (status.isLocked) {
      message = t('license.paid_end');
    } else if (status.isGracePeriod) {
      message = t('license.paid_grace', { days: status.graceDaysRemaining });
    } else {
      message = t('license.paid_status', { days: status.daysRemaining });
    }
  }

  return (
    <div className={`license-banner ${isCritical ? 'critical' : isWarning ? 'warning' : 'info'}`}>
      <div className="banner-content">
        <span className="banner-icon">
          {isCritical || isWarning ? <AlertIcon /> : <InfoIcon />}
        </span>
        <span className="banner-message">{message}</span>
      </div>
      <button className="banner-action" onClick={onActivateClick}>
        {status.isLocked ? t('license.verify_now') : t('license.details')}
      </button>
    </div>
  );
};

export default LicenseBanner;
