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
  stockQty: number;
  lowStockAlert: number | null;
  isActive: boolean;
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
  gstPercent?: number; // As decimal (default 18%)
  stockQty?: number;
  lowStockAlert?: number;
}

/**
 * Update Product Input
 */
export interface UpdateProductInput {
  name?: string;
  sku?: string;
  barcode?: string;
  salePrice?: number; // In rupees
  purchasePrice?: number; // In rupees
  gstPercent?: number; // As decimal
  stockQty?: number;
  lowStockAlert?: number;
  isActive?: boolean;
}

/**
 * Product Repository
 *
 * Handles all database operations for products.
 * Converts between database types (INTEGER paise) and domain types (number rupees).
 */
export class ProductRepository extends BaseRepository {
  /**
   * Create a new product
   */
  public create(data: CreateProductInput): Product {
    const sql = `
      INSERT INTO products (
        name, sku, barcode, sale_price, purchase_price, gst_percent, 
        stock_qty, low_stock_alert
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = this.execute(sql, [
      data.name,
      data.sku || null,
      data.barcode || null,
      Math.round(data.salePrice * 100), // Rupees → Paise
      data.purchasePrice ? Math.round(data.purchasePrice * 100) : null,
      Math.round((data.gstPercent || 18) * 100), // Percent → Basis points
      data.stockQty || 0,
      data.lowStockAlert || null,
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
      values.push(Math.round(data.salePrice * 100)); // Rupees → Paise
    }
    if (data.purchasePrice !== undefined) {
      fields.push('purchase_price = ?');
      values.push(data.purchasePrice ? Math.round(data.purchasePrice * 100) : null);
    }
    if (data.gstPercent !== undefined) {
      fields.push('gst_percent = ?');
      values.push(Math.round(data.gstPercent * 100)); // Percent → Basis points
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

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    // Always update updated_at
    fields.push("updated_at = datetime('now')");

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
    const row = this.queryOne<any>(sql, [id]);
    return row ? this._mapToProduct(row) : null;
  }

  /**
   * Find all active products
   */
  public findAll(includeInactive: boolean = false): Product[] {
    const sql = `
      SELECT * FROM products
      ${includeInactive ? '' : 'WHERE is_active = 1'}
      ORDER BY name ASC
    `;
    const rows = this.queryAll<any>(sql);
    return rows.map((row) => this._mapToProduct(row));
  }

  /**
   * Search products by name
   */
  public searchByName(query: string, includeInactive: boolean = false): Product[] {
    const sql = `
      SELECT * FROM products
      WHERE name LIKE ? ${includeInactive ? '' : 'AND is_active = 1'}
      ORDER BY name ASC
      LIMIT 50
    `;
    const rows = this.queryAll<any>(sql, [`%${query}%`]);
    return rows.map((row) => this._mapToProduct(row));
  }

  /**
   * Find product by barcode
   */
  public findByBarcode(barcode: string, includeInactive: boolean = false): Product | null {
    const sql = `
      SELECT * FROM products
      WHERE barcode = ? ${includeInactive ? '' : 'AND is_active = 1'}
    `;
    const row = this.queryOne<any>(sql, [barcode]);
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
    const row = this.queryOne<any>(sql, [sku]);
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
      SET stock_qty = stock_qty + ?, updated_at = datetime('now')
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
    const rows = this.queryAll<any>(sql);
    return rows.map((row) => this._mapToProduct(row));
  }

  /**
   * Soft delete a product (set is_active = 0)
   */
  public delete(id: number): void {
    const sql = `
      UPDATE products
      SET is_active = 0, updated_at = datetime('now')
      WHERE id = ?
    `;

    const result = this.execute(sql, [id]);

    if (result.changes === 0) {
      throw new DatabaseError('Product not found', 'NOT_FOUND');
    }

    logger.info('Product soft deleted', { id });
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
  private _mapToProduct(row: any): Product {
    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      barcode: row.barcode,
      salePrice: row.sale_price / 100, // Paise → Rupees
      purchasePrice: row.purchase_price ? row.purchase_price / 100 : null,
      gstPercent: row.gst_percent / 100, // Basis points → Percent (This stays 100 as per schema usually)
      stockQty: row.stock_qty,
      lowStockAlert: row.low_stock_alert,
      isActive: row.is_active === 1, // INTEGER → boolean
      createdAt: this.parseDate(row.created_at), // TEXT → Date
      updatedAt: this.parseDate(row.updated_at),
    };
  }
}
