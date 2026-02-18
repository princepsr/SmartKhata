import { BaseRepository } from '../repositories/base-repository';
import { ProductRepository } from '../repositories/product-repository';
import { CustomerRepository } from '../repositories/customer-repository';
import {
  BillRepository,
  CreateBillInput,
  CreateBillItemInput,
  BillWithItems,
} from '../repositories/bill-repository';
import { InventoryRepository } from '../repositories/inventory-repository';
import { SettingsService } from './settings-service';
import { logger } from '../utils/logger';

/**
 * Sale Item Input (from UI/IPC layer)
 */
export interface SaleItemInput {
  productId: number;
  quantity: number;
}

/**
 * Complete Sale Input
 */
export interface CreateSaleInput {
  billNumber: string;
  customerId?: number;
  items: SaleItemInput[];
  paymentMode: 'cash' | 'upi' | 'mixed';
  paymentReceived?: number; // Amount paid (for credit tracking)
  discountAmount?: number;
}

/**
 * Billing Transaction Service
 *
 * Orchestrates the complete billing process in a single atomic transaction:
 * 1. Validate stock availability
 * 2. Create bill with items
 * 3. Deduct product stock
 * 4. Log inventory changes
 * 5. Update customer balance (if applicable)
 *
 * If ANY step fails, ALL changes are rolled back.
 */
export class BillingTransactionService extends BaseRepository {
  private productRepo: ProductRepository;
  private customerRepo: CustomerRepository;
  private billRepo: BillRepository;
  private inventoryRepo: InventoryRepository;

  constructor() {
    super();
    this.productRepo = new ProductRepository();
    this.customerRepo = new CustomerRepository();
    this.billRepo = new BillRepository();
    this.inventoryRepo = new InventoryRepository();
  }

  /**
   * Create a complete sale (ATOMIC TRANSACTION)
   *
   * This method ensures that all billing operations happen atomically:
   * - Bill creation
   * - Stock deduction
   * - Inventory logging
   * - Customer balance update
   *
   * If any step fails, the entire transaction is rolled back.
   *
   * @param saleData - Sale input data
   * @returns Created bill with items
   */
  public createSale(saleData: CreateSaleInput): BillWithItems {
    return this.transaction(() => {
      logger.info('Starting sale transaction', { billNumber: saleData.billNumber });

      // ============================================
      // STEP 1: Validate and prepare bill items
      // ============================================
      const billItems: CreateBillItemInput[] = [];
      let subtotal = 0;
      let gstTotal = 0;

      const config = SettingsService.getInstance().getConfig();

      saleData.items.forEach((item) => {
        // Get product details
        const product = this.productRepo.findById(item.productId);
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        if (!product.isActive) {
          throw new Error(`Product is inactive: ${product.name}`);
        }

        // Check stock availability and deduct (skip in billing-only mode OR if product doesn't track inventory)
        if (!config.billingOnly && product.trackInventory) {
          this.productRepo.updateStock(item.productId, -item.quantity);
        }
        // Note: updateStock() validates stock and throws if insufficient

        // Calculate line totals
        const lineSubtotal = product.salePrice * item.quantity;
        const lineGst = (lineSubtotal * product.gstPercent) / 100;
        const lineTotal = lineSubtotal + lineGst;

        // Accumulate totals
        subtotal += lineSubtotal;
        gstTotal += lineGst;

        // Prepare bill item
        billItems.push({
          productId: product.id,
          productNameSnapshot: product.name,
          quantity: item.quantity,
          unitPrice: product.salePrice,
          gstPercent: product.gstPercent,
          lineTotal: lineTotal,
        });
      });

      // ============================================
      // STEP 2: Calculate final totals
      // ============================================
      const discountAmount = saleData.discountAmount || 0;
      const grandTotal = subtotal + gstTotal - discountAmount;

      // ============================================
      // STEP 3: Create bill with items
      // ============================================
      const billData: CreateBillInput = {
        billNumber: saleData.billNumber,
        customerId: saleData.customerId,
        subtotal,
        gstTotal,
        discountAmount,
        grandTotal,
        paymentMode: saleData.paymentMode,
      };

      const billWithItems = this.billRepo.createBillWithItems(billData, billItems);

      logger.info('Bill created', {
        billId: billWithItems.bill.id,
        billNumber: billWithItems.bill.billNumber,
      });

      // ============================================
      // STEP 4: Log inventory changes (skip in billing-only mode)
      // ============================================
      if (!config.billingOnly) {
        let loggedCount = 0;
        saleData.items.forEach((item) => {
          // Check if product tracks inventory (need to fetch again or could cache)
          const product = this.productRepo.findById(item.productId);
          
          if (product && product.trackInventory) {
            this.inventoryRepo.logChange({
              productId: item.productId,
              changeQty: -item.quantity,
              reason: 'SALE',
              referenceId: billWithItems.bill.id,
              notes: `Bill #${saleData.billNumber}`,
            });
            loggedCount++;
          }
        });

        logger.info('Inventory changes logged', { itemCount: loggedCount });
      } else {
        logger.info('Billing-only mode: skipped inventory changes', { itemCount: saleData.items.length });
      }

      // ============================================
      // STEP 5: Update customer balance (if applicable)
      // ============================================
      if (saleData.customerId) {
        const paymentReceived = saleData.paymentReceived || 0;
        const balanceChange = grandTotal - paymentReceived;

        if (balanceChange !== 0) {
          this.customerRepo.updateBalance(saleData.customerId, balanceChange);

          logger.info('Customer balance updated', {
            customerId: saleData.customerId,
            balanceChange,
          });
        }
      }

      logger.info('Sale transaction completed', {
        billNumber: saleData.billNumber,
        grandTotal,
      });

      return billWithItems;
    });

    // Transaction guarantees:
    // - All operations succeed OR all are rolled back
    // - No partial bills, stock changes, or balance updates
    // - Atomic operation with full consistency
  }

