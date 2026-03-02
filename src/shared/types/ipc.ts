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
  hsnCode: string | null;
  stockQty: number;
  lowStockAlert: number | null;
  isActive: boolean;
  isGstInclusive: boolean;
  trackInventory: boolean;
  batchNumber?: string | null;
  expiryDate?: string | null;
  saltName?: string | null;
  uom: string;
  isWeightBased: boolean;
  stripSize: number;
  drugCategory?: string | null;
  variantGroupId?: string | null;
  createdAt: string | Date; // ISO date string over IPC, Date object in main repo
  updatedAt: string | Date; // ISO date string over IPC, Date object in main repo
}

/**
 * Bill Entity
 */
export interface Bill {
  id: number;
  billNumber: string;
  customerId: number | null;
  customerName: string | null;
  subtotal: number;
  gstTotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  discountAmount: number;
  grandTotal: number;
  paymentMode: string;
  isPrinted: boolean;
  createdAt: number | Date;
}

/**
 * Purchase Entity
 */
export interface Purchase {
  id: number;
  purchaseNumber: string;
  supplierName: string;
  supplierGstin?: string;
  invoiceNumber?: string;
  invoiceDate: string;
  subtotal: number;
  gstTotal: number;
  grandTotal: number;
  notes?: string;
  createdAt: number | Date;
}

/**
 * Purchase Order Entity
 */
export interface PurchaseOrderItem {
  id?: number;
  productId?: number;
  productName: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplierId: number;
  supplierName: string;
  poDate: string;
  totalTaxable: number;
  gstTotal: number;
  grandTotal: number;
  status: 'PENDING' | 'RECEIVED' | 'CANCELLED';
  notes?: string;
  items?: PurchaseOrderItem[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

/**
 * Credit Note Entity
 */
export interface CreditNote {
  id: number;
  creditNoteNumber: string;
  originalBillId: number;
  originalBillNumber: string;
  reason: string;
  refundAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstTotal: number;
  notes?: string;
  createdAt: number | Date;
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
/**
 * Billing Inputs
 */
export interface BillItemInput {
  productId: number;
  quantity: number;
  discountValue?: number;
  discountType?: 'amount' | 'percent';
}

export interface FinalizeBillInput {
  billNumber?: string;
  customerId?: number;
  items: BillItemInput[];
  discountAmount?: number;
  paymentMode: 'cash' | 'upi' | 'mixed';
  paymentReceived: number;
}

/**
 * Calculation Results
 */
export interface CalculatedLineItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountValue?: number;
  discountType?: 'amount' | 'percent';
  gstPercent: number;
  lineSubtotal: number;
  lineGst: number;
  lineCgst: number;
  lineSgst: number;
  lineIgst: number;
  lineTotal: number;
}

export interface BillCalculation {
  items: CalculatedLineItem[];
  subtotal: number;
  gstTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  discountAmount: number;
  grandTotal: number;
}

/**
 * Quotation Entity
 */
export interface Quotation {
  id: number;
  quotationNumber: string;
  customerId: number | null;
  customerNameSnapshot: string;
  totalTaxable: number;
  gstTotal: number;
  grandTotal: number;
  status: 'PENDING' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string | null;
  notes: string | null;
  billDiscountValue: number;
  billDiscountType: 'amount' | 'percent';
  createdAt: string | Date;
}

export interface CreateQuotationInput {
  customerId?: number;
  items: {
    productId: number;
    quantity: number;
    discountValue?: number;
    discountType?: 'amount' | 'percent';
  }[];
  billDiscountValue?: number;
  billDiscountType?: 'amount' | 'percent';
  notes?: string;
  validUntil?: string;
}
