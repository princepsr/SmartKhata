import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './PrivacyPolicy.css';

interface PrivacyPolicyProps {
  showTitle?: boolean;
  maxHeight?: string;
  onScrollBottom?: () => void;
  mode?: 'tabs' | 'vertical';
}

type TabType = 'privacy' | 'terms';

export function PrivacyPolicy({
  showTitle = true,
  maxHeight,
  onScrollBottom,
  mode = 'tabs'
}: PrivacyPolicyProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('privacy');

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!onScrollBottom) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Math.ceil to handle sub-pixel rendering issues
    // Using a smaller buffer (5px) and ensuring it actually reached the bottom
    if (Math.ceil(scrollTop + clientHeight) >= scrollHeight - 5) {
      onScrollBottom();
    }
  };

  const renderSection = (type: TabType) => {
    const sections = t(`settings_tabs.${type}.sections`, { returnObjects: true }) as Array<{
      heading: string;
      content: string;
    }>;

    return (
      <div key={type} className="policy-document-block">
        <h2 className="policy-block-title">{t(`settings_tabs.${type}.title`)}</h2>
        <div className="policy-meta-inline">
          {t('settings_tabs.privacy.last_updated')}: {t(`settings_tabs.${type}.last_updated`)}
        </div>
        {sections.map((section, index) => (
          <section key={index} className="policy-section">
            <h3 className="policy-heading">{section.heading}</h3>
            <p className="policy-text" style={{ whiteSpace: 'pre-wrap' }}>
              {section.content}
            </p>
          </section>
        ))}
      </div>
    );
  };

  return (
    <div className={`privacy-policy-container mode-${mode}`}>
      {mode === 'tabs' && (
        <>
          <div className="policy-header-row">
            {showTitle && (
              <h2 className="policy-main-title">{t(`settings_tabs.${activeTab}.title`)}</h2>
            )}
            <div className="policy-toggle-tabs">
              <button
                className={`policy-tab-btn ${activeTab === 'privacy' ? 'active' : ''}`}
                onClick={() => setActiveTab('privacy')}
              >
                {t('settings_tabs.privacy.title')}
              </button>
              <button
                className={`policy-tab-btn ${activeTab === 'terms' ? 'active' : ''}`}
                onClick={() => setActiveTab('terms')}
              >
                {t('settings_tabs.terms.title')}
              </button>
            </div>
          </div>

          <div className="policy-meta">
            {t('settings_tabs.privacy.last_updated')}: {t(`settings_tabs.${activeTab}.last_updated`)}
          </div>
        </>
      )}

      <div
        className="policy-content-wrapper"
        style={{ maxHeight: maxHeight || 'none' }}
        onScroll={handleScroll}
      >
        {mode === 'tabs' ? (
          (
            t(`settings_tabs.${activeTab}.sections`, { returnObjects: true }) as Array<{
              heading: string;
              content: string;
            }>
          ).map((section, index) => (
              <section key={index} className="policy-section">
                <h3 className="policy-heading">{section.heading}</h3>
                <p className="policy-text" style={{ whiteSpace: 'pre-wrap' }}>
                  {section.content}
                </p>
              </section>
            )
          )
        ) : (
          <div className="vertical-policy-list">
            {renderSection('privacy')}
            <div className="policy-separator" />
            {renderSection('terms')}
          </div>
        )}
      </div>
    </div>
  );
}
