import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { useConfirm } from '../../hooks/useConfirm';

/**
 * Non-standard Performance.memory interface (Chrome/Electron)
 */
interface PerformanceMemory {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
}

/**
 * App Maintenance Utility Component
 *
 * Provides advanced controls for application lifecycle and data access.
 */
export function AppMaintenance() {
  const { t } = useTranslation();
  const { confirm } = useConfirm();
  const [memory, setMemory] = useState<{ used: string; total: string } | null>(null);

  useEffect(() => {
    // Simple mock for memory usage since we don't have a direct IPC for it yet
    // In a real app, this would come from process.getProcessMemoryInfo() in main
    const updateMemory = () => {
      const perf = window.performance as unknown as { memory?: PerformanceMemory };
      if (perf.memory) {
        const mem = perf.memory;
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
    if (
      await confirm({
        title: t('settings_tabs.debug.app_maintenance.relaunch'),
        message: t('settings_tabs.debug.app_maintenance.confirm_restart'),
        type: 'warning',
      })
    ) {
      await window.api.invoke(IPC_CHANNELS.APP_RESTART);
    }
  };

  const handleOpenFolder = async () => {
    await window.api.invoke(IPC_CHANNELS.APP_OPEN_USER_DATA);
  };

  return (
    <div className="debug-component-content">
      <h3 className="debug-sub-title">{t('settings_tabs.debug.app_maintenance.title')}</h3>

      <div className="debug-row">
        <div className="debug-info">
          <span className="debug-label">{t('settings_tabs.debug.app_maintenance.relaunch')}</span>
          <p className="debug-description">
            {t('settings_tabs.debug.app_maintenance.relaunch_desc')}
          </p>
        </div>
        <button onClick={handleRestart} className="btn btn-secondary">
          {t('settings_tabs.debug.app_maintenance.restart_btn')}
        </button>
      </div>

      <div className="debug-row">
        <div className="debug-info">
          <span className="debug-label">
            {t('settings_tabs.debug.app_maintenance.browse_data')}
          </span>
          <p className="debug-description">
            {t('settings_tabs.debug.app_maintenance.browse_desc')}
          </p>
        </div>
        <button onClick={handleOpenFolder} className="btn btn-secondary">
          {t('settings_tabs.debug.app_maintenance.open_folder_btn')}
        </button>
      </div>

      <div className="debug-data-grid">
        <div className="grid-item">
          <span className="label">{t('settings_tabs.debug.app_maintenance.env')}</span>
          <span className="value">Production (Vite/Electron)</span>
        </div>
        <div className="grid-item">
          <span className="label">{t('settings_tabs.debug.app_maintenance.renderer_mem')}</span>
          <span className="value">{memory ? `${memory.used} / ${memory.total}` : 'N/A'}</span>
        </div>
        <div className="grid-item">
          <span className="label">{t('settings_tabs.debug.app_maintenance.process_type')}</span>
          <span className="value">Electron High Priority</span>
        </div>
      </div>

      <div className="debug-footer-note">{t('settings_tabs.debug.app_maintenance.warning')}</div>
    </div>
  );
}
