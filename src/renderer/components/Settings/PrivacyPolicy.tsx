import React from 'react';
import { useTranslation } from 'react-i18next';
import { PRIVACY_POLICY } from '@shared/constants/privacy-policy-text';
import './PrivacyPolicy.css';

interface PrivacyPolicyProps {
  showTitle?: boolean;
  maxHeight?: string;
  onScrollBottom?: () => void;
}

export function PrivacyPolicy({ showTitle = true, maxHeight, onScrollBottom }: PrivacyPolicyProps) {
  const { t } = useTranslation();
  const privacySections = t('settings_tabs.privacy.sections', { returnObjects: true }) as Array<{
    heading: string;
    content: string;
  }>;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!onScrollBottom) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Check if scrolled to bottom (with 10px buffer)
    if (scrollHeight - scrollTop <= clientHeight + 10) {
      onScrollBottom();
    }
  };

  return (
    <div className="privacy-policy-container">
      {showTitle && <h2 className="policy-main-title">{t('settings_tabs.privacy.title')}</h2>}
      <div className="policy-meta">
        {t('settings_tabs.privacy.last_updated')}: {PRIVACY_POLICY.lastUpdated}
      </div>

      <div
        className="policy-content-wrapper"
        style={{ maxHeight: maxHeight || 'none' }}
        onScroll={handleScroll}
      >
        {privacySections.map((section, index) => (
          <section key={index} className="policy-section">
            <h3 className="policy-heading">{section.heading}</h3>
            <p className="policy-text" style={{ whiteSpace: 'pre-wrap' }}>
              {section.content}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
