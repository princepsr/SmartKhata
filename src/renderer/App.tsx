import React, { useEffect } from 'react';
import AppRouter from './Router';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import './App.css';

/**
 * Main App Component
 *
 * Root component for SmartKhata POS application.
 * Monitors connectivity and notifies main process.
 */
function App() {
  useEffect(() => {
    const handleOnline = () => {
      window.api.invoke(IPC_CHANNELS.SYSTEM_CONNECTIVITY_CHANGE, true);
    };

    const handleOffline = () => {
      window.api.invoke(IPC_CHANNELS.SYSTEM_CONNECTIVITY_CHANGE, false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    window.api.invoke(IPC_CHANNELS.SYSTEM_CONNECTIVITY_CHANGE, navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return <AppRouter />;
}

export default App;
