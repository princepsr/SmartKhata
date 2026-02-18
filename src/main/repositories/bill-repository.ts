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
  subtotal: number; // In rupees
  gstTotal: number; // In rupees
  discountAmount: number; // In rupees
  grandTotal: number; // In rupees
  paymentMode: 'cash' | 'upi' | 'mixed';
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
  discountAmount?: number; // In rupees
  grandTotal: number; // In rupees
  paymentMode: 'cash' | 'upi' | 'mixed';
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
          discount_amount, grand_total, payment_mode
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        billData.billNumber,
        billData.customerId || null,
        Math.round(billData.subtotal * 100), // Rupees → Paise
        Math.round(billData.gstTotal * 100),
        Math.round((billData.discountAmount || 0) * 100),
        Math.round(billData.grandTotal * 100),
        billData.paymentMode,
      ];

      const billResult = this.execute(billSql, params);

      const billId = Number(billResult.lastInsertRowid);

      // 3. Create bill items
      const itemSql = `
        INSERT INTO bill_items (
          bill_id, product_id, product_name_snapshot, 
          quantity, unit_price, gst_percent, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const createdItems: BillItem[] = [];

      items.forEach((item) => {
        const itemResult = this.execute(itemSql, [
          billId,
          item.productId,
          item.productNameSnapshot,
          item.quantity,
          Math.round(item.unitPrice * 100), // Rupees → Paise
          Math.round(item.gstPercent * 100), // Percent → Basis points
          Math.round(item.lineTotal * 100), // Rupees → Paise
        ]);

        createdItems.push({
          id: Number(itemResult.lastInsertRowid),
          billId,
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          gstPercent: item.gstPercent,
          lineTotal: item.lineTotal,
        });
      });

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
          discountAmount: billData.discountAmount || 0,
          grandTotal: billData.grandTotal,
          paymentMode: billData.paymentMode,
          createdAt: new Date(), // Approximate current time
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
   * Find bill by ID
   */
  public findById(id: number): Bill | null {
    const sql = `SELECT * FROM bills WHERE id = ?`;
    const row = this.queryOne<any>(sql, [id]);
    return row ? this._mapToBill(row) : null;
  }

  /**
   * Find bill by bill number
   */
  public findByBillNumber(billNumber: string): Bill | null {
    const sql = `SELECT * FROM bills WHERE bill_number = ?`;
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
      SELECT * FROM bills 
      ORDER BY created_at DESC, id DESC 
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
      SELECT * FROM bills
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
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
    const sql = `
      SELECT * FROM bills 
      WHERE date(created_at, 'localtime') = date('now', 'localtime')
      ORDER BY created_at DESC
    `;
    const rows = this.queryAll<any>(sql);
    return rows.map((row) => this._mapToBill(row));
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
      totalSales: (result?.total_sales || 0) / 100, // Paise → Rupees
      totalGst: (result?.total_gst || 0) / 100,
      totalDiscount: (result?.total_discount || 0) / 100,
    };
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
      subtotal: row.subtotal / 100, // Paise → Rupees
      gstTotal: row.gst_total / 100,
      discountAmount: row.discount_amount / 100,
      grandTotal: row.grand_total / 100,
      paymentMode: row.payment_mode,
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
      unitPrice: row.unit_price / 100, // Paise → Rupees
      gstPercent: row.gst_percent / 100, // Basis points → Percent
      lineTotal: row.line_total / 100, // Paise → Rupees
    };
  }
}
