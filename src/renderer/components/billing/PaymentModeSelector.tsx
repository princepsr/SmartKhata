import React from 'react';
import './PaymentModeSelector.css';

export type PaymentMode = 'cash' | 'upi' | 'mixed';

interface PaymentModeSelectorProps {
  currentMode: PaymentMode;
  onModeChange: (mode: PaymentMode) => void;
  disabled?: boolean;
}

const CashIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="6" width="20" height="12" rx="2"></rect>
    <circle cx="12" cy="12" r="2"></circle>
    <path d="M6 12h.01M18 12h.01"></path>
  </svg>
);

const UPIIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 17h16M4 12h16M4 7h16"></path>
    <path d="M8 7v10M16 7v10"></path>
  </svg>
);

const MixedIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
  </svg>
);

export const PaymentModeSelector: React.FC<PaymentModeSelectorProps> = ({
  currentMode,
  onModeChange,
  disabled,
}) => {
  return (
    <div className="payment-mode-selector">
      <button
        className={`mode-btn cash ${currentMode === 'cash' ? 'active' : ''}`}
        onClick={() => onModeChange('cash')}
        disabled={disabled}
      >
        <span className="mode-icon">
          <CashIcon />
        </span>
        <span className="mode-label">Cash</span>
      </button>

      <button
        className={`mode-btn upi ${currentMode === 'upi' ? 'active' : ''}`}
        onClick={() => onModeChange('upi')}
        disabled={disabled}
      >
        <span className="mode-icon">
          <UPIIcon />
        </span>
        <span className="mode-label">UPI</span>
      </button>

      <button
        className={`mode-btn mixed ${currentMode === 'mixed' ? 'active' : ''}`}
        onClick={() => onModeChange('mixed')}
        disabled={true}
        title="Mixed payment mode coming soon"
      >
        <span className="mode-icon">
          <MixedIcon />
        </span>
        <span className="mode-label">Mixed</span>
      </button>
    </div>
  );
};
