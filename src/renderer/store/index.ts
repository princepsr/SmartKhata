/**
 * Store Index
 * 
 * Re-exports all Zustand stores for easy importing.
 */

export { useAppSettingsStore } from './useAppSettingsStore';
export type { AppSettings } from './useAppSettingsStore';

export { useCurrentBillStore } from './useCurrentBillStore';
export type { BillItem, CurrentBill } from './useCurrentBillStore';

export { useUIStore } from './useUIStore';
