import { BaseRepository, DatabaseError } from './base-repository';
import { logger } from '../utils/logger';

/**
 * Product Entity (matches database schema)
 */
export interface Product {
  id: number;
  name: string;
  barcode: string | null;
  price: number;
  cost: number | null;
  stock: number;
  unit: string;
  category: string | null;
  description: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/**
 * Create Product Request (for INSERT)
 */
export interface CreateProductRequest {
  name: string;
  barcode?: string;
  price: number;
  cost?: number;
  stock?: number;
  unit?: string;
  category?: string;
  description?: string;
}

/**
 * Update Product Request (for UPDATE)
 */
export interface UpdateProductRequest {
  name?: string;
  barcode?: string;
  price?: number;
  cost?: number;
  stock?: number;
  unit?: string;
  category?: string;
  description?: string;
  is_active?: number;
}

/**
 * Product Repository
 * 
 * Handles all database operations for products
 */
export class ProductRepository extends BaseRepository {
  /**
   * Find all active products
   */
  public findAll(): Product[] {
    const sql = `
      SELECT * FROM products
      WHERE is_active = 1
      ORDER BY name ASC
    `;
    return this.queryAll<Product>(sql);
  }

  /**
   * Find product by ID
   */
  public findById(id: number): Product | undefined {
    const sql = `
      SELECT * FROM products
      WHERE id = ?
    `;
    return this.queryOne<Product>(sql, [id]);
  }

  /**
   * Find product by barcode
   */
  public findByBarcode(barcode: string): Product | undefined {
    const sql = `
      SELECT * FROM products
      WHERE barcode = ? AND is_active = 1
    `;
    return this.queryOne<Product>(sql, [barcode]);
  }

  /**
   * Search products by name
   */
  public searchByName(query: string): Product[] {
    const sql = `
      SELECT * FROM products
      WHERE name LIKE ? AND is_active = 1
      ORDER BY name ASC
      LIMIT 50
    `;
    return this.queryAll<Product>(sql, [`%${query}%`]);
  }

  /**
   * Find products by category
   */
  public findByCategory(category: string): Product[] {
    const sql = `
      SELECT * FROM products
      WHERE category = ? AND is_active = 1
      ORDER BY name ASC
    `;
    return this.queryAll<Product>(sql, [category]);
  }

  /**
   * Create a new product
   */
  public create(data: CreateProductRequest): Product {
    const sql = `
      INSERT INTO products (
        name, barcode, price, cost, stock, unit, category, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = this.execute(sql, [
      data.name,
      data.barcode || null,
      data.price,
      data.cost || null,
      data.stock || 0,
      data.unit || 'piece',
      data.category || null,
      data.description || null,
    ]);

    logger.info('Product created', { id: result.lastInsertRowid, name: data.name });

    // Fetch and return the created product
    const product = this.findById(Number(result.lastInsertRowid));
    if (!product) {
      throw new Error('Failed to retrieve created product');
    }

    return product;
  }

  /**
   * Update a product
   */
  public update(id: number, data: UpdateProductRequest): Product {
    // Build dynamic UPDATE query
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.barcode !== undefined) {
      fields.push('barcode = ?');
      values.push(data.barcode || null);
    }
    if (data.price !== undefined) {
      fields.push('price = ?');
      values.push(data.price);
    }
    if (data.cost !== undefined) {
      fields.push('cost = ?');
      values.push(data.cost);
    }
    if (data.stock !== undefined) {
      fields.push('stock = ?');
      values.push(data.stock);
    }
    if (data.unit !== undefined) {
      fields.push('unit = ?');
      values.push(data.unit);
    }
    if (data.category !== undefined) {
      fields.push('category = ?');
      values.push(data.category || null);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description || null);
    }
    if (data.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(data.is_active);
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

    // Fetch and return the updated product
    const product = this.findById(id);
    if (!product) {
      throw new Error('Failed to retrieve updated product');
    }

    return product;
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

    logger.info('Product deleted (soft)', { id });
  }

  /**
   * Update product stock
   */
  public updateStock(id: number, quantity: number): void {
    const sql = `
      UPDATE products
      SET stock = stock + ?, updated_at = datetime('now')
      WHERE id = ?
    `;

    const result = this.execute(sql, [quantity, id]);

    if (result.changes === 0) {
      throw new DatabaseError('Product not found', 'NOT_FOUND');
    }

    logger.info('Product stock updated', { id, quantity });
  }

  /**
   * Check if product has sufficient stock
   */
  public hasStock(id: number, requiredQuantity: number): boolean {
    const sql = `
      SELECT stock FROM products
      WHERE id = ? AND is_active = 1
    `;

    const result = this.queryOne<{ stock: number }>(sql, [id]);
    return result ? result.stock >= requiredQuantity : false;
  }

  /**
   * Get low stock products (stock <= threshold)
   */
  public getLowStock(threshold: number = 10): Product[] {
    const sql = `
      SELECT * FROM products
      WHERE stock <= ? AND is_active = 1
      ORDER BY stock ASC
    `;
    return this.queryAll<Product>(sql, [threshold]);
  }

  /**
   * Get all categories
   */
  public getCategories(): string[] {
    const sql = `
      SELECT DISTINCT category FROM products
      WHERE category IS NOT NULL AND is_active = 1
      ORDER BY category ASC
    `;
    const results = this.queryAll<{ category: string }>(sql);
    return results.map(r => r.category);
  }
}

// Singleton instance
export const productRepository = new ProductRepository();
