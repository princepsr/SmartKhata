import { BaseRepository } from '../repositories/base-repository';
import { CustomerRepository } from '../repositories/customer-repository';
import {
  BillRepository,
  CreateBillInput,
  CreateBillItemInput,
  BillWithItems,
} from '../repositories/bill-repository';
import { InventoryRepository } from '../repositories/inventory-repository';
import { ProductRepository, Product } from '../repositories/product-repository';
import { SettingsService } from './settings-service';
import {
  NotFoundError,
  InactiveEntityError,
  InsufficientStockError,
} from './errors/service-errors';
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
      const fetchedProducts: Map<number, Product> = new Map(); // Cache products for later steps
      let subtotal = 0;
      let gstTotal = 0;

      const config = SettingsService.getInstance().getConfig();

      saleData.items.forEach((item) => {
        // Get product details
        const product = this.productRepo.findById(item.productId);
        if (!product) {
          throw new NotFoundError('Product', item.productId);
        }

        if (!product.isActive) {
          throw new InactiveEntityError('Product', item.productId);
        }

        // Cache for reuse in inventory logging step
        fetchedProducts.set(item.productId, product);

        // Check stock availability and deduct (skip in billing-only mode OR if product doesn't track inventory)
        if (!config.billingOnly && product.trackInventory) {
          if (product.stockQty < item.quantity) {
            throw new InsufficientStockError(
              product.id,
              product.name,
              product.stockQty,
              item.quantity
            );
          }
          this.productRepo.updateStock(item.productId, -item.quantity);
        }
        // Note: updateStock() validates stock and throws if insufficient

        // Calculate line totals
        let lineSubtotal: number;
        let lineGst: number;
        let lineTotal: number;

        // Force exclusive if master switch is ON
        const isGstInclusive = config.gstExclusiveMode ? false : product.isGstInclusive;

        if (isGstInclusive) {
          // Price is inclusive: Total = Price * Qty, Subtotal = Total / (1 + GST%)
          lineTotal = Math.round(product.salePrice * item.quantity * 100) / 100;
          if (config.gstEnabled && product.gstPercent > 0) {
            lineGst = Math.round(lineTotal * (product.gstPercent / 100) * 100) / 100;
            lineSubtotal = Math.round((lineTotal - lineGst) * 100) / 100;
          } else {
            lineSubtotal = lineTotal;
            lineGst = 0;
          }
        } else {
          // Price is exclusive: Subtotal = Price * Qty, Total = Subtotal * (1 + GST%)
          lineSubtotal = Math.round(product.salePrice * item.quantity * 100) / 100;
          lineGst = config.gstEnabled
            ? Math.round(((lineSubtotal * product.gstPercent) / 100) * 100) / 100
            : 0;
          lineTotal = Math.round((lineSubtotal + lineGst) * 100) / 100;
        }

        // Accumulate totals
        subtotal = Math.round((subtotal + lineSubtotal) * 100) / 100;
        gstTotal = Math.round((gstTotal + lineGst) * 100) / 100;

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
      const grandTotal = Math.round((subtotal + gstTotal - discountAmount) * 100) / 100;

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
          const product = fetchedProducts.get(item.productId);

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
        logger.info('Billing-only mode: skipped inventory changes', {
          itemCount: saleData.items.length,
        });
      }

      // ============================================
      // STEP 5: Update customer balance (if applicable)
      // ============================================
      if (saleData.customerId) {
        const paymentReceived = saleData.paymentReceived || 0;
        const balanceChange = Math.round((grandTotal - paymentReceived) * 100) / 100;

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
}
