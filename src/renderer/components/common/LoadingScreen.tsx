import React from 'react';
import './LoadingScreen.css';

interface LoadingScreenProps {
  message?: string;
}

/**
 * LoadingScreen Component
 *
 * A premium, engaging loader for initial application state.
 * Features animated product icon, pulsing ring, and dot indicators.
 */
export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Initializing SmartKhata...',
}) => {
  return (
    <div className="loading-screen-container">
      <div className="loader-card">
        <div className="logo-animation-wrapper">
          <div className="logo-ring-outer"></div>
          <div className="logo-ring"></div>
          <div className="logo-main">
            <img src="/icon.ico" alt="SmartKhata Logo" />
          </div>
        </div>

        <div className="loading-text-wrapper">
          <h1 className="loading-title">SmartKhata POS</h1>
          <p className="loading-subtitle">{message}</p>
          <div className="dots-container">
            <div className="dot"></div>
            <div className="dot"></div>
            <div className="dot"></div>
          </div>
        </div>
      </div>

      <div className="loading-footer">Securing your business data...</div>
    </div>
  );
};

export default LoadingScreen;
