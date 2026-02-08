/**
 * Billing Service
 * 
 * Single source of truth for billing business logic.
 * Handles calculation, validation, and orchestration of the billing flow.
 */

import { BaseService } from './base-service';
import { ProductRepository } from '../repositories/product-repository';
import { CustomerRepository } from '../repositories/customer-repository';
import { BillRepository } from '../repositories/bill-repository';
import { BillingTransactionService, CreateSaleInput, SaleItemInput } from './billing-transaction-service';
import { 
  ValidationError, 
  NotFoundError,
  InsufficientStockError,
  InactiveEntityError,
  DuplicateEntryError,
  InvalidQuantityError
} from './errors/service-errors';

/**
 * Bill Item Input (from UI)
 */
export interface BillItemInput {
  productId: number;
  quantity: number;
}

/**
 * Bill Calculation Result
 */
export interface BillCalculation {
  items: CalculatedLineItem[];
  subtotal: number;
  gstTotal: number;
  discountAmount: number;
  grandTotal: number;
}

/**
 * Calculated Line Item
 */
export interface CalculatedLineItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  lineSubtotal: number;
  lineGst: number;
  lineTotal: number;
}

/**
 * Finalize Bill Input
 */
export interface FinalizeBillInput {
  billNumber: string;
  customerId?: number;
  items: BillItemInput[];
  discountAmount?: number;
  paymentMode: 'cash' | 'upi' | 'mixed';
  paymentReceived?: number;
}

/**
 * Billing Service
 */
export class BillingService extends BaseService {
  private productRepo: ProductRepository;
  private customerRepo: CustomerRepository;
  private billRepo: BillRepository;
  private transactionService: BillingTransactionService;

  constructor() {
    super();
    this.productRepo = new ProductRepository();
    this.customerRepo = new CustomerRepository();
    this.billRepo = new BillRepository();
    this.transactionService = new BillingTransactionService();
  }

