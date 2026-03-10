import { BaseRepository } from './base-repository';
import { logger } from '../utils/logger';

export interface DebitNote {
  id: number;
  debitNoteNumber: string;
  purchaseId: number | null;
  supplierId: number;
  totalTaxable: number;
  gstTotal: number;
  grandTotal: number;
  reason: string | null;
  createdAt: Date;
}

export interface DebitNoteItem {
  id: number;
  debitNoteId: number;
  productId: number | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  lineTotal: number;
}

/**
 * Debit Note Database Row
 */
interface DebitNoteRow {
  id: number;
  debit_note_number: string;
  purchase_id: number | null;
  supplier_id: number;
  total_taxable: number;
  gst_total: number;
  grand_total: number;
  reason: string | null;
  created_at: string;
}

export class DebitNoteRepository extends BaseRepository {
  public createWithItems(
    data: Omit<DebitNote, 'id' | 'createdAt'>,
    items: Omit<DebitNoteItem, 'id' | 'debitNoteId'>[]
  ): number {
    return this.transaction(() => {
      const sql = `
        INSERT INTO debit_notes (debit_note_number, purchase_id, supplier_id, total_taxable, gst_total, grand_total, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const result = this.execute(sql, [
        data.debitNoteNumber,
        data.purchaseId,
        data.supplierId,
        data.totalTaxable,
        data.gstTotal,
        data.grandTotal,
        data.reason,
      ]);

      const debitNoteId = Number(result.lastInsertRowid);

      const itemSql = `
        INSERT INTO debit_note_items (debit_note_id, product_id, product_name, quantity, unit_price, gst_percent, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      items.forEach((item) => {
        this.execute(itemSql, [
          debitNoteId,
          item.productId,
          item.productName,
          item.quantity,
          item.unitPrice,
          item.gstPercent,
          item.lineTotal,
        ]);
      });

      logger.info('Debit Note created', { id: debitNoteId, number: data.debitNoteNumber });
      return debitNoteId;
    });
  }

  public findById(id: number): DebitNote | null {
    const row = this.queryOne<DebitNoteRow>('SELECT * FROM debit_notes WHERE id = ?', [id]);
    return row ? this._mapToDebitNote(row) : null;
  }

  public findByNumber(number: string): DebitNote | null {
    const row = this.queryOne<DebitNoteRow>('SELECT * FROM debit_notes WHERE debit_note_number = ?', [
      number,
    ]);
    return row ? this._mapToDebitNote(row) : null;
  }

  public findBySupplier(supplierId: number): DebitNote[] {
    const sql = `SELECT * FROM debit_notes WHERE supplier_id = ? ORDER BY created_at DESC`;
    return this.queryAll<DebitNoteRow>(sql, [supplierId]).map((row) => this._mapToDebitNote(row));
  }

  public generateNumber(): string {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `DN-${datePart}-`;
    const last = this.queryOne<{ debit_note_number: string }>(
      'SELECT debit_note_number FROM debit_notes WHERE debit_note_number LIKE ? ORDER BY id DESC LIMIT 1',
      [`${prefix}%`]
    );
    let seq = 1;
    if (last) {
      const parts = last.debit_note_number.split('-');
      seq = parseInt(parts[parts.length - 1]) + 1;
    }
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  private _mapToDebitNote(row: DebitNoteRow): DebitNote {
    return {
      id: row.id,
      debitNoteNumber: row.debit_note_number,
      purchaseId: row.purchase_id,
      supplierId: row.supplier_id,
      totalTaxable: row.total_taxable,
      gstTotal: row.gst_total,
      grandTotal: row.grand_total,
      reason: row.reason,
      createdAt: this.parseDate(row.created_at),
    };
  }
}
