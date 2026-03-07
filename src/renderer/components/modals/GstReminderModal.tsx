import React, { useEffect, useState, useMemo } from 'react';
import { useAppSettingsStore } from '../../store/useAppSettingsStore';
import '../ConfirmModal.css';

export const GstReminderModal: React.FC = () => {
  const { settings, updateSettings, saveSettings } = useAppSettingsStore();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only process if GST is enabled and configured
    if (!settings.gstEnabled || !settings.gstNumber) {
      return;
    }

    const today = new Date();
    const currentDay = today.getDate();

    // Only show between the 1st and 11th of the month
    if (currentDay < 1 || currentDay > 11) {
      setIsVisible(false);
      return;
    }

    const lastSeen = settings.lastGstReminderSeen ? new Date(settings.lastGstReminderSeen) : null;
    const isThisMonth =
      lastSeen &&
      lastSeen.getMonth() === today.getMonth() &&
      lastSeen.getFullYear() === today.getFullYear();

    // Show if not seen this month
    if (!isThisMonth) {
      setIsVisible(true);
    }
  }, [settings.gstEnabled, settings.gstNumber, settings.lastGstReminderSeen]);

  const dueDateText = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDate();
    const targetDate = new Date(today);

    if (currentDay > 11) {
      // Due next month
      targetDate.setMonth(targetDate.getMonth() + 1);
    }

    const monthName = targetDate.toLocaleString('default', { month: 'long' });
    return `11th of ${monthName}`;
  }, []);

  const handleClose = async () => {
    setIsVisible(false);

    // Persist that the user has seen it today
    const now = new Date().toISOString();
    updateSettings({ lastGstReminderSeen: now });
    await saveSettings({ lastGstReminderSeen: now });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content confirm-modal"
        style={{ maxWidth: '450px', borderTop: '4px solid #f59e0b' }} // Warning/orange color for reminder
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="confirm-header"
          style={{
            borderBottom: '1px solid #e5e7eb',
            paddingBottom: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b45309' }}>
            <span style={{ fontSize: '1.25rem' }}>📅</span> GST Filing Reminder
          </h3>
          <button className="close-btn" onClick={handleClose}>
            &times;
          </button>
        </div>

        <div className="confirm-body" style={{ textAlign: 'left', color: '#4b5563' }}>
          <p style={{ fontSize: '1.05rem', lineHeight: '1.5' }}>
            Remember to export and file your <strong>GSTR-1</strong> for the current period.
          </p>

          <div
            style={{
              marginTop: '1.25rem',
              padding: '1rem',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '0.5rem',
              color: '#92400e',
            }}
          >
            <p style={{ margin: 0, fontWeight: 500 }}>Deadline: By the {dueDateText}</p>
          </div>

          <button
            onClick={handleClose}
            className="btn-primary"
            style={{
              width: '100%',
              marginTop: '1.5rem',
              backgroundColor: '#f59e0b',
              borderColor: '#f59e0b',
            }}
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
};
