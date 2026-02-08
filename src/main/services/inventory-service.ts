/**
 * Inventory Service
 * 
 * Centralized business logic for inventory management.
 * Validates stock availability and prevents negative inventory.
 */

import { BaseService } from './base-service';
import { ProductRepository } from '../repositories/product-repository';
import { InventoryRepository } from '../repositories/inventory-repository';
import { 
  NotFoundError,
  InsufficientStockError,
  InactiveEntityError,
  InvalidQuantityError
} from './errors/service-errors';

/**
 * Stock Availability Check Result
 */
export interface StockAvailability {
  available: boolean;
  productId: number;
  productName: string;
  currentStock: number;
  requestedQty: number;
  shortfall?: number;
}

/**
 * Sale Item for Stock Deduction
 */
export interface SaleStockItem {
  productId: number;
  quantity: number;
}

/**
 * Inventory Service
 * 
 * Used by BillingService and ProductService for stock operations.
 * NOT directly accessible from IPC.
 */
export class InventoryService extends BaseService {
  private productRepo: ProductRepository;
  private inventoryRepo: InventoryRepository;

  constructor() {
    super();
    this.productRepo = new ProductRepository();
    this.inventoryRepo = new InventoryRepository();
  }

  /**
   * Check if stock is available for a product
   * 
   * @param productId - Product ID
   * @param quantity - Requested quantity
   * @returns Stock availability details
   */
  public checkAvailability(productId: number, quantity: number): StockAvailability {
    // 1. Validate quantity
    if (quantity <= 0) {
      throw new InvalidQuantityError('Quantity must be positive', quantity);
    }

    // 2. Get product
    const product = this.productRepo.findById(productId);
    if (!product) {
      throw new NotFoundError('Product', productId);
    }

    // 3. Check if product is active
    if (!product.isActive) {
      throw new InactiveEntityError('Product', productId);
    }

    // 4. Check availability
    const available = product.stockQty >= quantity;
    const shortfall = available ? undefined : quantity - product.stockQty;

    return {
      available,
      productId: product.id,
      productName: product.name,
      currentStock: product.stockQty,
      requestedQty: quantity,
      shortfall
    };
  }

  /**
   * Check availability for multiple items (batch check)
   * 
   * @param items - Array of items to check
   * @returns Array of availability results
   */
  public checkBatchAvailability(items: SaleStockItem[]): StockAvailability[] {
    return items.map(item => this.checkAvailability(item.productId, item.quantity));
  }

  /**
   * Validate all items have sufficient stock (throws on first failure)
   * 
   * @param items - Array of items to validate
   * @throws InsufficientStockError if any item has insufficient stock
   */
  public validateStockAvailability(items: SaleStockItem[]): void {
    items.forEach(item => {
      const availability = this.checkAvailability(item.productId, item.quantity);
      
      if (!availability.available) {
        throw new InsufficientStockError(
          availability.productId,
          availability.productName,
          availability.currentStock,
          availability.requestedQty
        );
      }
    });
  }

  /**
   * Apply stock deduction for a sale (with inventory logging)
   * 
   * This method should be called within a transaction by BillingService.
   * 
   * @param items - Sale items to deduct
   * @param billId - Bill ID for reference
   * @param billNumber - Bill number for notes
   */
  public applySaleStockDeduction(
    items: SaleStockItem[],
    billId: number,
    billNumber: string
  ): void {
    items.forEach(item => {
      // 1. Validate availability (throws if insufficient)
      const availability = this.checkAvailability(item.productId, item.quantity);
      
      if (!availability.available) {
        throw new InsufficientStockError(
          availability.productId,
          availability.productName,
          availability.currentStock,
          availability.requestedQty
        );
      }

      // 2. Deduct stock
      this.productRepo.updateStock(item.productId, -item.quantity);

      // 3. Log inventory change
      this.inventoryRepo.logChange({
        productId: item.productId,
        changeQty: -item.quantity,
        reason: 'SALE',
        referenceId: billId,
        notes: `Bill #${billNumber}`
      });

      this.logInfo('Stock deducted for sale', {
        productId: item.productId,
        productName: availability.productName,
        quantity: item.quantity,
        billNumber
      });
    });
  }

  /**
   * Get current stock level for a product
   * 
   * @param productId - Product ID
   * @returns Current stock quantity
   */
  public getCurrentStock(productId: number): number {
    const product = this.productRepo.findById(productId);
    if (!product) {
      throw new NotFoundError('Product', productId);
    }
    return product.stockQty;
  }

  /**
   * Get stock history for a product
   * 
   * @param productId - Product ID
   * @returns Array of inventory logs
   */
  public getStockHistory(productId: number): any[] {
    // Validate product exists
    const product = this.productRepo.findById(productId);
    if (!product) {
      throw new NotFoundError('Product', productId);
    }

    return this.inventoryRepo.getStockHistory(productId);
  }

  /**
   * Calculate total stock from inventory logs (for verification)
   * 
   * @param productId - Product ID
   * @returns Calculated stock from logs
   */
  public calculateStockFromLogs(productId: number): number {
    return this.inventoryRepo.calculateTotalStock(productId);
  }

  /**
   * Verify stock integrity (compare product.stockQty with inventory logs)
   * 
   * @param productId - Product ID
   * @returns true if stock matches logs
   */
  public verifyStockIntegrity(productId: number): {
    valid: boolean;
    productStock: number;
    calculatedStock: number;
    difference: number;
  } {
    const product = this.productRepo.findById(productId);
    if (!product) {
      throw new NotFoundError('Product', productId);
    }

    const calculatedStock = this.inventoryRepo.calculateTotalStock(productId);
    const difference = product.stockQty - calculatedStock;

    return {
      valid: difference === 0,
      productStock: product.stockQty,
      calculatedStock,
      difference
    };
  }

  /**
   * Get low stock products
   * 
   * @returns Array of products with stock below alert threshold
   */
  public getLowStockProducts(): any[] {
    return this.productRepo.getLowStock();
  }

  /**
   * Check if product is low on stock
   * 
   * @param productId - Product ID
   * @returns true if stock is below alert threshold
   */
  public isLowStock(productId: number): boolean {
    const product = this.productRepo.findById(productId);
    if (!product) {
      throw new NotFoundError('Product', productId);
    }

    if (!product.lowStockAlert) {
      return false;
    }

    return product.stockQty <= product.lowStockAlert;
  }
}