  /**
   * Validate sale before processing (optional pre-check)
   *
   * This can be called before createSale() to validate without
   * starting a transaction. Useful for UI validation.
   *
   * @param saleData - Sale input data
   * @throws Error if validation fails
   */
  public validateSale(saleData: CreateSaleInput): void {
    // Validate items exist
    if (!saleData.items || saleData.items.length === 0) {
      throw new Error('Sale must have at least one item');
    }

    // Validate bill number
    if (!saleData.billNumber || saleData.billNumber.trim() === '') {
      throw new Error('Bill number is required');
    }

    // Check for duplicate bill number
    const existingBill = this.billRepo.findByBillNumber(saleData.billNumber);
    if (existingBill) {
      throw new Error(`Bill number already exists: ${saleData.billNumber}`);
    }

    // Validate customer exists (if provided)
    if (saleData.customerId) {
      const customer = this.customerRepo.findById(saleData.customerId);
      if (!customer) {
        throw new Error(`Customer not found: ${saleData.customerId}`);
      }
      if (!customer.isActive) {
        throw new Error(`Customer is inactive: ${customer.name}`);
      }
    }

    // Validate products and stock
    saleData.items.forEach((item) => {
      const product = this.productRepo.findById(item.productId);

      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      if (!product.isActive) {
        throw new Error(`Product is inactive: ${product.name}`);
      }

      if (item.quantity <= 0) {
        throw new Error(`Invalid quantity for ${product.name}: ${item.quantity}`);
      }

      // Skip stock check in billing-only mode OR if product doesn't track inventory
      const validateConfig = SettingsService.getInstance().getConfig();
      if (!validateConfig.billingOnly && product.trackInventory && product.stockQty < item.quantity) {
        throw new Error(
          `Insufficient stock for ${product.name}. Available: ${product.stockQty}, Required: ${item.quantity}`
        );
      }
    });

    // Validate payment mode
    const validPaymentModes = ['cash', 'upi', 'mixed'];
    if (!validPaymentModes.includes(saleData.paymentMode)) {
      throw new Error(`Invalid payment mode: ${saleData.paymentMode}`);
    }

    // Validate discount
    if (saleData.discountAmount && saleData.discountAmount < 0) {
      throw new Error('Discount amount cannot be negative');
    }
  }
}
