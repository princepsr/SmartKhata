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
  billDiscountValue: number;
  billDiscountType: 'amount' | 'percent';
  createdAt: Date;
}

export interface QuotationItem {
  id: number;
  quotationId: number;
  productId: number | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountValue: number;
  discountType: 'amount' | 'percent';
  gstPercent: number;
  uom: string | null;
  lineTotal: number;
}

/**
 * Quotation Database Row
 */
interface QuotationRow {
  id: number;
  quotation_number: string;
  customer_id: number | null;
  customer_name_snapshot: string;
  total_taxable: number;
  gst_total: number;
  grand_total: number;
  status: 'PENDING' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED';
  expires_at: string | null;
  notes: string | null;
  bill_discount_value: number;
  bill_discount_type: 'amount' | 'percent';
  created_at: string;
}

/**
 * Quotation Item Database Row
 */
interface QuotationItemRow {
  id: number;
  quotation_id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_value: number;
  discount_type: 'amount' | 'percent';
  gst_percent: number;
  uom: string | null;
  line_total: number;
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
        INSERT INTO quotations (quotation_number, customer_id, customer_name_snapshot, total_taxable, gst_total, grand_total, status, expires_at, notes, bill_discount_value, bill_discount_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        data.billDiscountValue || 0,
        data.billDiscountType || 'percent',
      ]);

      const quotationId = Number(result.lastInsertRowid);

      const itemSql = `
        INSERT INTO quotation_items (quotation_id, product_id, product_name, quantity, unit_price, discount_value, discount_type, gst_percent, uom, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      items.forEach((item) => {
        this.execute(itemSql, [
          quotationId,
          item.productId,
          item.productName,
          item.quantity,
          item.unitPrice,
          item.discountValue || 0,
          item.discountType || 'percent',
          item.gstPercent,
          item.uom || 'Pcs',
          item.lineTotal,
        ]);
      });

      logger.info('Quotation created', { id: quotationId, number: data.quotationNumber });
      const quotation = this.findById(quotationId);
      if (!quotation) {
        throw new Error('Failed to retrieve created quotation');
      }
      return quotation;
    });
  }

  public findById(id: number): Quotation | null {
    const row = this.queryOne<QuotationRow>('SELECT * FROM quotations WHERE id = ?', [id]);
    return row ? this._mapToQuotation(row) : null;
  }

  public findByNumber(quotationNumber: string): Quotation | null {
    const row = this.queryOne<QuotationRow>('SELECT * FROM quotations WHERE quotation_number = ?', [
      quotationNumber,
    ]);
    return row ? this._mapToQuotation(row) : null;
  }

  public findByIdWithItems(id: number): { quotation: Quotation; items: QuotationItem[] } | null {
    const quotation = this.findById(id);
    if (!quotation) {
      return null;
    }

    const items = this.queryAll<QuotationItemRow>('SELECT * FROM quotation_items WHERE quotation_id = ?', [id]);
    return {
      quotation,
      items: items.map((row) => ({
        id: row.id,
        quotationId: row.quotation_id,
        productId: row.product_id,
        productName: row.product_name,
        quantity: row.quantity,
        unitPrice: row.unit_price,
        discountValue: row.discount_value,
        discountType: row.discount_type,
        gstPercent: row.gst_percent,
        uom: row.uom,
        lineTotal: row.line_total,
      })),
    };
  }

  public list(page: number = 1): Quotation[] {
    const limit = 20;
    const offset = (page - 1) * limit;
    const sql = `SELECT * FROM quotations ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    return this.queryAll<QuotationRow>(sql, [limit, offset]).map((row) => this._mapToQuotation(row));
  }

  public updateStatus(id: number, status: Quotation['status']): void {
    const sql = `UPDATE quotations SET status = ?, updated_at = datetime('now') WHERE id = ?`;
    this.execute(sql, [status, id]);
  }

  public countToday(prefix: string): number {
    const sql = `SELECT COUNT(*) as count FROM quotations WHERE quotation_number LIKE ?`;
    const row = this.queryOne<{ count: number }>(sql, [`${prefix}%`]);
    return row ? row.count : 0;
  }

  private _mapToQuotation(row: QuotationRow): Quotation {
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
      billDiscountValue: row.bill_discount_value,
      billDiscountType: row.bill_discount_type,
      createdAt: this.parseDate(row.created_at),
    };
  }
}
