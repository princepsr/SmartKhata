/**
 * Product Service
 *
 * Business logic for product management.
 * Handles validation, duplicate prevention, and stock adjustments.
 */

import { BaseService } from './base-service';
import {
  ProductRepository,
  CreateProductInput,
  UpdateProductInput,
} from '../repositories/product-repository';
import { InventoryRepository } from '../repositories/inventory-repository';
import { SettingsService } from './settings-service';
import {
  ValidationError,
  NotFoundError,
  DuplicateEntryError,
  InactiveEntityError,
  InvalidQuantityError,
} from './errors/service-errors';
import { DatabaseError } from '../repositories/base-repository';

/**
 * Product Input (from IPC/UI)
 */
export interface AddProductInput {
  name: string;
  sku?: string;
  barcode?: string;
  salePrice: number;
  purchasePrice?: number;
  gstPercent?: number;
  stockQty?: number;
  lowStockAlert?: number;
  trackInventory?: boolean;
  isGstInclusive?: boolean;
  isActive?: boolean;
  hsnCode?: string | null;
  batchNumber?: string;
  expiryDate?: string;
  saltName?: string;
  uom?: string;
  isWeightBased?: boolean;
  stripSize?: number;
}

/**
 * Product Update Input
 */
export interface UpdateProductData {
  name?: string;
  sku?: string;
  barcode?: string;
  salePrice?: number;
  purchasePrice?: number | null;
  gstPercent?: number;
  lowStockAlert?: number;
  isActive?: boolean;
  isGstInclusive?: boolean;
  trackInventory?: boolean;
  hsnCode?: string | null;
  batchNumber?: string;
  expiryDate?: string;
  saltName?: string;
  uom?: string;
  isWeightBased?: boolean;
  stripSize?: number;
}

/**
 * Stock Adjustment Input
 */
export interface StockAdjustmentInput {
  productId: number;
  deltaQty: number;
  reason: 'MANUAL' | 'ADJUSTMENT';
  notes?: string;
}

/**
 * Product Service
 */
export class ProductService extends BaseService {
  private productRepo: ProductRepository;
  private inventoryRepo: InventoryRepository;

  constructor() {
    super();
    this.productRepo = new ProductRepository();
    this.inventoryRepo = new InventoryRepository();
  }

  /**
   * Add a new product with validation
   */
  public addProduct(input: AddProductInput): any {
    // 1. Validate input
    this._validateProductInput(input);

    // 2. Check for duplicates
    if (input.sku) {
      const existingBySku = this.productRepo.findBySku(input.sku);
      if (existingBySku) {
        throw new DuplicateEntryError('Product', 'SKU', input.sku);
      }
    }

    if (input.barcode) {
      const existingByBarcode = this.productRepo.findByBarcode(input.barcode);
      if (existingByBarcode) {
        throw new DuplicateEntryError('Product', 'barcode', input.barcode);
      }
    }

    // 3. Create product
    const productInput: CreateProductInput = {
      name: input.name,
      sku: input.sku,
      barcode: input.barcode,
      salePrice: input.salePrice,
      purchasePrice: input.purchasePrice,
      gstPercent: input.gstPercent ?? SettingsService.getInstance().getConfig().gstPercentage,
      stockQty: input.stockQty ?? 0,
      lowStockAlert: input.lowStockAlert,
      trackInventory: input.trackInventory,
      isGstInclusive: input.isGstInclusive,
      hsnCode: input.hsnCode,
      batchNumber: input.batchNumber,
      expiryDate: input.expiryDate,
      saltName: input.saltName,
      uom: input.uom,
      isWeightBased: input.isWeightBased,
      stripSize: input.stripSize,
    };

    try {
      const product = this.productRepo.create(productInput);

      this.logInfo('Product created', {
        id: product.id,
        name: product.name,
        sku: product.sku,
      });

      return product;
    } catch (error) {
      if (error instanceof DatabaseError) {
        if (error.isCode('UNIQUE_VIOLATION')) {
          throw new DuplicateEntryError('Product', 'SKU or barcode', input.sku || input.barcode);
        }
      }
      throw error;
    }
  }

