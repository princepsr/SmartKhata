/**
 * Billing Service
 *
 * Single source of truth for billing business logic.
 * Handles calculation, validation, and orchestration of the billing flow.
 */

import { BaseService } from './base-service';
import { ProductRepository } from '../repositories/product-repository';
import { CustomerRepository } from '../repositories/customer-repository';
import { BillRepository, BillWithItems } from '../repositories/bill-repository';
import { SettingsService } from './settings-service';
import { BillingTransactionService } from './billing-transaction-service';
import { ValidationError, NotFoundError, InactiveEntityError } from './errors/service-errors';
import { BillItemInput, BillCalculation, FinalizeBillInput } from '@shared/types/ipc';
import { calculateBillPreview } from '@shared/utils/billing-math';

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
  public async calculateBill(
    items: BillItemInput[],
    discountAmount: number = 0
  ): Promise<BillCalculation> {
    // 1. Validate items
    if (!items || items.length === 0) {
      throw new ValidationError('Bill must have at least one item', 'items');
    }

    // 2. Validate discount amount
    if (discountAmount < 0) {
      throw new ValidationError('Discount amount cannot be negative', 'discountAmount');
    }

    const settings = SettingsService.getInstance().getConfig();
    const productIds = items.map((i) => i.productId);
    const products = await this.productRepo.findByIds(productIds);
    const productMap = new Map(products.map((p) => [p.id, p]));

    const previewItems = items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product || !product.isActive) {
        throw new NotFoundError('Product', item.productId);
      }
      return {
        product,
        quantity: item.quantity,
        discountValue: item.discountValue,
        discountType: item.discountType,
      };
    });

    const result = calculateBillPreview(
      previewItems,
      discountAmount,
      settings.gstEnabled,
      settings.gstExclusiveMode,
      settings.supplyType || 'intrastate'
    );

    // 3. Validate result
    if (result.grandTotal < 0) {
      throw new ValidationError('Discount amount exceeds the bill total', 'discountAmount');
    }

    return result;
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
  public async finalizeBill(input: FinalizeBillInput): Promise<BillWithItems> {
    // 1. Validate items
    if (!input.items || input.items.length === 0) {
      throw new ValidationError('Bill must have at least one item', 'items');
    }

    // 2. Validate payment mode
    this._validatePaymentMode(input.paymentMode);

    // 3. Validate customer (if provided)
    if (input.customerId) {
      const customer = this.customerRepo.findById(input.customerId);
      if (!customer) {
        throw new NotFoundError('Customer', input.customerId);
      }
      if (!customer.isActive) {
        throw new InactiveEntityError('Customer', input.customerId);
      }
    }

    // 4. Validate payment received
    if (input.paymentReceived !== undefined && input.paymentReceived < 0) {
      throw new ValidationError('Payment received cannot be negative', 'paymentReceived');
    }

    // 5. Execute atomic transaction
    const result = await this.transactionService.createSale(input);

    // 6. Fetch the full bill with items to return
    const finalBill = this.getBillById(result.id);

    this.logInfo('Bill finalized', {
      billNumber: finalBill.bill.billNumber,
      billId: finalBill.bill.id,
      grandTotal: finalBill.bill.grandTotal,
    });

    return finalBill;
  }

  /**
   * Get a bill by ID with its items
   *
   * Central entry point for services to retrieve bill data.
   */
  public getBillById(billId: number): BillWithItems {
    const billData = this.billRepo.findByIdWithItems(billId);

    if (!billData) {
      throw new NotFoundError('Bill', billId);
    }

    return billData;
  }

  /**
   * Generate next bill number
   *
   * Format: BILL-YYYYMMDD-NNNN
   * Example: BILL-20260208-0001
   *
   * Uses database to find the last number to ensure no collisions.
   */
  public async generateBillNumber(): Promise<string> {
    return this.billRepo.generateBillNumber();
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
   * Get the latest bill with its items
   */
  public getLastBill(): BillWithItems {
    const billData = this.billRepo.findLatestWithItems();

    if (!billData) {
      throw new NotFoundError('Bill', 'latest');
    }

    return billData;
  }
}
