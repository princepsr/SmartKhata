import React from 'react';

export type PaymentMode = 'cash' | 'upi' | 'mixed';

interface PaymentModeSelectorProps {
  currentMode: PaymentMode;
  onModeChange: (mode: PaymentMode) => void;
  disabled?: boolean;
}

export const PaymentModeSelector: React.FC<PaymentModeSelectorProps> = ({
  currentMode,
  onModeChange,
  disabled
}) => {
  return (
    <div className="payment-mode-selector" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
      <button
        className={`mode-btn ${currentMode === 'cash' ? 'active' : ''}`}
        onClick={() => onModeChange('cash')}
        disabled={disabled}
        style={{
          flex: 1,
          padding: '0.75rem',
          fontSize: '1rem',
          fontWeight: 600,
          border: currentMode === 'cash' ? '2px solid #2563eb' : '1px solid #d1d5db',
          backgroundColor: currentMode === 'cash' ? '#eff6ff' : 'white',
          color: currentMode === 'cash' ? '#1d4ed8' : '#374151',
          borderRadius: '0.5rem',
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}
      >
        💵 Cash
      </button>
      
      <button
        className={`mode-btn ${currentMode === 'upi' ? 'active' : ''}`}
        onClick={() => onModeChange('upi')}
        disabled={disabled}
        style={{
          flex: 1,
          padding: '0.75rem',
          fontSize: '1rem',
          fontWeight: 600,
          border: currentMode === 'upi' ? '2px solid #7c3aed' : '1px solid #d1d5db',
          backgroundColor: currentMode === 'upi' ? '#f5f3ff' : 'white',
          color: currentMode === 'upi' ? '#6d28d9' : '#374151',
          borderRadius: '0.5rem',
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}
      >
        📱 UPI
      </button>

      {/* Future-ready Mixed Mode */}
      <button
        className={`mode-btn ${currentMode === 'mixed' ? 'active' : ''}`}
        onClick={() => onModeChange('mixed')}
        disabled={true} // Disabled for now as per requirements (future-ready)
        style={{
          flex: 1,
          padding: '0.75rem',
          fontSize: '1rem',
          fontWeight: 600,
          border: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          color: '#9ca3af',
          borderRadius: '0.5rem',
          cursor: 'not-allowed',
          opacity: 0.7
        }}
        title="Mixed payment mode coming soon"
      >
        Mixed
      </button>
    </div>
  );
};