  /**
   * Bulk import products
   */
  public importProducts(inputs: AddProductInput[]): any[] {
    // 1. Validate all inputs first
    inputs.forEach((input, index) => {
      try {
        this._validateProductInput(input);
      } catch (err: any) {
        throw new ValidationError(`Row ${index + 1}: ${err.message}`, err.field);
      }
    });

    // 2. Prepare inputs
    const createInputs: CreateProductInput[] = inputs.map((input) => ({
      name: input.name,
      sku: input.sku,
      barcode: input.barcode,
      salePrice: input.salePrice,
      purchasePrice: input.purchasePrice,
      gstPercent: input.gstPercent ?? SettingsService.getInstance().getConfig().gstPercentage,
      stockQty: input.stockQty ?? 0,
      lowStockAlert: input.lowStockAlert,
      trackInventory: input.trackInventory,
      isGstInclusive: input.isGstInclusive,
      hsnCode: input.hsnCode,
    }));

    // 3. Execute batch create
    try {
      const products = this.productRepo.createBatch(createInputs);

      this.logInfo('Bulk product import', { count: products.length });

      return products;
    } catch (error) {
      if (error instanceof DatabaseError) {
        if (error.isCode('UNIQUE_VIOLATION')) {
          throw new DuplicateEntryError('Product', 'SKU or barcode', 'in batch');
        }
      }
      throw error;
    }
  }

  /**
   * Update product with validation
   */
  public updateProduct(id: number, updates: UpdateProductData): any {
    // 1. Check product exists
    const product = this.productRepo.findById(id);
    if (!product) {
      throw new NotFoundError('Product', id);
    }

    // 2. Validate updates
    if (updates.name !== undefined && updates.name.trim() === '') {
      throw new ValidationError('Product name cannot be empty', 'name');
    }

    if (updates.salePrice !== undefined && updates.salePrice <= 0) {
      throw new ValidationError('Sale price must be positive', 'salePrice');
    }

    if (updates.gstPercent !== undefined && (updates.gstPercent < 0 || updates.gstPercent > 100)) {
      throw new ValidationError('GST percent must be between 0 and 100', 'gstPercent');
    }

    // 3. Check for duplicate SKU/barcode (if changing)
    if (updates.sku && updates.sku !== product.sku) {
      const existingBySku = this.productRepo.findBySku(updates.sku);
      if (existingBySku && existingBySku.id !== id) {
        throw new DuplicateEntryError('Product', 'SKU', updates.sku);
      }
    }

    if (updates.barcode && updates.barcode !== product.barcode) {
      const existingByBarcode = this.productRepo.findByBarcode(updates.barcode);
      if (existingByBarcode && existingByBarcode.id !== id) {
        throw new DuplicateEntryError('Product', 'barcode', updates.barcode);
      }
    }

    // 4. Update product
    const updateInput: UpdateProductInput = {
      name: updates.name,
      sku: updates.sku,
      barcode: updates.barcode,
      salePrice: updates.salePrice,
      purchasePrice: updates.purchasePrice,
      gstPercent: updates.gstPercent,
      lowStockAlert: updates.lowStockAlert,
      isActive: updates.isActive,
      isGstInclusive: updates.isGstInclusive,
      trackInventory: updates.trackInventory,
      hsnCode: updates.hsnCode,
    };

    try {
      const updatedProduct = this.productRepo.update(id, updateInput);

      this.logInfo('Product updated', {
        id: updatedProduct.id,
        name: updatedProduct.name,
      });

      return updatedProduct;
    } catch (error) {
      if (error instanceof DatabaseError) {
        if (error.isCode('UNIQUE_VIOLATION')) {
          throw new DuplicateEntryError(
            'Product',
            'SKU or barcode',
            updates.sku || updates.barcode
          );
        }
      }
      throw error;
    }
  }

  /**
   * Adjust stock manually with inventory logging
   */
  public adjustStock(input: StockAdjustmentInput): void {
    // 1. Validate input
    if (input.deltaQty === 0) {
      throw new InvalidQuantityError('Stock adjustment cannot be zero', input.deltaQty);
    }

    // 2. Check product exists and is active
    const product = this.productRepo.findById(input.productId);
    if (!product) {
      throw new NotFoundError('Product', input.productId);
    }

    if (!product.isActive) {
      throw new InactiveEntityError('Product', input.productId);
    }

    // 3. Validate stock won't go negative
    const newStock = product.stockQty + input.deltaQty;
    if (newStock < 0) {
      throw new ValidationError(
        `Cannot deduct ${Math.abs(input.deltaQty)} units. Only ${product.stockQty} available.`,
        'deltaQty'
      );
    }

    // 4. Update stock and log change
    this.productRepo.updateStock(input.productId, input.deltaQty);

    this.inventoryRepo.logChange({
      productId: input.productId,
      changeQty: input.deltaQty,
      reason: input.reason,
      notes: input.notes || `Manual ${input.deltaQty > 0 ? 'addition' : 'deduction'}`,
    });

    this.logInfo('Stock adjusted', {
      productId: input.productId,
      productName: product.name,
      deltaQty: input.deltaQty,
      newStock: newStock,
      reason: input.reason,
    });
  }

