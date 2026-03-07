import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import './KnowledgeHub.css';

const KnowledgeHubPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTopic, setActiveTopic] = useState<string>('getting_started');
  const [appVersion, setAppVersion] = useState<string>('');

  const topics = React.useMemo(
    () => [
      'getting_started',
      'billing',
      'inventory',
      'customers',
      'purchases',
      'expenses',
      'quotations',
      'barcode',
      'reports',
      'shortcuts',
      'backup',
    ],
    []
  );

  useEffect(() => {
    // Sync with location state if navigated from drawer
    const queryParams = new URLSearchParams(location.search);
    const topic = queryParams.get('topic');
    if (topic && topics.includes(topic)) {
      setActiveTopic(topic);
    }

    const fetchVersion = async () => {
      try {
        const response = await window.api.invoke<string>('app:version');
        if (response.success && response.data) {
          setAppVersion(response.data);
        }
      } catch (error) {
        console.error('Failed to get app version:', error);
      }
    };
    fetchVersion();
  }, [location, topics]);

  const renderContent = (topic: string) => {
    const content = t(`help.topics.${topic}.content`);
    const parts = content.split(/(WHY:|FROM SCRATCH:|शुरुआत से:|क्यों:|PRO TIP:|प्रो टिप:)/g);

    let currentLabel = '';
    const sections: React.ReactNode[] = [];

    parts.forEach((part, i) => {
      const trimPart = part.trim();
      if (!trimPart) {
        return;
      }

      if (trimPart.match(/^(WHY:|क्यों:)$/)) {
        currentLabel = 'WHY';
      } else if (trimPart.match(/^(FROM SCRATCH:|शुरुआत से:)$/)) {
        currentLabel = 'HOW';
      } else if (trimPart.match(/^(PRO TIP:|प्रो टिप:)$/)) {
        currentLabel = 'TIP';
      } else {
        if (currentLabel === 'WHY') {
          sections.push(
            <div key={`why-${i}`} className="kh-section">
              <h2 className="kh-section-title">{t('common.why')}</h2>
              <div className="kh-purpose-box">
                {trimPart.split('\n').map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            </div>
          );
        } else if (currentLabel === 'HOW') {
          sections.push(
            <div key={`how-${i}`} className="kh-section">
              <h2 className="kh-section-title">{t('common.how')}</h2>
              <div className="kh-step-list">
                {trimPart.split('\n').map((line, idx) => {
                  const stepMatch = line.match(/^(\d+)\.\s*(.*)/);
                  if (stepMatch) {
                    return (
                      <div key={idx} className="kh-step-item">
                        <div className="kh-step-number">{stepMatch[1]}</div>
                        <div className="kh-step-content">{stepMatch[2]}</div>
                      </div>
                    );
                  }
                  return (
                    <p key={idx} style={{ paddingLeft: '48px' }}>
                      {line}
                    </p>
                  );
                })}
              </div>
              <div className="kh-media-placeholder">
                <p>Visual Guide for {t(`help.topics.${topic}.title`)} coming soon...</p>
              </div>
            </div>
          );
        } else if (currentLabel === 'TIP') {
          sections.push(
            <div key={`tip-${i}`} className="kh-tip-box">
              <div className="kh-tip-icon">💡</div>
              <div className="kh-tip-content">
                <strong>{t('common.tip')}:</strong> {trimPart}
              </div>
            </div>
          );
        }
      }
    });

    return sections;
  };

  return (
    <div className="knowledge-hub animate-pure-fade">
      <header className="kh-header">
        <div className="kh-header-left">
          <button className="kh-back-btn" onClick={() => navigate(-1)}>
            ← {t('common.cancel')}
          </button>
          <h2>{t('help.title')}</h2>
        </div>
        <div className="kh-header-right">
          <span className="kh-version-tag">
            v{appVersion} • {i18n.language === 'en' ? 'English' : 'हिन्दी'}
          </span>
        </div>
      </header>

      <div className="kh-container">
        <nav className="kh-sidebar">
          <div className="kh-nav-title">{t('common.navigation')}</div>
          <ul className="kh-nav-list">
            {topics.map((topic) => (
              <li
                key={topic}
                className={`kh-nav-item ${activeTopic === topic ? 'active' : ''}`}
                onClick={() => setActiveTopic(topic)}
              >
                {t(`help.topics.${topic}.title`)
                  .replace(/\(F\d+\)/, '')
                  .trim()}
              </li>
            ))}
          </ul>
        </nav>

        <main className="kh-content">
          <article className="kh-article">
            <header className="kh-article-header">
              <h1>{t(`help.topics.${activeTopic}.title`)}</h1>
            </header>

            <div className="kh-article-body">{renderContent(activeTopic)}</div>
          </article>
        </main>
      </div>
    </div>
  );
};

export default KnowledgeHubPage;
