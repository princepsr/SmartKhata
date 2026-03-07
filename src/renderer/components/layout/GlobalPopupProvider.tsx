import React from 'react';
import { usePopupStore } from '../../store/usePopupStore';
import { ConfirmModal } from '../ConfirmModal';

/**
 * Global provider for SmartKhata popups.
 * Render this once at the root of the application.
 */
export const GlobalPopupProvider: React.FC = () => {
  const {
    isOpen,
    title,
    message,
    type,
    isAlert,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onClose,
    closePopup,
  } = usePopupStore();

  const handleConfirm = () => {
    onConfirm();
    closePopup();
  };

  const handleCancel = () => {
    onClose();
    closePopup();
  };

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={handleCancel}
      onConfirm={handleConfirm}
      title={title}
      message={message}
      type={type}
      isAlert={isAlert}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
    />
  );
};
