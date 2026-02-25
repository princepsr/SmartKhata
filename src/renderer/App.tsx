import React, { useEffect } from 'react';
import AppRouter from './Router';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { useUpdateStore } from './store/useUpdateStore';
import './App.css';

/**
 * Main App Component
 *
 * Root component for SmartKhata POS application.
 * Monitors connectivity and notifies main process.
 */
function App() {
  const setOnline = useUpdateStore((state) => state.setOnline);

  useEffect(() => {
    const handleOnline = () => {
      window.api.invoke(IPC_CHANNELS.SYSTEM_CONNECTIVITY_CHANGE, true);
      setOnline(true);
    };

    const handleOffline = () => {
      window.api.invoke(IPC_CHANNELS.SYSTEM_CONNECTIVITY_CHANGE, false);
      setOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    const isOnline = navigator.onLine;
    window.api.invoke(IPC_CHANNELS.SYSTEM_CONNECTIVITY_CHANGE, isOnline);
    setOnline(isOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  return <AppRouter />;
}

export default App;
