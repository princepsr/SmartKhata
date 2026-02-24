import React from 'react';
import { useLicense } from '../../hooks/useLicense';
import './LicenseSettings.css';

const LicenseSettings: React.FC<{ onActivate: () => void }> = ({ onActivate }) => {
  const { status, loading } = useLicense();

  if (loading || !status) {
    return (
      <div className="tab-content-wrapper fade-in">
        <div className="settings-section-card">
          <p>Loading license information...</p>
        </div>
      </div>
    );
  }

  const isWarning =
    status.isExpired ||
    (status.daysRemaining !== undefined && status.daysRemaining <= 7) ||
    (status.billsRemaining !== undefined && status.billsRemaining <= 30);
  const isCritical = status.isLocked;

  return (
    <div className="tab-content-wrapper fade-in">
      <div className="settings-section-card">
        <div className="section-header">
          <h2>License Information</h2>
          <button className="btn btn-primary" onClick={onActivate}>
            {status.type === 'PAID' ? 'Renew / Update License' : 'Activate Full License'}
          </button>
        </div>

        <div className="license-info-grid">
          <div className="info-item">
            <span className="info-label">License Type</span>
            <span className={`info-value status-tag ${status.type.toLowerCase()}`}>
              {status.type}
            </span>
          </div>

          <div className="info-item">
            <span className="info-label">Status</span>
            <span
              className={`info-value status-tag ${isCritical ? 'critical' : isWarning ? 'warning' : 'healthy'}`}
            >
              {isCritical ? 'Locked' : isWarning ? 'Expiring Soon' : 'Active'}
            </span>
          </div>

          <div className="info-item device-id-item">
            <span className="info-label">Device ID</span>
            <span className="info-value code-text" title={status.deviceId}>
              {status.deviceId}
            </span>
          </div>

          <div className="info-item">
            <span className="info-label">Expires On</span>
            <span className="info-value">
              {status.expiresOn ? new Date(status.expiresOn).toLocaleDateString() : 'N/A'}
            </span>
          </div>

          {status.type === 'TRIAL' && (
            <>
              <div className="info-item">
                <span className="info-label">Trial Bills Left</span>
                <span className="info-value">
                  {status.billsRemaining} / {status.maxBills}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Trial Days Left</span>
                <span className="info-value">
                  {status.daysRemaining} / {status.maxDays}
                </span>
              </div>
            </>
          )}

          {status.type === 'PAID' && status.daysRemaining !== undefined && (
            <div className="info-item">
              <span className="info-label">Time Remaining</span>
              <span className="info-value">{status.daysRemaining} days</span>
            </div>
          )}
        </div>

        {isCritical && (
          <div className="alert alert-danger mt-4">
            <strong>Access Restricted:</strong> Your trial or license has ended. Please activate a
            valid key to resume printing and saving bills.
          </div>
        )}
      </div>
    </div>
  );
};

export default LicenseSettings;