  /**
   * Search products by name or barcode with pagination
   */
  public searchProducts(
    query: string,
    includeInactive: boolean = false,
    page: number = 1,
    limit: number = 100
  ): { items: any[]; totalCount: number; hasMore: boolean; page: number } {
    if (!query || query.trim() === '') {
      throw new ValidationError('Search query cannot be empty', 'query');
    }

    const offset = (page - 1) * limit;
    const items = this.productRepo.searchByName(query, includeInactive, limit, offset);
    const totalCount = this.productRepo.countSearch(query, includeInactive);
    const hasMore = page * limit < totalCount;

    this.logInfo('Products searched', {
      query,
      resultCount: items.length,
      totalCount,
      includeInactive,
      page,
      limit,
    });

    return { items, totalCount, hasMore, page };
  }

  /**
   * Get product by ID
   */
  public getProduct(id: number): any {
    const product = this.productRepo.findById(id);
    if (!product) {
      throw new NotFoundError('Product', id);
    }
    return product;
  }

  /**
   * Get all active products with pagination
   */
  public getAllProducts(
    includeInactive: boolean = false,
    page: number = 1,
    limit: number = 100
  ): { items: any[]; page: number } {
    const offset = (page - 1) * limit;
    return {
      items: this.productRepo.findAll(includeInactive, limit, offset),
      page,
    };
  }

  /**
   * Get total product count
   */
  public getProductCount(includeInactive: boolean = false): number {
    return this.productRepo.countAll(includeInactive);
  }

  /**
   * Get low stock products
   */
  public getLowStockProducts(): any[] {
    return this.productRepo.getLowStock();
  }

  /**
   * Deactivate product (soft delete)
   */
  public deactivateProduct(id: number): void {
    const product = this.productRepo.findById(id);
    if (!product) {
      throw new NotFoundError('Product', id);
    }

    this.productRepo.delete(id);

    this.logInfo('Product deactivated', {
      id,
      name: product.name,
    });
  }

  /**
   * Calculate product margin percentage
   */
  public calculateMargin(id: number): number {
    const product = this.productRepo.findById(id);
    if (!product) {
      throw new NotFoundError('Product', id);
    }

    if (!product.purchasePrice || product.purchasePrice === 0) {
      return 0;
    }

    const margin = ((product.salePrice - product.purchasePrice) / product.salePrice) * 100;
    return Math.round(margin * 100) / 100; // Round to 2 decimals
  }

  /**
   * Validate product input
   */
  private _validateProductInput(input: AddProductInput): void {
    // Name validation
    if (!input.name || input.name.trim() === '') {
      throw new ValidationError('Product name is required', 'name');
    }

    if (input.name.length > 200) {
      throw new ValidationError('Product name is too long (max 200 characters)', 'name');
    }

    // Sale price validation
    if (input.salePrice === undefined || input.salePrice === null) {
      throw new ValidationError('Sale price is required', 'salePrice');
    }

    if (input.salePrice <= 0) {
      throw new ValidationError('Sale price must be positive', 'salePrice');
    }

    if (input.salePrice > 1000000) {
      throw new ValidationError('Sale price is too high (max ₹10,00,000)', 'salePrice');
    }

    // Purchase price validation
    if (input.purchasePrice !== undefined && input.purchasePrice < 0) {
      throw new ValidationError('Purchase price cannot be negative', 'purchasePrice');
    }

    // GST validation
    if (input.gstPercent !== undefined) {
      if (input.gstPercent < 0 || input.gstPercent > 100) {
        throw new ValidationError('GST percent must be between 0 and 100', 'gstPercent');
      }
    }

    // Stock validation
    if (input.stockQty !== undefined && input.stockQty < 0) {
      throw new ValidationError('Stock quantity cannot be negative', 'stockQty');
    }

    // Low stock alert validation
    if (input.lowStockAlert !== undefined && input.lowStockAlert < 0) {
      throw new ValidationError('Low stock alert cannot be negative', 'lowStockAlert');
    }

    // SKU validation
    if (input.sku && input.sku.length > 50) {
      throw new ValidationError('SKU is too long (max 50 characters)', 'sku');
    }

    // Barcode validation
    if (input.barcode && input.barcode.length > 50) {
      throw new ValidationError('Barcode is too long (max 50 characters)', 'barcode');
    }
  }
  /**
   * Get stock history for a product
   */
  public getStockHistory(productId: number): any[] {
    return this.inventoryRepo.getStockHistory(productId);
  }
}
