import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLicense } from '../../hooks/useLicense';
import './LicenseSettings.css';

const LicenseSettings: React.FC<{ onActivate: () => void }> = ({ onActivate }) => {
  const { status, loading } = useLicense();
  const { t } = useTranslation();

  if (loading || !status) {
    return (
      <div className="tab-content-wrapper fade-in">
        <div className="settings-section-card">
          <p>{t('settings_tabs.license.loading')}</p>
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
          <h2>{t('settings_tabs.license.title')}</h2>
          <button className="btn btn-primary" onClick={onActivate}>
            {status.type === 'PAID'
              ? t('settings_tabs.license.renew')
              : t('settings_tabs.license.activate')}
          </button>
        </div>

        <div className="license-info-grid">
          <div className="info-item">
            <span className="info-label">{t('settings_tabs.license.type')}</span>
            <span className={`info-value status-tag ${status.type.toLowerCase()}`}>
              {status.type}
            </span>
          </div>

          <div className="info-item">
            <span className="info-label">{t('settings_tabs.license.status')}</span>
            <span
              className={`info-value status-tag ${isCritical ? 'critical' : isWarning ? 'warning' : 'healthy'}`}
            >
              {isCritical
                ? t('settings_tabs.license.locked')
                : isWarning
                  ? t('settings_tabs.license.expiring_soon')
                  : t('settings_tabs.license.active')}
            </span>
          </div>

          <div className="info-item device-id-item">
            <span className="info-label">{t('settings_tabs.license.device_id')}</span>
            <span className="info-value code-text" title={status.deviceId}>
              {status.deviceId}
            </span>
          </div>

          {status.type === 'PAID' && (
            <div className="info-item">
              <span className="info-label">{t('settings_tabs.license.customer_id')}</span>
              <span className="info-value code-text font-bold text-lg select-all text-indigo-400">
                {status.customerId}
              </span>
            </div>
          )}

          <div className="info-item">
            <span className="info-label">{t('settings_tabs.license.expires_on')}</span>
            <span className="info-value">
              {status.expiresOn
                ? new Date(status.expiresOn).toLocaleDateString()
                : t('settings_tabs.license.na')}
            </span>
          </div>

          {status.type === 'TRIAL' && (
            <>
              <div className="info-item">
                <span className="info-label">{t('settings_tabs.license.trial_bills')}</span>
                <span className="info-value">
                  {status.billsRemaining} / {status.maxBills}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('settings_tabs.license.trial_days')}</span>
                <span className="info-value">
                  {status.daysRemaining} / {status.maxDays}
                </span>
              </div>
            </>
          )}

          {status.type === 'PAID' && status.daysRemaining !== undefined && (
            <div className="info-item">
              <span className="info-label">{t('settings_tabs.license.time_remaining')}</span>
              <span className="info-value">
                {status.daysRemaining} {t('settings_tabs.license.days')}
              </span>
            </div>
          )}
        </div>

        {isCritical && (
          <div className="alert alert-danger mt-4">
            <strong>{t('settings_tabs.license.restricted_strong')}</strong>{' '}
            {t('settings_tabs.license.restricted_msg')}
          </div>
        )}
      </div>
    </div>
  );
};

export default LicenseSettings;
