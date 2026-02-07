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
  price: number;
  stock: number;
  barcode?: string;
}
