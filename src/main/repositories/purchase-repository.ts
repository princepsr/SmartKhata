import { BaseRepository } from './base-repository';
import { logger } from '../utils/logger';

export interface Purchase {
  id: number;
  purchaseNumber: string;
  supplierName: string;
  supplierGstin: string | null;
  invoiceNumber: string | null;
  invoiceDate: string; // YYYY-MM-DD
  totalTaxable: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstTotal: number;
  grandTotal: number;
  notes: string | null;
  paymentStatus: 'PENDING' | 'PAID' | 'PARTIAL';
  amountPaid: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseItem {
  id: number;
  purchaseId: number;
  productId: number | null;
  productName: string;
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

export interface PurchaseWithItems {
  purchase: Purchase;
  items: PurchaseItem[];
}

export interface CreatePurchaseInput {
  purchaseNumber: string;
  supplierName: string;
  supplierGstin?: string;
  invoiceNumber?: string;
  invoiceDate: string;
  totalTaxable: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstTotal: number;
  grandTotal: number;
  notes?: string;
  paymentStatus?: 'PENDING' | 'PAID' | 'PARTIAL';
  amountPaid?: number;
  supplierId?: number;
}

export interface CreatePurchaseItemInput {
  productId?: number;
  productName: string;
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

export interface ITCSummary {
  totalTaxable: number;
  cgstPaid: number;
  sgstPaid: number;
  igstPaid: number;
  totalItc: number; // Total ITC available (cgst + sgst + igst)
  purchaseCount: number;
}

export class PurchaseRepository extends BaseRepository {
  /**
   * Create a purchase with items (ATOMIC)
   */
  public createPurchaseWithItems(
    data: CreatePurchaseInput,
    items: CreatePurchaseItemInput[]
  ): PurchaseWithItems {
    return this.transaction(() => {
      const now = new Date();
      const sql = `
        INSERT INTO purchases (
          purchase_number, supplier_name, supplier_gstin, invoice_number, invoice_date,
          total_taxable, cgst_amount, sgst_amount, igst_amount, gst_total,
          grand_total, notes, payment_status, amount_paid, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const result = this.execute(sql, [
        data.purchaseNumber,
        data.supplierName,
        data.supplierGstin ?? null,
        data.invoiceNumber ?? null,
        data.invoiceDate,
        data.totalTaxable,
        data.cgstAmount,
        data.sgstAmount,
        data.igstAmount,
        data.gstTotal,
        data.grandTotal,
        data.notes ?? null,
        data.paymentStatus || 'PENDING',
        data.amountPaid || 0,
        this.formatDateForSql(now),
        this.formatDateForSql(now),
      ]);

      const purchaseId = Number(result.lastInsertRowid);

      const insertItem = this.db.prepare(`
        INSERT INTO purchase_items (
          purchase_id, product_id, product_name, hsn_code,
          quantity, unit_price, gst_percent,
          line_taxable, line_cgst, line_sgst, line_igst, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const createdItems: PurchaseItem[] = [];
      for (const item of items) {
        const ir = insertItem.run(
          purchaseId,
          item.productId ?? null,
          item.productName,
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
          purchaseId,
          productId: item.productId ?? null,
          productName: item.productName,
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

      logger.info('Purchase recorded', {
        purchaseId,
        purchaseNumber: data.purchaseNumber,
        itemCount: items.length,
      });

      return {
        purchase: {
          id: purchaseId,
          purchaseNumber: data.purchaseNumber,
          supplierName: data.supplierName,
          supplierGstin: data.supplierGstin ?? null,
          invoiceNumber: data.invoiceNumber ?? null,
          invoiceDate: data.invoiceDate,
          totalTaxable: data.totalTaxable,
          cgstAmount: data.cgstAmount,
          sgstAmount: data.sgstAmount,
          igstAmount: data.igstAmount,
          gstTotal: data.gstTotal,
          grandTotal: data.grandTotal,
          notes: data.notes ?? null,
          paymentStatus: (data.paymentStatus as any) || 'PENDING',
          amountPaid: data.amountPaid || 0,
          createdAt: now,
          updatedAt: now,
        },
        items: createdItems,
      };
    });
  }

  /**
   * Record a transaction in the supplier ledger
   */
  public recordLedgerEntry(entry: {
    supplierId: number;
    amount: number;
    type: 'PURCHASE' | 'PAYMENT_OUT' | 'OPENING_BALANCE';
    referenceId?: number;
    notes?: string;
  }): void {
    const sql = `
      INSERT INTO supplier_ledger (supplier_id, amount, type, reference_id, notes)
      VALUES (?, ?, ?, ?, ?)
    `;
    this.execute(sql, [
      entry.supplierId,
      entry.amount,
      entry.type,
      entry.referenceId ?? null,
      entry.notes ?? null,
    ]);
  }

  /**
   * Find purchase by ID with items
   */
  public findByIdWithItems(id: number): PurchaseWithItems | null {
    const row = this.queryOne<any>(`SELECT * FROM purchases WHERE id = ?`, [id]);
    if (!row) return null;
    const items = this.queryAll<any>(`SELECT * FROM purchase_items WHERE purchase_id = ?`, [id]);
    return {
      purchase: this._mapToPurchase(row),
      items: items.map((r) => this._mapToItem(r)),
    };
  }

  /**
   * List purchases with date filter + pagination
   */
  public list(
    startDate: string,
    endDate: string,
    page: number = 1,
    limit: number = 50
  ): { data: Purchase[]; total: number } {
    const total = (
      this.queryOne<{ c: number }>(
        `SELECT COUNT(*) as c FROM purchases WHERE date(invoice_date) BETWEEN date(?) AND date(?)`,
        [startDate, endDate]
      ) ?? { c: 0 }
    ).c;

    const rows = this.queryAll<any>(
      `SELECT * FROM purchases
       WHERE date(invoice_date) BETWEEN date(?) AND date(?)
       ORDER BY invoice_date DESC, created_at DESC
       LIMIT ? OFFSET ?`,
      [startDate, endDate, limit, (page - 1) * limit]
    );

    return { data: rows.map((r) => this._mapToPurchase(r)), total };
  }

  /**
   * Get ITC summary for a date range
   * Returns total GST paid on purchases (available for ITC claim)
   */
  public getITCSummary(startDate: string, endDate: string): ITCSummary {
    const row = this.queryOne<{
      total_taxable: number;
      cgst_paid: number;
      sgst_paid: number;
      igst_paid: number;
      total_itc: number;
      purchase_count: number;
    }>(
      `SELECT
         COALESCE(SUM(total_taxable), 0) as total_taxable,
         COALESCE(SUM(cgst_amount), 0) as cgst_paid,
         COALESCE(SUM(sgst_amount), 0) as sgst_paid,
         COALESCE(SUM(igst_amount), 0) as igst_paid,
         COALESCE(SUM(gst_total), 0) as total_itc,
         COUNT(*) as purchase_count
       FROM purchases
       WHERE date(invoice_date) BETWEEN date(?) AND date(?)`,
      [startDate, endDate]
    );

    return {
      totalTaxable: row?.total_taxable ?? 0,
      cgstPaid: row?.cgst_paid ?? 0,
      sgstPaid: row?.sgst_paid ?? 0,
      igstPaid: row?.igst_paid ?? 0,
      totalItc: row?.total_itc ?? 0,
      purchaseCount: row?.purchase_count ?? 0,
    };
  }

  /**
   * Find last purchase number for a given date prefix
   */
  public findLastPurchaseNumberByPrefix(prefix: string): string | null {
    const row = this.queryOne<{ purchase_number: string }>(
      `SELECT purchase_number FROM purchases WHERE purchase_number LIKE ?
       ORDER BY length(purchase_number) DESC, purchase_number DESC LIMIT 1`,
      [`${prefix}%`]
    );
    return row ? row.purchase_number : null;
  }

  private _mapToPurchase(row: any): Purchase {
    return {
      id: row.id,
      purchaseNumber: row.purchase_number,
      supplierName: row.supplier_name,
      supplierGstin: row.supplier_gstin,
      invoiceNumber: row.invoice_number,
      invoiceDate: row.invoice_date,
      totalTaxable: row.total_taxable,
      cgstAmount: row.cgst_amount,
      sgstAmount: row.sgst_amount,
      igstAmount: row.igst_amount,
      gstTotal: row.gst_total,
      grandTotal: row.grand_total,
      notes: row.notes,
      paymentStatus: row.payment_status || 'PENDING',
      amountPaid: row.amount_paid || 0,
      createdAt: this.parseDate(row.created_at),
      updatedAt: this.parseDate(row.updated_at),
    };
  }

  private _mapToItem(row: any): PurchaseItem {
    return {
      id: row.id,
      purchaseId: row.purchase_id,
      productId: row.product_id,
      productName: row.product_name,
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
