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
import { NotFoundError, InsufficientStockError } from './errors/service-errors';
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
      // STEP 1: Pre-calculate totals for discount distribution
      // ============================================
      const billItems: CreateBillItemInput[] = [];
      const fetchedProducts: Map<number, Product> = new Map();
      const config = SettingsService.getInstance().getConfig();
      let subtotal = 0;
      let gstTotal = 0;

      const itemMetas: { product: Product; quantity: number; baseTotal: number }[] = [];
      let totalGrossAmount = 0;

      saleData.items.forEach((item) => {
        const product = this.productRepo.findById(item.productId);
        if (!product || !product.isActive) {
          throw new NotFoundError('Product', item.productId);
        }
        fetchedProducts.set(item.productId, product);

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

        const isGstInclusive = config.gstExclusiveMode ? false : product.isGstInclusive;
        let baseTotal: number;
        if (isGstInclusive) {
          baseTotal = product.salePrice * item.quantity;
        } else {
          const sub = product.salePrice * item.quantity;
          const gst = config.gstEnabled ? (sub * product.gstPercent) / 100 : 0;
          baseTotal = sub + gst;
        }

        totalGrossAmount += baseTotal;
        itemMetas.push({ product, quantity: item.quantity, baseTotal });
      });

      const discountAmountInput = saleData.discountAmount || 0;
      const discountFactor =
        totalGrossAmount > 0
          ? Math.max(0, totalGrossAmount - discountAmountInput) / totalGrossAmount
          : 0;

      // ============================================
      // STEP 2: Calculate discounted line items
      // ============================================
      itemMetas.forEach(({ product, quantity, baseTotal }) => {
        const discountedTotal = Math.round(baseTotal * discountFactor * 100) / 100;

        let lineSubtotal: number;
        let lineGst: number;

        if (config.gstEnabled && product.gstPercent > 0) {
          lineSubtotal = Math.round((discountedTotal / (1 + product.gstPercent / 100)) * 100) / 100;
          lineGst = Math.round((discountedTotal - lineSubtotal) * 100) / 100;
        } else {
          lineSubtotal = discountedTotal;
          lineGst = 0;
        }

        subtotal = Math.round((subtotal + lineSubtotal) * 100) / 100;
        gstTotal = Math.round((gstTotal + lineGst) * 100) / 100;

        billItems.push({
          productId: product.id,
          productNameSnapshot: product.name,
          quantity: quantity,
          unitPrice: product.salePrice,
          gstPercent: product.gstPercent,
          purchasePrice: product.purchasePrice, // Capture current cost
          lineTotal: discountedTotal,
        });
      });

      // ============================================
      // STEP 2: Calculate final totals
      // ============================================
      const grandTotal = Math.round((subtotal + gstTotal) * 100) / 100;

      // ============================================
      // STEP 3: Create bill with items
      // ============================================
      const billData: CreateBillInput = {
        billNumber: saleData.billNumber,
        customerId: saleData.customerId,
        subtotal,
        gstTotal,
        discountAmount: saleData.discountAmount || 0,
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

        // Add ledger entry for the sale
        this.customerRepo.addLedgerEntry({
          customerId: saleData.customerId,
          amount: grandTotal,
          type: 'SALE',
          referenceId: billWithItems.bill.id,
          notes: `Sale: Bill #${saleData.billNumber}`,
        });

        // Add ledger entry for the payment received (if any)
        if (paymentReceived > 0) {
          this.customerRepo.addLedgerEntry({
            customerId: saleData.customerId,
            amount: paymentReceived,
            type: 'PAYMENT_IN',
            referenceId: billWithItems.bill.id,
            notes: `Payment for Bill #${saleData.billNumber}`,
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
