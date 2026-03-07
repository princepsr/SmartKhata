import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import './HelpDrawer.css';
import React, { useState, useEffect, useCallback, useRef } from 'react';

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath?: string;
}

const HighlightText: React.FC<{ text: string; search: string }> = ({ text, search }) => {
  if (!search.trim()) {
    return <>{text}</>;
  }
  const parts = text.split(new RegExp(`(${search})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === search.toLowerCase() ? (
          <mark key={i} className="help-highlight">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

const HelpDrawer: React.FC<HelpDrawerProps> = ({ isOpen, onClose, currentPath }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const topicsListRef = useRef<HTMLDivElement>(null);

  const topics = [
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
  ];

  const toggleTopic = useCallback((topic: string) => {
    setExpandedTopic((prev) => (prev === topic ? null : topic));
  }, []);

  // 1. Contextual Recommendations Logic
  const sortedTopics = [...topics].sort((a, b) => {
    if (!currentPath) {
      return 0;
    }
    const pathMap: Record<string, string> = {
      '/billing': 'billing',
      '/products': 'inventory',
      '/customers': 'customers',
      '/reports': 'reports',
      '/settings': 'getting_started',
      '/purchases': 'purchases',
      '/expenses': 'expenses',
      '/quotations': 'quotations',
      '/barcode-gen': 'barcode',
    };
    const currentTopic = pathMap[currentPath];
    if (a === currentTopic) {
      return -1;
    }
    if (b === currentTopic) {
      return 1;
    }
    return 0;
  });

  const filteredTopics = sortedTopics.filter((topic) => {
    const titleMatch = t(`help.topics.${topic}.title`)
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const contentMatch = t(`help.topics.${topic}.content`)
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return titleMatch || contentMatch;
  });

  // 2. Keyboard Navigation Logic
  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedIndex((prev) => (prev < filteredTopics.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Enter' && focusedIndex !== -1) {
          e.preventDefault();
          toggleTopic(filteredTopics[focusedIndex]);
        } else if (e.key === 'Escape') {
          onClose();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
    return undefined;
  }, [isOpen, filteredTopics, focusedIndex, onClose, toggleTopic]);

  // Reset focus when search changes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [searchTerm]);

  // 3. Deep Linking Logic
  const handleLinkClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('help-deep-link')) {
        const path = target.getAttribute('data-path');
        if (path) {
          navigate(path);
          onClose();
        }
      }
    },
    [navigate, onClose]
  );

  const processContent = (text: string) => {
    // Keywords to link
    const links: Record<string, string> = {
      Billing: '/billing',
      Inventory: '/products',
      Customers: '/customers',
      Reports: '/reports',
      Settings: '/settings',
      Purchases: '/purchases',
      Expenses: '/expenses',
      Quotations: '/quotations',
      'Barcode Generator': '/barcode-gen',
    };

    let processedText: (string | React.ReactNode)[] = [text];

    Object.entries(links).forEach(([keyword, path]) => {
      const newProcessed: (string | React.ReactNode)[] = [];
      processedText.forEach((part, index) => {
        if (typeof part === 'string') {
          const splitParts = part.split(new RegExp(`(${keyword})`, 'g'));
          splitParts.forEach((sp, i) => {
            if (sp === keyword) {
              newProcessed.push(
                <span key={`${keyword}-${index}-${i}`} className="help-deep-link" data-path={path}>
                  {sp}
                </span>
              );
            } else {
              newProcessed.push(sp);
            }
          });
        } else {
          newProcessed.push(part);
        }
      });
      processedText = newProcessed;
    });

    return processedText.map((part, i) => {
      if (typeof part === 'string') {
        return <HighlightText key={i} text={part} search={searchTerm} />;
      }
      return part;
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="help-drawer-overlay" onClick={onClose}>
      <div
        className={`help-drawer-content ${isOpen ? 'open' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="help-drawer-header">
          <div className="header-title">
            <div>
              <h2>{t('help.title')}</h2>
              <p className="subtitle">{t('help.subtitle')}</p>
            </div>
          </div>
          <button className="help-close-btn" onClick={onClose} title={t('common.close')}>
            &times;
          </button>
        </div>

        <div className="help-drawer-body">
          <div className="help-search-container">
            <input
              type="text"
              className="help-search-input"
              placeholder={t('help.search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>

          <div className="help-topics-list" ref={topicsListRef} onClick={handleLinkClick}>
            {filteredTopics.length > 0 ? (
              filteredTopics.map((topic, index) => (
                <div
                  key={topic}
                  className={`help-topic-item ${expandedTopic === topic ? 'expanded' : ''} ${
                    focusedIndex === index ? 'focused' : ''
                  }`}
                >
                  <button className="topic-header" onClick={() => toggleTopic(topic)}>
                    <span className="topic-title">
                      <HighlightText text={t(`help.topics.${topic}.title`)} search={searchTerm} />
                    </span>
                  </button>
                  {expandedTopic === topic && (
                    <div className="topic-content animate-pure-fade">
                      {(() => {
                        const content = t(`help.topics.${topic}.content`);
                        const sections: React.ReactNode[] = [];

                        // Split by major headers
                        const parts = content.split(
                          /(WHY:|FROM SCRATCH:|शुरुआत से:|क्यों:|PRO TIP:|प्रो टिप:)/g
                        );

                        let currentLabel = '';
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
                            const labelText =
                              currentLabel === 'WHY'
                                ? t('common.why') || 'WHY'
                                : currentLabel === 'HOW'
                                  ? t('common.how') || 'HOW TO'
                                  : t('common.tip') || 'PRO TIP';

                            const sectionClass =
                              currentLabel === 'WHY'
                                ? 'help-section-why'
                                : currentLabel === 'HOW'
                                  ? 'help-section-how'
                                  : 'help-section-tip';

                            sections.push(
                              <div key={i} className={`help-section ${sectionClass}`}>
                                <span className="help-section-label">{labelText}</span>
                                {trimPart.split('\n').map((line, idx) => (
                                  <p key={idx}>{processContent(line)}</p>
                                ))}
                              </div>
                            );
                          }
                        });

                        return sections;
                      })()}

                      <button
                        className="open-full-hub-btn"
                        onClick={() => {
                          navigate(`/help?topic=${topic}`);
                          onClose();
                        }}
                      >
                        {t('common.read_more')} →
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="no-help-results">{t('command_center.no_results')}</div>
            )}
          </div>
        </div>

        <div className="help-drawer-footer">
          <p>{t('common.referral_share_msg')}</p>
        </div>
      </div>
    </div>
  );
};

export default HelpDrawer;
