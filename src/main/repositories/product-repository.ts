import { BaseRepository, DatabaseError } from './base-repository';
import { logger } from '../utils/logger';

/**
 * Product Domain Object (application layer)
 * Monetary values in rupees, percentages as decimals
 */
export interface Product {
  id: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  salePrice: number; // In rupees (e.g., 40.00)
  purchasePrice: number | null; // In rupees
  gstPercent: number; // As decimal (e.g., 18.00 for 18%)
  hsnCode: string | null; // HSN/SAC code for GST compliance
  stockQty: number;
  lowStockAlert: number | null;
  isActive: boolean;
  isGstInclusive: boolean;
  trackInventory: boolean;
  batchNumber: string | null;
  expiryDate: string | null;
  saltName: string | null;
  uom: string;
  isWeightBased: boolean;
  stripSize: number;
  drugCategory: string | null; // Schedule H, Narcotic, etc.
  lastSaleDate: string | null; // YYYY-MM-DD
  variantGroupId: string | null; // For garments
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create Product Input
 */
export interface CreateProductInput {
  name: string;
  sku?: string;
  barcode?: string;
  salePrice: number; // In rupees
  purchasePrice?: number; // In rupees
  gstPercent?: number; // As decimal (default 5%)
  hsnCode?: string; // HSN/SAC code
  stockQty?: number;
  lowStockAlert?: number;
  trackInventory?: boolean;
  isGstInclusive?: boolean;
  isActive?: boolean;
  batchNumber?: string;
  expiryDate?: string;
  saltName?: string;
  uom?: string;
  isWeightBased?: boolean;
  stripSize?: number;
  drugCategory?: string;
  lastSaleDate?: string;
  variantGroupId?: string;
}

/**
 * Update Product Input
 */
export interface UpdateProductInput {
  name?: string;
  sku?: string;
  barcode?: string;
  salePrice?: number; // In rupees
  purchasePrice?: number | null; // In rupees
  gstPercent?: number; // As decimal
  hsnCode?: string | null; // HSN/SAC code
  stockQty?: number;
  lowStockAlert?: number;
  isActive?: boolean;
  isGstInclusive?: boolean;
  trackInventory?: boolean;
  batchNumber?: string | null;
  expiryDate?: string | null;
  saltName?: string | null;
  uom?: string;
  isWeightBased?: boolean;
  stripSize?: number;
  drugCategory?: string | null;
  lastSaleDate?: string | null;
  variantGroupId?: string | null;
}

/**
 * Product Database Row
 */
interface ProductRow {
  id: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  sale_price: number;
  purchase_price: number | null;
  gst_percent: number;
  hsn_code: string | null;
  stock_qty: number;
  low_stock_alert: number | null;
  is_active: number;
  is_gst_inclusive: number;
  track_inventory: number;
  batch_number: string | null;
  expiry_date: string | null;
  salt_name: string | null;
  uom: string | null;
  is_weight_based: number;
  strip_size: number | null;
  drug_category: string | null;
  last_sale_date: string | null;
  variant_group_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Product Repository
 *
 * Handles all database operations for products.
 * Stores monetary values in Rupees and percentages as decimals.
 */
export class ProductRepository extends BaseRepository {
  /**
   * Create a new product
   */
  public create(data: CreateProductInput): Product {
    const now = new Date();
    const sql = `
      INSERT INTO products (
        name, sku, barcode, sale_price, purchase_price, gst_percent, hsn_code,
        stock_qty, low_stock_alert, track_inventory, is_gst_inclusive, is_active,
        batch_number, expiry_date, salt_name, uom, is_weight_based, strip_size,
        drug_category, last_sale_date, variant_group_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = this.execute(sql, [
      data.name,
      data.sku ?? null,
      data.barcode ?? null,
      data.salePrice, // Direct Rupees
      data.purchasePrice ?? null,
      data.gstPercent ?? 0, // Fallback to 0 if not provided by service
      data.hsnCode ?? null,
      data.stockQty ?? 0,
      data.lowStockAlert ?? null,
      data.trackInventory === false ? 0 : 1, // Explicitly handle false (Default true)
      data.isGstInclusive ? 1 : 0,
      data.isActive !== false ? 1 : 0, // Default active
      data.batchNumber ?? null,
      data.expiryDate ?? null,
      data.saltName ?? null,
      data.uom ?? 'Pcs',
      data.isWeightBased ? 1 : 0,
      data.stripSize ?? 1,
      data.drugCategory ?? null,
      data.lastSaleDate ?? null,
      data.variantGroupId ?? null,
      this.formatDateForSql(now),
      this.formatDateForSql(now),
    ]);

    logger.info('Product created', { id: result.lastInsertRowid, name: data.name });

    const product = this.findById(Number(result.lastInsertRowid));
    if (!product) {
      throw new Error('Failed to retrieve created product');
    }

    return product;
  }

  /**
   * Create multiple products in a transaction
   */
  public createBatch(inputs: CreateProductInput[]): Product[] {
    return this.transaction(() => {
      return inputs.map((input) => this.create(input));
    });
  }

  /**
   * Update a product
   */
  public update(id: number, data: UpdateProductInput): Product {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.sku !== undefined) {
      fields.push('sku = ?');
      values.push(data.sku || null);
    }
    if (data.barcode !== undefined) {
      fields.push('barcode = ?');
      values.push(data.barcode || null);
    }
    if (data.salePrice !== undefined) {
      fields.push('sale_price = ?');
      values.push(data.salePrice); // Direct Rupees
    }
    if (data.purchasePrice !== undefined) {
      fields.push('purchase_price = ?');
      values.push(data.purchasePrice ?? null);
    }
    if (data.gstPercent !== undefined) {
      fields.push('gst_percent = ?');
      values.push(data.gstPercent); // Direct Percent
    }
    if (data.stockQty !== undefined) {
      fields.push('stock_qty = ?');
      values.push(data.stockQty);
    }
    if (data.lowStockAlert !== undefined) {
      fields.push('low_stock_alert = ?');
      values.push(data.lowStockAlert);
    }
    if (data.isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(data.isActive ? 1 : 0);
    }
    if (data.trackInventory !== undefined) {
      fields.push('track_inventory = ?');
      values.push(data.trackInventory ? 1 : 0);
    }
    if (data.isGstInclusive !== undefined) {
      fields.push('is_gst_inclusive = ?');
      values.push(data.isGstInclusive ? 1 : 0);
    }
    if (data.hsnCode !== undefined) {
      fields.push('hsn_code = ?');
      values.push(data.hsnCode ?? null);
    }
    if (data.batchNumber !== undefined) {
      fields.push('batch_number = ?');
      values.push(data.batchNumber ?? null);
    }
    if (data.expiryDate !== undefined) {
      fields.push('expiry_date = ?');
      values.push(data.expiryDate ?? null);
    }
    if (data.saltName !== undefined) {
      fields.push('salt_name = ?');
      values.push(data.saltName ?? null);
    }
    if (data.uom !== undefined) {
      fields.push('uom = ?');
      values.push(data.uom);
    }
    if (data.isWeightBased !== undefined) {
      fields.push('is_weight_based = ?');
      values.push(data.isWeightBased ? 1 : 0);
    }
    if (data.stripSize !== undefined) {
      fields.push('strip_size = ?');
      values.push(data.stripSize);
    }
    if (data.drugCategory !== undefined) {
      fields.push('drug_category = ?');
      values.push(data.drugCategory || null);
    }
    if (data.lastSaleDate !== undefined) {
      fields.push('last_sale_date = ?');
      values.push(data.lastSaleDate || null);
    }
    if (data.variantGroupId !== undefined) {
      fields.push('variant_group_id = ?');
      values.push(data.variantGroupId || null);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    // Always update updated_at
    fields.push("updated_at = datetime('now', 'localtime')");

    const sql = `
      UPDATE products
      SET ${fields.join(', ')}
      WHERE id = ?
    `;
    values.push(id);

    const result = this.execute(sql, values);

    if (result.changes === 0) {
      throw new DatabaseError('Product not found', 'NOT_FOUND');
    }

    logger.info('Product updated', { id, changes: result.changes });

    const product = this.findById(id);
    if (!product) {
      throw new Error('Failed to retrieve updated product');
    }

    return product;
  }

  /**
   * Find product by ID
   */
  public findById(id: number): Product | null {
    const sql = `SELECT * FROM products WHERE id = ?`;
    const row = this.queryOne<ProductRow>(sql, [id]);
    return row ? this._mapToProduct(row) : null;
  }

  /**
   * Find multiple products by their IDs
   */
  public findByIds(ids: number[]): Product[] {
    if (!ids || ids.length === 0) {
      return [];
    }
    const placeholders = ids.map(() => '?').join(',');
    const sql = `SELECT * FROM products WHERE id IN (${placeholders})`;
    const rows = this.queryAll<ProductRow>(sql, ids);
    return rows.map((row) => this._mapToProduct(row));
  }

  /**
   * Find all active products with pagination
   */
  public findAll(includeInactive: boolean = false, limit?: number, offset?: number): Product[] {
    let sql = `
      SELECT * FROM products
      ${includeInactive ? '' : 'WHERE is_active = 1'}
      ORDER BY name ASC
    `;

    const params: unknown[] = [];
    if (limit !== undefined) {
      sql += ` LIMIT ?`;
      params.push(limit);
    }
    if (offset !== undefined) {
      sql += ` OFFSET ?`;
      params.push(offset);
    }

    const rows = this.queryAll<ProductRow>(sql, params);
    return rows.map((row) => this._mapToProduct(row));
  }

  /**
   * Get total count of products
   */
  public countAll(includeInactive: boolean = false): number {
    const sql = `
      SELECT COUNT(*) as count FROM products
      ${includeInactive ? '' : 'WHERE is_active = 1'}
    `;
    const row = this.queryOne<{ count: number }>(sql);
    return row ? row.count : 0;
  }

  /**
   * Search products by name, SKU, or barcode with pagination
   */
  public searchByName(
    query: string,
    includeInactive: boolean = false,
    limit?: number,
    offset?: number
  ): Product[] {
    let sql = `
      SELECT * FROM products
      WHERE (name LIKE ? OR sku LIKE ? OR barcode LIKE ? OR salt_name LIKE ?)
      ${includeInactive ? '' : 'AND is_active = 1'}
      ORDER BY name ASC
    `;

    const searchPattern = `%${query}%`;
    const params: unknown[] = [searchPattern, searchPattern, searchPattern, searchPattern];

    if (limit !== undefined) {
      sql += ` LIMIT ?`;
      params.push(limit);
    }
    if (offset !== undefined) {
      sql += ` OFFSET ?`;
      params.push(offset);
    }

    const rows = this.queryAll<ProductRow>(sql, params);
    return rows.map((row) => this._mapToProduct(row));
  }

  /**
   * Get total count of products matching search
   */
  public countSearch(query: string, includeInactive: boolean = false): number {
    const sql = `
      SELECT COUNT(*) as count FROM products
      WHERE (name LIKE ? OR sku LIKE ? OR barcode LIKE ? OR salt_name LIKE ?)
      ${includeInactive ? '' : 'AND is_active = 1'}
    `;
    const searchPattern = `%${query}%`;
    const row = this.queryOne<{ count: number }>(sql, [
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
    ]);
    return row ? row.count : 0;
  }

  /**
   * Update last sale date
   */
  public updateLastSaleDate(id: number, date: string): void {
    const sql = `UPDATE products SET last_sale_date = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`;
    this.execute(sql, [date, id]);
  }

  /**
   * Dedicated Generic/Salt search
   */
  public searchBySalt(query: string): Product[] {
    const sql = `SELECT * FROM products WHERE salt_name LIKE ? AND is_active = 1 ORDER BY name ASC`;
    const rows = this.queryAll<ProductRow>(sql, [`%${query}%`]);
    return rows.map((row) => this._mapToProduct(row));
  }

  /**
   * Fuzzy search by multiple salt components (AND condition)
   */
  public searchByFuzzySalts(salts: string[]): Product[] {
    if (!salts || salts.length === 0) {
      return [];
    }

    // Build dynamic AND conditions: (salt_name LIKE '%' || ? || '%' AND ...)
    // SQLite's LIKE is case-insensitive by default for ASCII.
    const conditions = salts.map(() => 'salt_name LIKE ?').join(' AND ');
    const params = salts.map((salt) => `%${salt}%`);

    const sql = `SELECT * FROM products WHERE is_active = 1 AND (${conditions}) ORDER BY name ASC`;
    const rows = this.queryAll<ProductRow>(sql, params);
    return rows.map((row) => this._mapToProduct(row));
  }

  /**
   * Get unique salt names matching the query from existing products
   */
  public getUniqueSaltNames(query: string): string[] {
    const sql = `
      SELECT DISTINCT salt_name
      FROM products
      WHERE salt_name LIKE ? 
      AND salt_name IS NOT NULL 
      AND is_active = 1
      ORDER BY salt_name ASC
    `;
    const rows = this.queryAll<{ salt_name: string }>(sql, [`%${query}%`]);
    return rows.map((row) => row.salt_name);
  }

  /**
   * Find product by barcode
   */
  public findByBarcode(barcode: string, includeInactive: boolean = false): Product | null {
    const sql = `
      SELECT * FROM products
      WHERE barcode = ? ${includeInactive ? '' : 'AND is_active = 1'}
    `;
    const row = this.queryOne<ProductRow>(sql, [barcode]);
    return row ? this._mapToProduct(row) : null;
  }

  /**
   * Find product by SKU
   */
  public findBySku(sku: string, includeInactive: boolean = false): Product | null {
    const sql = `
      SELECT * FROM products
      WHERE sku = ? ${includeInactive ? '' : 'AND is_active = 1'}
    `;
    const row = this.queryOne<ProductRow>(sql, [sku]);
    return row ? this._mapToProduct(row) : null;
  }

  /**
   * Update product stock (with negative stock prevention)
   *
   * IMPORTANT: This method checks stock BEFORE updating to prevent negative stock.
   * Use within a transaction for atomic operations.
   *
   * @param productId - Product ID
   * @param deltaQty - Change in quantity (positive = add, negative = deduct)
   * @throws Error if stock would become negative
   */
  public updateStock(productId: number, deltaQty: number): void {
    // 1. Lock row and check current stock
    const sql = `
      SELECT stock_qty FROM products
      WHERE id = ?
      
    `;
    const product = this.queryOne<{ stock_qty: number }>(sql, [productId]);

    if (!product) {
      throw new DatabaseError('Product not found', 'NOT_FOUND');
    }

    // 2. Prevent negative stock
    const newStock = product.stock_qty + deltaQty;
    if (newStock < 0) {
      throw new Error(
        `Insufficient stock. Available: ${product.stock_qty}, Required: ${Math.abs(deltaQty)}`
      );
    }

    // 3. Update stock
    const updateSql = `
      UPDATE products
      SET stock_qty = stock_qty + ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `;
    this.execute(updateSql, [deltaQty, productId]);

    logger.info('Product stock updated', { productId, deltaQty, newStock });
  }

  /**
   * Get low stock products
   */
  public getLowStock(): Product[] {
    const sql = `
      SELECT * FROM products
      WHERE is_active = 1 
        AND low_stock_alert IS NOT NULL 
        AND stock_qty <= low_stock_alert
      ORDER BY stock_qty ASC
    `;
    const rows = this.queryAll<ProductRow>(sql);
    return rows.map((row) => this._mapToProduct(row));
  }

  /**
   * Soft delete a product (set is_active = 0)
   */
  public delete(id: number): void {
    const sql = `
      UPDATE products
      SET is_active = 0, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `;

    const result = this.execute(sql, [id]);

    if (result.changes === 0) {
      throw new DatabaseError('Product not found', 'NOT_FOUND');
    }

    logger.info('Product soft deleted (deactivated)', { id });
  }

  /**
   * Map database row to Product domain object
   *
   * Converts:
   * - INTEGER paise → number rupees
   * - INTEGER basis points → number percent
   * - INTEGER 0/1 → boolean
   * - TEXT ISO 8601 → Date
   */
  private _mapToProduct(row: ProductRow): Product {
    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      barcode: row.barcode,
      salePrice: row.sale_price, // Direct Rupees
      purchasePrice: row.purchase_price,
      gstPercent: row.gst_percent, // Direct Percent
      hsnCode: row.hsn_code ?? null,
      stockQty: row.stock_qty,
      lowStockAlert: row.low_stock_alert,
      isActive: row.is_active === 1, // INTEGER → boolean
      isGstInclusive: row.is_gst_inclusive === 1,
      trackInventory: row.track_inventory === 1,
      batchNumber: row.batch_number,
      expiryDate: row.expiry_date,
      saltName: row.salt_name,
      uom: row.uom || 'Pcs',
      isWeightBased: row.is_weight_based === 1,
      stripSize: row.strip_size ?? 1,
      drugCategory: row.drug_category,
      lastSaleDate: row.last_sale_date,
      variantGroupId: row.variant_group_id,
      createdAt: this.parseDate(row.created_at), // TEXT → Date
      updatedAt: this.parseDate(row.updated_at),
    };
  }
}
