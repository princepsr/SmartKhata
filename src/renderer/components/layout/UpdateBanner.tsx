import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUpdateStore } from '../../store/useUpdateStore';
import { UpdateStatus } from '@shared/types/update';
import './UpdateBanner.css';

/**
 * Update Banner
 *
 * Displayed globally when an update is available.
 */
const InfoIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-info"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

const UpdateBanner: React.FC = () => {
  const { status, updateInfo, dismissBanner, showDismissedBanner, refreshStatus } =
    useUpdateStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Initial fetch of current status when the banner mounts (globally in Layout)
    refreshStatus();

    // Listen for status changes from main process (e.g. startup auto-check)
    const unbindStatus = window.api.onUpdateStatus((data) => {
      useUpdateStore.getState().setStatus(data.status, data.updateInfo);
    });

    return () => {
      unbindStatus();
    };
  }, [refreshStatus]);

  if (status !== UpdateStatus.AVAILABLE || !updateInfo || showDismissedBanner) {
    return null;
  }

  // Mandatory updates are handled by a full-screen overlay in UpdateSettings or Layout
  if (updateInfo.isMandatory) {
    return null;
  }

  return (
    <div className="update-banner info">
      <div className="banner-content">
        <span className="banner-icon">
          <InfoIcon />
        </span>
        <span className="banner-message">
          A new version of SmartKhata is available (v{updateInfo.version}).
        </span>
      </div>
      <div className="banner-actions">
        <button className="banner-action secondary" onClick={dismissBanner}>
          Skip
        </button>
        <button className="banner-action" onClick={() => navigate('/settings?tab=debug')}>
          Update Now
        </button>
      </div>
    </div>
  );
};

export default UpdateBanner;
