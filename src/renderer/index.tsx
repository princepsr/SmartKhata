import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './i18n/config';
import './index.css';

/**
 * React Renderer Entry Point
 *
 * This is the entry point for the Electron renderer process.
 * It renders the React app into the DOM.
 */

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
