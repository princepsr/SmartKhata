import { create } from 'zustand';

interface PopupState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'danger' | 'warning' | 'info';
  isAlert: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

interface PopupStore extends PopupState {
  showConfirm: (params: {
    title: string;
    message: string;
    type?: 'danger' | 'warning' | 'info';
    confirmLabel?: string;
    cancelLabel?: string;
  }) => Promise<boolean>;
  showAlert: (params: {
    title: string;
    message: string;
    type?: 'danger' | 'warning' | 'info';
    confirmLabel?: string;
  }) => Promise<void>;
  closePopup: () => void;
}

export const usePopupStore = create<PopupStore>((set) => ({
  isOpen: false,
  title: '',
  message: '',
  type: 'warning',
  isAlert: false,
  onConfirm: () => {},
  onClose: () => {},

  showConfirm: ({ title, message, type = 'warning', confirmLabel, cancelLabel }) => {
    return new Promise((resolve) => {
      set({
        isOpen: true,
        title,
        message,
        type,
        isAlert: false,
        confirmLabel,
        cancelLabel,
        onConfirm: () => resolve(true),
        onClose: () => resolve(false),
      });
    });
  },

  showAlert: ({ title, message, type = 'info', confirmLabel }) => {
    return new Promise((resolve) => {
      set({
        isOpen: true,
        title,
        message,
        type,
        isAlert: true,
        confirmLabel,
        onConfirm: () => resolve(),
        onClose: () => resolve(),
      });
    });
  },

  closePopup: () => {
    set({ isOpen: false });
  },
}));
