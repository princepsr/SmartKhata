import { BaseRepository, DatabaseError } from './base-repository';
import { logger } from '../utils/logger';

/**
 * Inventory Log Domain Object (application layer)
 */
export interface InventoryLog {
  id: number;
  productId: number;
  changeQty: number; // Positive = add, negative = deduct
  reason: 'SALE' | 'MANUAL' | 'ADJUSTMENT';
  referenceId: number | null; // Bill ID for sales, null for manual/adjustments
  billNumber: string | null; // Joined from bills table
  notes: string | null;
  createdAt: Date;
}

/**
 * Create Inventory Log Input
 */
export interface CreateInventoryLogInput {
  productId: number;
  changeQty: number; // Positive = add, negative = deduct
  reason: 'SALE' | 'MANUAL' | 'ADJUSTMENT';
  referenceId?: number; // Bill ID for sales
  notes?: string;
}

/**
 * Inventory Repository
 *
 * Handles all database operations for inventory logs.
 * Logs are IMMUTABLE - once created, they cannot be modified or deleted.
 * This ensures a complete audit trail of all stock movements.
 */
export class InventoryRepository extends BaseRepository {
  /**
   * Log an inventory change (IMMUTABLE)
   *
   * This method creates an immutable log entry for any stock change.
   * Logs are never updated or deleted - they form a permanent audit trail.
   *
   * @param data - Inventory log data
   * @returns Created inventory log
   */
  public logChange(data: CreateInventoryLogInput): InventoryLog {
    const sql = `
      INSERT INTO inventory_logs (
        product_id, change_qty, reason, reference_id, notes
      ) VALUES (?, ?, ?, ?, ?)
    `;

    const result = this.execute(sql, [
      data.productId,
      data.changeQty,
      data.reason,
      data.referenceId || null,
      data.notes || null,
    ]);

    logger.info('Inventory change logged', {
      id: result.lastInsertRowid,
      productId: data.productId,
      changeQty: data.changeQty,
      reason: data.reason,
    });

    const log = this.findById(Number(result.lastInsertRowid));
    if (!log) {
      throw new Error('Failed to retrieve created inventory log');
    }

    return log;
  }

  /**
   * Find inventory log by ID
   */
  public findById(id: number): InventoryLog | null {
    const sql = `SELECT * FROM inventory_logs WHERE id = ?`;
    const row = this.queryOne<any>(sql, [id]);
    return row ? this._mapToInventoryLog(row) : null;
  }

  /**
   * Get stock history for a product
   *
   * Returns all inventory changes for a product, ordered by date (newest first).
   * Useful for auditing and tracking stock movements.
   */
  public getStockHistory(productId: number): InventoryLog[] {
    const sql = `
      SELECT il.*, b.bill_number
      FROM inventory_logs il
      LEFT JOIN bills b ON il.reference_id = b.id AND il.reason = 'SALE'
      WHERE il.product_id = ?
      ORDER BY il.created_at DESC
    `;

    const rows = this.queryAll<any>(sql, [productId]);
    return rows.map((row) => this._mapToInventoryLog(row));
  }

  /**
   * Get inventory logs by reason
   */
  public findByReason(reason: 'SALE' | 'MANUAL' | 'ADJUSTMENT'): InventoryLog[] {
    const sql = `
      SELECT * FROM inventory_logs
      WHERE reason = ?
      ORDER BY created_at DESC
    `;

    const rows = this.queryAll<any>(sql, [reason]);
    return rows.map((row) => this._mapToInventoryLog(row));
  }

  /**
   * Get inventory logs for a bill (sales)
   */
  public findByBillId(billId: number): InventoryLog[] {
    const sql = `
      SELECT * FROM inventory_logs
      WHERE reference_id = ? AND reason = 'SALE'
      ORDER BY created_at ASC
    `;

    const rows = this.queryAll<any>(sql, [billId]);
    return rows.map((row) => this._mapToInventoryLog(row));
  }

  /**
   * Get inventory logs by date range
   */
  public findByDateRange(fromDate: Date, toDate: Date): InventoryLog[] {
    const sql = `
      SELECT * FROM inventory_logs
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `;

    const rows = this.queryAll<any>(sql, [fromDate.toISOString(), toDate.toISOString()]);

    return rows.map((row) => this._mapToInventoryLog(row));
  }

  /**
   * Get recent inventory logs (last N entries)
   */
  public findRecent(limit: number = 100): InventoryLog[] {
    const sql = `
      SELECT * FROM inventory_logs
      ORDER BY created_at DESC
      LIMIT ?
    `;

    const rows = this.queryAll<any>(sql, [limit]);
    return rows.map((row) => this._mapToInventoryLog(row));
  }

  /**
   * Calculate total stock change for a product
   *
   * Sums all inventory changes to get the current stock level.
   * This should match the stock_qty in the products table.
   */
  public calculateTotalStock(productId: number): number {
    const sql = `
      SELECT COALESCE(SUM(change_qty), 0) as total_change
      FROM inventory_logs
      WHERE product_id = ?
    `;

    const result = this.queryOne<{ total_change: number }>(sql, [productId]);
    return result?.total_change || 0;
  }

  /**
   * Get inventory summary by reason for date range
   */
  public getSummaryByReason(
    fromDate: Date,
    toDate: Date
  ): {
    reason: string;
    totalChanges: number;
    netQuantity: number;
  }[] {
    const sql = `
      SELECT 
        reason,
        COUNT(*) as total_changes,
        SUM(change_qty) as net_quantity
      FROM inventory_logs
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY reason
      ORDER BY reason
    `;

    const rows = this.queryAll<any>(sql, [fromDate.toISOString(), toDate.toISOString()]);

    return rows.map((row) => ({
      reason: row.reason,
      totalChanges: row.total_changes,
      netQuantity: row.net_quantity,
    }));
  }

  /**
   * Map database row to InventoryLog domain object
   */
  private _mapToInventoryLog(row: any): InventoryLog {
    return {
      id: row.id,
      productId: row.product_id,
      changeQty: row.change_qty,
      reason: row.reason,
      referenceId: row.reference_id,
      billNumber: row.bill_number || null,
      notes: row.notes,
      createdAt: this.parseDate(row.created_at),
    };
  }
}
