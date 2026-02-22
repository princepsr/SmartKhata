import React from 'react';
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
      message = 'Evaluation period ended. Please verify your license for full access.';
    } else if (status.isGracePeriod) {
      message = `Evaluation ended. Please verify within ${status.graceDaysRemaining} days to avoid interruption.`;
    } else {
      message = `Evaluation: ${status.daysRemaining} days / ${status.billsRemaining} bills remaining.`;
    }
  } else if (status.type === 'PAID') {
    if (status.isLocked) {
      message = 'License period ended. Please verify your license to maintain access.';
    } else if (status.isGracePeriod) {
      message = `License ended. Please verify within ${status.graceDaysRemaining} days to avoid interruption.`;
    } else {
      message = `License valid for ${status.daysRemaining} more days.`;
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
        {status.isLocked ? 'Verify Now' : 'License Details'}
      </button>
    </div>
  );
};

export default LicenseBanner;
