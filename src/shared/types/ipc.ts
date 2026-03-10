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
  createdAt: number | Date;
  updatedAt: number | Date;
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

export interface BillItem {
  id: number;
  billId: number;
  productId: number;
  productNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  lineTotal: number;
}

export interface BillWithItems {
  bill: Bill;
  items: BillItem[];
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
  totalTaxable: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstTotal: number;
  grandTotal: number;
  notes?: string;
  paymentStatus?: 'PENDING' | 'PAID' | 'PARTIAL';
  amountPaid?: number;
  supplierId?: number;
  createdAt: number | Date;
  updatedAt: number | Date;
}

export interface PurchaseItem {
  id: number;
  purchaseId: number;
  productId: number | null;
  productName: string;
  hsnCode: string | null;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  lineTaxable: number;
  lineCgst: number;
  lineSgst: number;
  lineIgst: number;
  lineTotal: number;
  saltName: string | null;
}

export interface PurchaseWithItems {
  purchase: Purchase;
  items: PurchaseItem[];
}

export interface ITCSummary {
  totalTaxable: number;
  cgstPaid: number;
  sgstPaid: number;
  igstPaid: number;
  totalItc: number;
  purchaseCount: number;
}

export interface PurchaseNetGstLiability {
  outputGst: number;
  inputItc: number;
  netPayable: number;
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  balanceDue: number;
  isActive: boolean;
  createdAt: number | Date;
  updatedAt: number | Date;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  gstin: string | null;
  address: string | null;
  email: string | null;
  balanceDue: number;
  isActive: boolean;
  createdAt: number | Date;
  updatedAt: number | Date;
}

export interface SupplierLedgerEntryUI {
  id: number;
  supplierId: number;
  amount: number;
  type: 'PURCHASE' | 'PAYMENT_OUT' | 'PAYMENT_IN' | 'OPENING_BALANCE';
  referenceId?: number;
  referenceNumber?: string;
  notes?: string;
  createdAt: number;
}

export interface SupplierHistory {
  supplier: {
    id: number;
    name: string;
    balanceDue: number;
  };
  ledger: SupplierLedgerEntryUI[];
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
  saltName?: string;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplierId: number;
  supplierName: string;
  supplierGstin?: string;
  poDate: string;
  totalTaxable: number;
  gstTotal: number;
  grandTotal: number;
  status: 'PENDING' | 'RECEIVED' | 'CANCELLED';
  notes?: string;
  items?: PurchaseOrderItem[];
  createdAt: number | Date;
  updatedAt: number | Date;
}

/**
 * Supplier Entity
 */
export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  gstin: string | null;
  address: string | null;
  email: string | null;
  balanceDue: number;
  isActive: boolean;
  createdAt: number | Date;
  updatedAt: number | Date;
}

/**
 * Supplier Ledger Entry
 */
export interface SupplierLedgerEntry {
  id: number;
  supplierId: number;
  amount: number;
  type: 'PURCHASE' | 'PAYMENT_OUT' | 'PAYMENT_IN' | 'OPENING_BALANCE';
  referenceId?: number;
  referenceNumber?: string;
  notes?: string;
  createdAt: number | Date;
}

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
  createdAt: number | Date;
}

export interface QuotationItem {
  id: number;
  quotationId: number;
  productId: number | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountValue: number;
  discountType: 'amount' | 'percent';
  gstPercent: number;
  lineTotal: number;
  uom?: string;
  isWeightBased?: boolean;
  stripSize?: number;
  saltName?: string;
  drugCategory?: string;
  isGstInclusive?: boolean;
  trackInventory?: boolean;
}

export interface QuotationWithItems {
  quotation: Quotation;
  items: QuotationItem[];
}

/**
 * Credit Note Entity
 */
export interface CreditNote {
  id: number;
  creditNoteNumber: string;
  originalBillId: number | null;
  originalBillNumber: string | null;
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

export interface CreditNoteItem {
  id: number;
  creditNoteId: number;
  productId: number;
  productNameSnapshot: string;
  hsnCode: string | null;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  lineTaxable: number;
  lineCgst: number;
  lineSgst: number;
  lineIgst: number;
  lineTotal: number;
}

export interface CreditNoteWithItems {
  creditNote: CreditNote;
  items: CreditNoteItem[];
}

/**
 * Printer Info
 */
export interface PrinterInfo {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
  options: Record<string, string>;
}

/**
 * Sales Summary
 */
export interface SalesSummary {
  totalBills: number;
  totalSales: number;
  totalGst: number;
  totalDiscount: number;
}

/**
 * Product Stock History Item
 */
export interface ProductHistoryItem {
  id: number;
  date: string;
  changeQty: number;
  reason: string;
  reference: string;
  notes: string;
}

/**
 * Indian Medicine Suggestion
 */
export interface IndianMedicine {
  name: string;
  saltName: string;
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
 * Quotation Inputs
 */
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
 * Purchase Inputs
 */
export interface PurchaseItemServiceInput {
  productId?: number;
  productName: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  saltName?: string;
}

export interface RecordPurchaseInput {
  supplierName: string;
  supplierGstin?: string;
  invoiceNumber?: string;
  invoiceDate: string;
  items: PurchaseItemServiceInput[];
  notes?: string;
  updateInventory?: boolean;
  supplierId?: number;
  paymentStatus?: 'PENDING' | 'PAID' | 'PARTIAL';
  amountPaid?: number;
}

