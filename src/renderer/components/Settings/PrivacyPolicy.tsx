import React from 'react';
import { PRIVACY_POLICY } from '@shared/constants/privacy-policy-text';
import './PrivacyPolicy.css';

interface PrivacyPolicyProps {
  showTitle?: boolean;
  maxHeight?: string;
  onScrollBottom?: () => void;
}

export function PrivacyPolicy({ showTitle = true, maxHeight, onScrollBottom }: PrivacyPolicyProps) {
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
      {showTitle && <h2 className="policy-main-title">{PRIVACY_POLICY.title}</h2>}
      <div className="policy-meta">Last Updated: {PRIVACY_POLICY.lastUpdated}</div>

      <div
        className="policy-content-wrapper"
        style={{ maxHeight: maxHeight || 'none' }}
        onScroll={handleScroll}
      >
        {PRIVACY_POLICY.sections.map((section, index) => (
          <section key={index} className="policy-section">
            <h3 className="policy-heading">{section.heading}</h3>
            <p className="policy-text">{section.content}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
