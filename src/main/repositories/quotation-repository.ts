import { BaseRepository } from './base-repository';
import { logger } from '../utils/logger';

/**
 * Quotation Entity
 */
export interface Quotation {
  id: number;
  quotationNumber: string;
  customerId: number | null;
  customerNameSnapshot: string;
  totalTaxable: number;
  gstTotal: number;
  grandTotal: number;
  status: 'PENDING' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface QuotationItem {
  id: number;
  quotationId: number;
  productId: number | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  lineTotal: number;
}

/**
 * Quotation Repository
 */
export class QuotationRepository extends BaseRepository {
  /**
   * Create a new quotation with items (ATOMIC)
   */
  public create(
    data: Omit<Quotation, 'id' | 'createdAt'>,
    items: Omit<QuotationItem, 'id' | 'quotationId'>[]
  ): Quotation {
    return this.transaction(() => {
      const sql = `
        INSERT INTO quotations (quotation_number, customer_id, customer_name_snapshot, total_taxable, gst_total, grand_total, status, expires_at, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const result = this.execute(sql, [
        data.quotationNumber,
        data.customerId,
        data.customerNameSnapshot,
        data.totalTaxable,
        data.gstTotal,
        data.grandTotal,
        data.status,
        data.expiresAt,
        data.notes,
      ]);

      const quotationId = Number(result.lastInsertRowid);

      const itemSql = `
        INSERT INTO quotation_items (quotation_id, product_id, product_name, quantity, unit_price, gst_percent, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      items.forEach((item) => {
        this.execute(itemSql, [
          quotationId,
          item.productId,
          item.productName,
          item.quantity,
          item.unitPrice,
          item.gstPercent,
          item.lineTotal,
        ]);
      });

      logger.info('Quotation created', { id: quotationId, number: data.quotationNumber });
      return this.findById(quotationId)!;
    });
  }

  public findById(id: number): Quotation | null {
    const row = this.queryOne<any>('SELECT * FROM quotations WHERE id = ?', [id]);
    return row ? this._mapToQuotation(row) : null;
  }

  public findByNumber(quotationNumber: string): Quotation | null {
    const row = this.queryOne<any>('SELECT * FROM quotations WHERE quotation_number = ?', [
      quotationNumber,
    ]);
    return row ? this._mapToQuotation(row) : null;
  }

  public list(page: number = 1): Quotation[] {
    const limit = 20;
    const offset = (page - 1) * limit;
    const sql = `SELECT * FROM quotations ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    return this.queryAll<any>(sql, [limit, offset]).map((row) => this._mapToQuotation(row));
  }

  public updateStatus(id: number, status: Quotation['status']): void {
    const sql = `UPDATE quotations SET status = ?, updated_at = datetime('now') WHERE id = ?`;
    this.execute(sql, [status, id]);
  }

  private _mapToQuotation(row: any): Quotation {
    return {
      id: row.id,
      quotationNumber: row.quotation_number,
      customerId: row.customer_id,
      customerNameSnapshot: row.customer_name_snapshot,
      totalTaxable: row.total_taxable,
      gstTotal: row.gst_total,
      grandTotal: row.grand_total,
      status: row.status,
      expiresAt: row.expires_at,
      notes: row.notes,
      createdAt: this.parseDate(row.created_at),
    };
  }
}
