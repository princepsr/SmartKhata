import { usePopupStore } from '../store/usePopupStore';

/**
 * Custom hook for standard SmartKhata popups.
 * Replaces window.confirm() and window.alert().
 */
export const useConfirm = () => {
  const showConfirm = usePopupStore((state) => state.showConfirm);
  const showAlert = usePopupStore((state) => state.showAlert);

  return {
    confirm: showConfirm,
    alert: showAlert,
  };
};
