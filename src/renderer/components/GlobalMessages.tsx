import { useTranslation } from 'react-i18next';
import { useUIStore } from '../store/useUIStore';
import './GlobalMessages.css';

/**
 * Global Messages Component
 *
 * Displays loading, error, and success messages from UI store.
 * Should be rendered once at the app level.
 */

function GlobalMessages() {
  const { t } = useTranslation();
  const { isLoading, error, successMessage, clearMessages } = useUIStore();

  return (
    <>
      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>{t('common.loading')}</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="message-toast message-error">
          <span className="message-icon">❌</span>
          <span className="message-text">{error}</span>
          <button className="message-close" onClick={clearMessages} aria-label="Close">
            ✕
          </button>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="message-toast message-success">
          <span className="message-icon">✅</span>
          <span className="message-text">{successMessage}</span>
          <button className="message-close" onClick={clearMessages} aria-label="Close">
            ✕
          </button>
        </div>
      )}
    </>
  );
}

export default GlobalMessages;
