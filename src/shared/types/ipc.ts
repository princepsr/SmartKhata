/**
 * IPC Response Type
 *
 * Standard response format for all IPC handlers
 */
export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * IPC Request Metadata
 *
 * Additional context about the IPC request
 */
export interface IPCRequestMeta {
  channel: string;
  timestamp: number;
  requestId: string;
}

/**
 * Product Entity
 */
export interface Product {
  id: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  salePrice: number;
  purchasePrice: number | null;
  gstPercent: number;
  stockQty: number;
  lowStockAlert: number | null;
  isActive: boolean;
  createdAt: string; // ISO date string over IPC
  updatedAt: string; // ISO date string over IPC
}

/**
 * Backup Metadata
 */
export interface BackupMeta {
  appName: string;
  version: string;
  timestamp: string;
  shopName?: string;
  schemaVersion: number;
}