  /**
   * Calculate bill totals (preview before finalizing)
   * 
   * This method calculates all totals WITHOUT creating a bill.
   * Useful for showing preview to user before finalizing.
   */
  public calculateBill(items: BillItemInput[], discountAmount: number = 0): BillCalculation {
    // 1. Validate items
    if (!items || items.length === 0) {
      throw new ValidationError('Bill must have at least one item', 'items');
    }

    // 2. Validate discount
    if (discountAmount < 0) {
      throw new ValidationError('Discount cannot be negative', 'discountAmount');
    }

    // 3. Calculate line items
    const calculatedItems: CalculatedLineItem[] = [];
    let subtotal = 0;
    let gstTotal = 0;

    items.forEach((item, index) => {
      // Validate quantity
      if (!item.quantity || item.quantity <= 0) {
        throw new InvalidQuantityError(
          `Quantity must be positive for item ${index + 1}`,
          item.quantity
        );
      }

      // Get product
      const product = this.productRepo.findById(item.productId);
      if (!product) {
        throw new NotFoundError('Product', item.productId);
      }

      if (!product.isActive) {
        throw new InactiveEntityError('Product', item.productId);
      }

      // Calculate line totals
      const lineSubtotal = product.salePrice * item.quantity;
      const lineGst = (lineSubtotal * product.gstPercent) / 100;
      const lineTotal = lineSubtotal + lineGst;

      // Accumulate totals
      subtotal += lineSubtotal;
      gstTotal += lineGst;

      // Add calculated item
      calculatedItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.salePrice,
        gstPercent: product.gstPercent,
        lineSubtotal,
        lineGst,
        lineTotal
      });
    });

    // 4. Calculate grand total
    const grandTotal = subtotal + gstTotal - discountAmount;

    // 5. Validate grand total is positive
    if (grandTotal < 0) {
      throw new ValidationError(
        'Grand total cannot be negative. Discount is too high.',
        'discountAmount'
      );
    }

    return {
      items: calculatedItems,
      subtotal,
      gstTotal,
      discountAmount,
      grandTotal
    };
  }

  /**
   * Finalize bill (create bill with atomic transaction)
   * 
   * This method:
   * 1. Validates all inputs
   * 2. Checks stock availability
   * 3. Creates bill atomically
   * 4. Deducts stock
   * 5. Logs inventory
   * 6. Updates customer balance
   */
  public finalizeBill(input: FinalizeBillInput): any {
    // 1. Validate bill number
    this._validateBillNumber(input.billNumber);

    // 2. Validate items
    if (!input.items || input.items.length === 0) {
      throw new ValidationError('Bill must have at least one item', 'items');
    }

    // 3. Validate payment mode
    this._validatePaymentMode(input.paymentMode);

    // 4. Validate discount
    if (input.discountAmount && input.discountAmount < 0) {
      throw new ValidationError('Discount cannot be negative', 'discountAmount');
    }

    // 5. Validate customer (if provided)
    if (input.customerId) {
      const customer = this.customerRepo.findById(input.customerId);
      if (!customer) {
        throw new NotFoundError('Customer', input.customerId);
      }
      if (!customer.isActive) {
        throw new InactiveEntityError('Customer', input.customerId);
      }
    }

    // 6. Validate payment received
    if (input.paymentReceived !== undefined && input.paymentReceived < 0) {
      throw new ValidationError('Payment received cannot be negative', 'paymentReceived');
    }

    // 7. Validate products and stock availability
    input.items.forEach((item, index) => {
      // Validate quantity
      if (!item.quantity || item.quantity <= 0) {
        throw new InvalidQuantityError(
          `Quantity must be positive for item ${index + 1}`,
          item.quantity
        );
      }

      // Get product
      const product = this.productRepo.findById(item.productId);
      if (!product) {
        throw new NotFoundError('Product', item.productId);
      }

      if (!product.isActive) {
        throw new InactiveEntityError('Product', item.productId);
      }

      // Check stock availability
      if (product.stockQty < item.quantity) {
        throw new InsufficientStockError(
          product.id,
          product.name,
          product.stockQty,
          item.quantity
        );
      }
    });

    // 8. Check for duplicate bill number
    const existingBill = this.billRepo.findByBillNumber(input.billNumber);
    if (existingBill) {
      throw new DuplicateEntryError('Bill', 'bill number', input.billNumber);
    }

    // 9. Create sale input for transaction service
    const saleInput: CreateSaleInput = {
      billNumber: input.billNumber,
      customerId: input.customerId,
      items: input.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      })),
      paymentMode: input.paymentMode,
      paymentReceived: input.paymentReceived,
      discountAmount: input.discountAmount || 0
    };

    // 10. Execute atomic transaction
    const result = this.transactionService.createSale(saleInput);

    this.logInfo('Bill finalized', {
      billNumber: input.billNumber,
      billId: result.bill.id,
      grandTotal: result.bill.grandTotal,
      itemCount: result.items.length
    });

    return result;
  }

  /**
   * Generate next bill number
   * 
   * Format: BILL-YYYYMMDD-NNNN
   * Example: BILL-20260208-0001
   */
  public generateBillNumber(): string {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    // Get today's bills to find next sequence number
    const todayBills = this.billRepo.findToday();
    const nextSequence = todayBills.length + 1;

    const billNumber = `BILL-${dateStr}-${String(nextSequence).padStart(4, '0')}`;

    return billNumber;
  }

  /**
   * Validate payment mode
   */
  private _validatePaymentMode(paymentMode: string): void {
    const validModes = ['cash', 'upi', 'mixed'];
    if (!validModes.includes(paymentMode)) {
      throw new ValidationError(
        `Invalid payment mode. Must be one of: ${validModes.join(', ')}`,
        'paymentMode'
      );
    }
  }

  /**
   * Validate bill number
   */
  private _validateBillNumber(billNumber: string): void {
    if (!billNumber || billNumber.trim() === '') {
      throw new ValidationError('Bill number is required', 'billNumber');
    }

    if (billNumber.length > 50) {
      throw new ValidationError('Bill number is too long (max 50 characters)', 'billNumber');
    }
  }
}
