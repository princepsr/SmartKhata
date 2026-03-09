import { BaseRepository } from './base-repository';
import { logger } from '../utils/logger';

export interface CreditNote {
  id: number;
  creditNoteNumber: string;
  originalBillId: number | null;
  originalBillNumber: string | null;
  customerId: number | null;
  reason: string;
  refundAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstTotal: number;
  notes: string | null;
  createdAt: Date;
}

export interface CreditNoteItem {
  id: number;
  creditNoteId: number;
  productId: number;
  productNameSnapshot: string;
  hsnCode: string | null;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  lineTaxable: number;
  lineCgst: number;
  lineSgst: number;
  lineIgst: number;
  lineTotal: number;
}

export interface CreditNoteWithItems {
  creditNote: CreditNote;
  items: CreditNoteItem[];
}

export interface CreateCreditNoteInput {
  creditNoteNumber: string;
  originalBillId?: number;
  originalBillNumber?: string;
  customerId?: number;
  reason: string;
  refundAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstTotal: number;
  notes?: string;
}

export interface CreateCreditNoteItemInput {
  productId: number;
  productNameSnapshot: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  lineTaxable: number;
  lineCgst: number;
  lineSgst: number;
  lineIgst: number;
  lineTotal: number;
}

export class CreditNoteRepository extends BaseRepository {
  /**
   * Create a credit note with items (ATOMIC)
   */
  public createCreditNoteWithItems(
    data: CreateCreditNoteInput,
    items: CreateCreditNoteItemInput[]
  ): CreditNoteWithItems {
    return this.transaction(() => {
      const sql = `
        INSERT INTO credit_notes (
          credit_note_number, original_bill_id, original_bill_number, customer_id,
          reason, refund_amount, taxable_amount,
          cgst_amount, sgst_amount, igst_amount, gst_total, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const result = this.execute(sql, [
        data.creditNoteNumber,
        data.originalBillId ?? null,
        data.originalBillNumber ?? null,
        data.customerId ?? null,
        data.reason,
        data.refundAmount,
        data.taxableAmount,
        data.cgstAmount,
        data.sgstAmount,
        data.igstAmount,
        data.gstTotal,
        data.notes ?? null,
      ]);

      const cnId = Number(result.lastInsertRowid);

      const insertItem = this.db.prepare(`
        INSERT INTO credit_note_items (
          credit_note_id, product_id, product_name_snapshot, hsn_code,
          quantity, unit_price, gst_percent,
          line_taxable, line_cgst, line_sgst, line_igst, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const createdItems: CreditNoteItem[] = [];
      for (const item of items) {
        const ir = insertItem.run(
          cnId,
          item.productId,
          item.productNameSnapshot,
          item.hsnCode ?? null,
          item.quantity,
          item.unitPrice,
          item.gstPercent,
          item.lineTaxable,
          item.lineCgst,
          item.lineSgst,
          item.lineIgst,
          item.lineTotal
        );
        createdItems.push({
          id: Number(ir.lastInsertRowid),
          creditNoteId: cnId,
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          hsnCode: item.hsnCode ?? null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          gstPercent: item.gstPercent,
          lineTaxable: item.lineTaxable,
          lineCgst: item.lineCgst,
          lineSgst: item.lineSgst,
          lineIgst: item.lineIgst,
          lineTotal: item.lineTotal,
        });
      }

      logger.info('Credit note created', {
        creditNoteId: cnId,
        creditNoteNumber: data.creditNoteNumber,
        itemCount: items.length,
      });

      return {
        creditNote: {
          id: cnId,
          creditNoteNumber: data.creditNoteNumber,
          originalBillId: data.originalBillId ?? null,
          originalBillNumber: data.originalBillNumber ?? null,
          customerId: data.customerId ?? null,
          reason: data.reason,
          refundAmount: data.refundAmount,
          taxableAmount: data.taxableAmount,
          cgstAmount: data.cgstAmount,
          sgstAmount: data.sgstAmount,
          igstAmount: data.igstAmount,
          gstTotal: data.gstTotal,
          notes: data.notes ?? null,
          createdAt: new Date(),
        },
        items: createdItems,
      };
    });
  }

  /**
   * Find credit note by ID with items
   */
  public findByIdWithItems(id: number): CreditNoteWithItems | null {
    const cnRow = this.queryOne<any>(
      `SELECT cn.*, b.bill_number as original_bill_number
       FROM credit_notes cn
       LEFT JOIN bills b ON cn.original_bill_id = b.id
       WHERE cn.id = ?`,
      [id]
    );
    if (!cnRow) {return null;}

    const items = this.queryAll<any>(`SELECT * FROM credit_note_items WHERE credit_note_id = ?`, [
      id,
    ]);

    return {
      creditNote: this._mapToCreditNote(cnRow),
      items: items.map((r) => this._mapToItem(r)),
    };
  }

  /**
   * List credit notes with pagination
   */
  public list(
    startDate: string,
    endDate: string,
    page: number = 1,
    limit: number = 50
  ): { data: CreditNote[]; total: number } {
    const total = (
      this.queryOne<{ c: number }>(
        `SELECT COUNT(*) as c FROM credit_notes WHERE date(created_at,'localtime') BETWEEN date(?) AND date(?)`,
        [startDate, endDate]
      ) ?? { c: 0 }
    ).c;

    const rows = this.queryAll<any>(
      `SELECT cn.*, b.bill_number as original_bill_number
       FROM credit_notes cn
       LEFT JOIN bills b ON cn.original_bill_id = b.id
       WHERE date(cn.created_at,'localtime') BETWEEN date(?) AND date(?)
       ORDER BY cn.created_at DESC
       LIMIT ? OFFSET ?`,
      [startDate, endDate, limit, (page - 1) * limit]
    );

    return { data: rows.map((r) => this._mapToCreditNote(r)), total };
  }

  /**
   * Find the last credit note number for a given date prefix
   */
  public findLastCreditNoteNumberByPrefix(prefix: string): string | null {
    const row = this.queryOne<{ credit_note_number: string }>(
      `SELECT credit_note_number FROM credit_notes WHERE credit_note_number LIKE ?
       ORDER BY length(credit_note_number) DESC, credit_note_number DESC LIMIT 1`,
      [`${prefix}%`]
    );
    return row ? row.credit_note_number : null;
  }

  private _mapToCreditNote(row: any): CreditNote {
    return {
      id: row.id,
      creditNoteNumber: row.credit_note_number,
      originalBillId: row.original_bill_id,
      originalBillNumber: row.original_bill_number ?? null,
      customerId: row.customer_id,
      reason: row.reason,
      refundAmount: row.refund_amount,
      taxableAmount: row.taxable_amount,
      cgstAmount: row.cgst_amount,
      sgstAmount: row.sgst_amount,
      igstAmount: row.igst_amount,
      gstTotal: row.gst_total,
      notes: row.notes,
      createdAt: this.parseDate(row.created_at),
    };
  }

  private _mapToItem(row: any): CreditNoteItem {
    return {
      id: row.id,
      creditNoteId: row.credit_note_id,
      productId: row.product_id,
      productNameSnapshot: row.product_name_snapshot,
      hsnCode: row.hsn_code ?? null,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      gstPercent: row.gst_percent,
      lineTaxable: row.line_taxable,
      lineCgst: row.line_cgst,
      lineSgst: row.line_sgst,
      lineIgst: row.line_igst,
      lineTotal: row.line_total,
    };
  }
}
