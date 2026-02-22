import React from 'react';
import './EmptyState.css';

interface EmptyStateProps {
  title?: string;
  message: string;
  icon?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, message, icon, action }) => {
  return (
    <div className="empty-state-container animate-page-transition">
      <div className="empty-state-illustrator">
        {icon ? (
          <span className="empty-state-icon">{icon}</span>
        ) : (
          <svg
            width="120"
            height="120"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="default-empty-svg"
          >
            <path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3" />
            <path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3" />
            <path d="M4 12V8h16v4H4z" />
            <path d="M12 12v4" />
          </svg>
        )}
      </div>
      <div className="empty-state-content">
        {title && <h3 className="empty-state-title">{title}</h3>}
        <p className="empty-state-message">{message}</p>
        {action && (
          <button className="btn-primary empty-state-action" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
