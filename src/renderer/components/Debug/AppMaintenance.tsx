import React, { useState, useEffect } from 'react';
import { IPC_CHANNELS } from '@shared/ipc/channels';

/**
 * App Maintenance Utility Component
 *
 * Provides advanced controls for application lifecycle and data access.
 */
export function AppMaintenance() {
  const [memory, setMemory] = useState<{ used: string; total: string } | null>(null);

  useEffect(() => {
    // Simple mock for memory usage since we don't have a direct IPC for it yet
    // In a real app, this would come from process.getProcessMemoryInfo() in main
    const updateMemory = () => {
      if ((window as any).performance?.memory) {
        const mem = (window as any).performance.memory;
        setMemory({
          used: `${Math.round(mem.usedJSHeapSize / 1024 / 1024)} MB`,
          total: `${Math.round(mem.jsHeapSizeLimit / 1024 / 1024)} MB`,
        });
      }
    };

    updateMemory();
    const interval = setInterval(updateMemory, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRestart = async () => {
    if (confirm('Are you sure you want to restart SmartKhata? Any unsaved changes may be lost.')) {
      await window.api.invoke(IPC_CHANNELS.APP_RESTART);
    }
  };

  const handleOpenFolder = async () => {
    await window.api.invoke(IPC_CHANNELS.APP_OPEN_USER_DATA);
  };

  return (
    <div className="debug-component-content">
      <h3 className="debug-sub-title">Advanced Maintenance</h3>

      <div className="debug-row">
        <div className="debug-info">
          <span className="debug-label">Relaunch Application</span>
          <p className="debug-description">
            Fully restart SmartKhata to clear memory and refresh system services.
          </p>
        </div>
        <button onClick={handleRestart} className="btn btn-secondary">
          Restart App
        </button>
      </div>

      <div className="debug-row">
        <div className="debug-info">
          <span className="debug-label">Browse User Data</span>
          <p className="debug-description">
            Open the system folder containing your database, logs, and local backups.
          </p>
        </div>
        <button onClick={handleOpenFolder} className="btn btn-secondary">
          Open Folder
        </button>
      </div>

      <div className="debug-data-grid">
        <div className="grid-item">
          <span className="label">Environment</span>
          <span className="value">Production (Vite/Electron)</span>
        </div>
        <div className="grid-item">
          <span className="label">Renderer Memory</span>
          <span className="value">{memory ? `${memory.used} / ${memory.total}` : 'N/A'}</span>
        </div>
        <div className="grid-item">
          <span className="label">Process Type</span>
          <span className="value">Electron High Priority</span>
        </div>
      </div>

      <div className="debug-footer-note">Maintenance: USE WITH CAUTION</div>
    </div>
  );
}
