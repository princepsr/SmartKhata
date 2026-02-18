/**
 * Inventory Service
 *
 * Centralized business logic for inventory management.
 * Validates stock availability and prevents negative inventory.
 */

import { BaseService } from './base-service';
import { ProductRepository, Product } from '../repositories/product-repository';
import { InventoryRepository, InventoryLog } from '../repositories/inventory-repository';
import { NotFoundError } from './errors/service-errors';

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
  public getStockHistory(productId: number): InventoryLog[] {
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
      difference,
    };
  }

  /**
   * Get low stock products
   *
   * @returns Array of products with stock below alert threshold
   */
  public getLowStockProducts(): Product[] {
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
