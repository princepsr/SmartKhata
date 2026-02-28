import { BaseRepository } from './base-repository';
import { logger } from '../utils/logger';

/**
 * Bill Domain Object (application layer)
 * Monetary values in rupees
 */
export interface Bill {
  id: number;
  billNumber: string;
  customerId: number | null;
  customerName?: string | null;
  subtotal: number; // In rupees
  gstTotal: number; // In rupees
  cgstAmount: number; // CGST portion
  sgstAmount: number; // SGST portion
  igstAmount: number; // IGST (inter-state)
  discountAmount: number; // In rupees
  grandTotal: number; // In rupees
  paymentMode: 'cash' | 'upi' | 'mixed';
  customerGstinSnapshot?: string | null;
  billingAddressSnapshot?: string | null;
  shippingAddressSnapshot?: string | null;
  isPrinted: boolean; // Invoice lock: true after first print
  createdAt: Date;
}

/**
 * Bill Item Domain Object (application layer)
 */
export interface BillItem {
  id: number;
  billId: number;
  productId: number;
  productNameSnapshot: string; // Product name at time of sale
  quantity: number;
  unitPrice: number; // In rupees
  gstPercent: number; // As decimal (e.g., 18.00)
  hsnSnapshot: string | null; // HSN code at time of sale
  purchasePrice?: number; // Snapshot of cost
  lineSubtotal: number;
  lineGst: number;
  lineCgst: number;
  lineSgst: number;
  lineIgst: number;
  lineTotal: number; // In rupees
}

/**
 * Complete Bill with Items
 */
export interface BillWithItems {
  bill: Bill;
  items: BillItem[];
}

/**
 * Create Bill Input
 */
export interface CreateBillInput {
  billNumber: string;
  customerId?: number;
  subtotal: number; // In rupees
  gstTotal: number; // In rupees
  cgstAmount?: number; // CGST portion
  sgstAmount?: number; // SGST portion
  igstAmount?: number; // IGST (inter-state)
  discountAmount?: number; // In rupees
  grandTotal: number; // In rupees
  paymentMode: 'cash' | 'upi' | 'mixed';
  paymentReceived: number;
  customerGstinSnapshot?: string | null;
  billingAddressSnapshot?: string | null;
  shippingAddressSnapshot?: string | null;
}

/**
 * Create Bill Item Input
 */
export interface CreateBillItemInput {
  productId: number;
  productNameSnapshot: string;
  quantity: number;
  unitPrice: number; // In rupees
  gstPercent: number; // As decimal
  hsnSnapshot?: string | null;
  purchasePrice?: number; // Snapshot of cost
  lineSubtotal: number;
  lineGst: number;
  lineCgst: number;
  lineSgst: number;
  lineIgst: number;
  lineTotal: number; // In rupees
}

/**
 * Bill Repository
 *
 * Handles all database operations for bills and bill items.
 * Bills and items are ALWAYS saved together in a single transaction.
 */
export class BillRepository extends BaseRepository {
  /**
   * Create a bill with items (ATOMIC OPERATION)
   *
   * This method ensures that:
   * 1. Bill and all items are saved in a single transaction
   * 2. If any item fails, the entire bill is rolled back
   * 3. Product snapshots are preserved for historical accuracy
   * 4. Final totals are stored (immutable)
   *
   * @param billData - Bill header data
   * @param items - Array of bill items
   * @returns Complete bill with items
   */
  public createBillWithItems(
    billData: CreateBillInput,
    items: CreateBillItemInput[]
  ): BillWithItems {
    return this.transaction(() => {
      // 1. Validate items exist
      if (!items || items.length === 0) {
        throw new Error('Bill must have at least one item');
      }

      // 2. Create bill header
      const billSql = `
        INSERT INTO bills (
          bill_number, customer_id, subtotal, gst_total,
          cgst_amount, sgst_amount, igst_amount,
          discount_amount, grand_total, payment_mode,
          customer_gstin_snapshot, billing_address_snapshot, shipping_address_snapshot
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        billData.billNumber,
        billData.customerId || null,
        billData.subtotal,
        billData.gstTotal,
        billData.cgstAmount || 0,
        billData.sgstAmount || 0,
        billData.igstAmount || 0,
        billData.discountAmount || 0,
        billData.grandTotal,
        billData.paymentMode,
        billData.customerGstinSnapshot || null,
        billData.billingAddressSnapshot || null,
        billData.shippingAddressSnapshot || null,
      ];

      const billResult = this.execute(billSql, params);

      const billId = Number(billResult.lastInsertRowid);

      // 3. Create bill items
      const insertItem = this.db.prepare(`
        INSERT INTO bill_items (
          bill_id, product_id, product_name_snapshot, 
          quantity, unit_price, gst_percent, hsn_snapshot, purchase_price,
          line_subtotal, line_gst, line_cgst, line_sgst, line_igst, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const createdItems: BillItem[] = [];

      for (const item of items) {
        const itemResult = insertItem.run(
          billId,
          item.productId,
          item.productNameSnapshot,
          item.quantity,
          item.unitPrice,
          item.gstPercent,
          item.hsnSnapshot ?? null,
          item.purchasePrice ?? null,
          item.lineSubtotal,
          item.lineGst,
          item.lineCgst,
          item.lineSgst,
          item.lineIgst,
          item.lineTotal
        );

        createdItems.push({
          id: Number(itemResult.lastInsertRowid),
          billId,
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          gstPercent: item.gstPercent,
          hsnSnapshot: item.hsnSnapshot ?? null,
          purchasePrice: item.purchasePrice,
          lineSubtotal: item.lineSubtotal,
          lineGst: item.lineGst,
          lineCgst: item.lineCgst,
          lineSgst: item.lineSgst,
          lineIgst: item.lineIgst,
          lineTotal: item.lineTotal,
        });
      }

      logger.info('Bill created with items', {
        billId,
        billNumber: billData.billNumber,
        itemCount: items.length,
      });

      // 4. Return complete bill (Pre-constructed to avoid re-querying)
      return {
        bill: {
          id: billId,
          billNumber: billData.billNumber,
          customerId: billData.customerId || null,
          subtotal: billData.subtotal,
          gstTotal: billData.gstTotal,
          cgstAmount: billData.cgstAmount || 0,
          sgstAmount: billData.sgstAmount || 0,
          igstAmount: billData.igstAmount || 0,
          discountAmount: billData.discountAmount || 0,
          grandTotal: billData.grandTotal,
          paymentMode: billData.paymentMode,
          customerGstinSnapshot: billData.customerGstinSnapshot || null,
          billingAddressSnapshot: billData.billingAddressSnapshot || null,
          shippingAddressSnapshot: billData.shippingAddressSnapshot || null,
          isPrinted: false,
          createdAt: new Date(), // Local time
        },
        items: createdItems,
      };
    });

    // Transaction ensures:
    // - All inserts succeed OR all are rolled back
    // - No partial bills in database
    // - Atomic operation
  }

  /**
   * Mark a bill as printed (invoice lock)
   * Once printed, bill details are immutable
   */
  public markAsPrinted(billId: number): void {
    const sql = `UPDATE bills SET is_printed = 1 WHERE id = ?`;
    const result = this.execute(sql, [billId]);
    if (result.changes > 0) {
      logger.info('Bill marked as printed (locked)', { billId });
    }
  }

  /**
   * Find bill by ID
   */
  public findById(id: number): Bill | null {
    const sql = `
      SELECT b.*, c.name as customer_name 
      FROM bills b
      LEFT JOIN customers c ON b.customer_id = c.id
      WHERE b.id = ?
    `;
    const row = this.queryOne<any>(sql, [id]);
    return row ? this._mapToBill(row) : null;
  }

  /**
   * Find bill by bill number
   */
  public findByBillNumber(billNumber: string): Bill | null {
    const sql = `
      SELECT b.*, c.name as customer_name 
      FROM bills b
      LEFT JOIN customers c ON b.customer_id = c.id
      WHERE b.bill_number = ?
    `;
    const row = this.queryOne<any>(sql, [billNumber]);
    return row ? this._mapToBill(row) : null;
  }

  /**
   * Find bill with items by bill number
   */
  public findByBillNumberWithItems(billNumber: string): BillWithItems | null {
    const bill = this.findByBillNumber(billNumber);
    if (!bill) {
      return null;
    }

    const items = this.findItemsByBillId(bill.id);

    return {
      bill,
      items,
    };
  }

  /**
   * Find bill with items by ID
   */
  public findByIdWithItems(id: number): BillWithItems | null {
    const bill = this.findById(id);
    if (!bill) {
      return null;
    }

    const items = this.findItemsByBillId(id);
    return { bill, items };
  }

  /**
   * Find the latest bill with its items
   */
  public findLatestWithItems(): BillWithItems | null {
    const row = this.db
      .prepare(
        `
      SELECT b.*, c.name as customer_name 
      FROM bills b
      LEFT JOIN customers c ON b.customer_id = c.id
      ORDER BY b.created_at DESC, b.id DESC 
      LIMIT 1
    `
      )
      .get();

    if (!row) {
      return null;
    }

    const bill = this._mapToBill(row);
    const items = this.findItemsByBillId(bill.id);
    return { bill, items };
  }

  /**
   * List bills by date range
   */
  public findByDateRange(fromDate: Date, toDate: Date): Bill[] {
    // Optimization: Use direct string comparison to utilize idx_bills_created_at
    // Ensure we cover the full day by adjusting toDate if it's just a date
    const sql = `
      SELECT b.*, c.name as customer_name
      FROM bills b
      LEFT JOIN customers c ON b.customer_id = c.id
      WHERE b.created_at >= ? AND b.created_at <= ?
      ORDER BY b.created_at DESC
    `;

    const rows = this.queryAll<any>(sql, [
      this.formatDateForSql(fromDate),
      this.formatDateForSql(toDate),
    ]);

    return rows.map((row) => this._mapToBill(row));
  }

  /**
   * List bills for a specific customer
   */
  public findByCustomerId(customerId: number): Bill[] {
    const sql = `
      SELECT * FROM bills
      WHERE customer_id = ?
      ORDER BY created_at DESC
    `;

    const rows = this.queryAll<any>(sql, [customerId]);
    return rows.map((row) => this._mapToBill(row));
  }

  /**
   * List all bills (paginated)
   */
  public findAll(limit: number = 100, offset: number = 0): Bill[] {
    const sql = `
      SELECT * FROM bills
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = this.queryAll<any>(sql, [limit, offset]);
    return rows.map((row) => this._mapToBill(row));
  }

  /**
   * Get total number of bills in the system
   */
  public getTotalBillCount(): number {
    const sql = `SELECT COUNT(*) as count FROM bills`;
    const result = this.queryOne<{ count: number }>(sql);
    return result?.count || 0;
  }

  /**
   * Find bill items by bill ID
   */
  public findItemsByBillId(billId: number): BillItem[] {
    const sql = `
      SELECT * FROM bill_items
      WHERE bill_id = ?
      ORDER BY id ASC
    `;

    const rows = this.queryAll<any>(sql, [billId]);
    return rows.map((row) => this._mapToBillItem(row));
  }

  /**
   * Get today's bills
   */
  public findToday(): Bill[] {
    const now = new Date();
    // Start of local day in UTC
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // End of local day in UTC
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    return this.findByDateRange(startOfToday, endOfToday);
  }

  /**
   * Get sales summary for date range
   */
  public getSalesSummary(
    fromDate: Date,
    toDate: Date
  ): {
    totalBills: number;
    totalSales: number; // In rupees
    totalGst: number; // In rupees
    totalDiscount: number; // In rupees
  } {
    const sql = `
      SELECT 
        COUNT(*) as total_bills,
        SUM(grand_total) as total_sales,
        SUM(gst_total) as total_gst,
        SUM(discount_amount) as total_discount
      FROM bills
      WHERE created_at >= ? AND created_at <= ?
    `;

    const result = this.queryOne<any>(sql, [
      this.formatDateForSql(fromDate),
      this.formatDateForSql(toDate),
    ]);

    return {
      totalBills: result?.total_bills || 0,
      totalSales: result?.total_sales || 0, // Direct Rupees
      totalGst: result?.total_gst || 0,
      totalDiscount: result?.total_discount || 0,
    };
  }

  public generateBillNumber(): string {
    const today = new Date();
    const prefix = `BILL-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-`;
    const lastBill = this.findLastBillNumberByPrefix(prefix);

    let nextNumber = 1;
    if (lastBill) {
      const parts = lastBill.split('-');
      const lastSeq = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastSeq)) {
        nextNumber = lastSeq + 1;
      }
    }

    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
  }

  /**
   * Find last bill number by prefix
   * Used for generating sequential bill numbers
   * @param prefix e.g 'BILL-20230101-'
   */
  public findLastBillNumberByPrefix(prefix: string): string | null {
    // We search for bill numbers starting with the prefix
    // We order by length desc, then value desc to handle varying sequence lengths correctly
    const sql = `
      SELECT bill_number 
      FROM bills 
      WHERE bill_number LIKE ? 
      ORDER BY length(bill_number) DESC, bill_number DESC
      LIMIT 1
    `;

    const row = this.queryOne<{ bill_number: string }>(sql, [`${prefix}%`]);
    return row ? row.bill_number : null;
  }

  /**
   * Map database row to Bill domain object
   */
  private _mapToBill(row: any): Bill {
    return {
      id: row.id,
      billNumber: row.bill_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      subtotal: row.subtotal, // Direct Rupees
      gstTotal: row.gst_total,
      cgstAmount: row.cgst_amount || 0,
      sgstAmount: row.sgst_amount || 0,
      igstAmount: row.igst_amount || 0,
      discountAmount: row.discount_amount,
      grandTotal: row.grand_total,
      paymentMode: row.payment_mode,
      customerGstinSnapshot: row.customer_gstin_snapshot,
      billingAddressSnapshot: row.billing_address_snapshot,
      shippingAddressSnapshot: row.shipping_address_snapshot,
      isPrinted: row.is_printed === 1,
      createdAt: this.parseDate(row.created_at),
    };
  }

  /**
   * Map database row to BillItem domain object
   */
  private _mapToBillItem(row: any): BillItem {
    return {
      id: row.id,
      billId: row.bill_id,
      productId: row.product_id,
      productNameSnapshot: row.product_name_snapshot,
      quantity: row.quantity,
      unitPrice: row.unit_price, // Direct Rupees
      gstPercent: row.gst_percent, // Direct Percent
      hsnSnapshot: row.hsn_snapshot,
      purchasePrice: row.purchase_price, // Snapshot of cost
      lineSubtotal: row.line_subtotal || 0,
      lineGst: row.line_gst || 0,
      lineCgst: row.line_cgst || 0,
      lineSgst: row.line_sgst || 0,
      lineIgst: row.line_igst || 0,
      lineTotal: row.line_total, // Direct Rupees
    };
  }
}
