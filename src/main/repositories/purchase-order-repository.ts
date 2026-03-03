import { BaseRepository } from './base-repository';
import { PurchaseOrder } from '@shared/types/ipc';

export class PurchaseOrderRepository extends BaseRepository {
  /**
   * List all purchase orders
   */
  async listPurchaseOrders(options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<PurchaseOrder[]> {
    let query = `
      SELECT 
        po.*,
        s.name as supplier_name,
        s.gstin as supplier_gstin
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
    `;

    const params: any[] = [];
    if (options?.startDate && options?.endDate) {
      query += ` WHERE po.po_date BETWEEN ? AND ? `;
      params.push(options.startDate, options.endDate);
    }

    query += ` ORDER BY po.po_date DESC, po.created_at DESC `;

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((row) => this.mapDbToPurchaseOrder(row));
  }

  /**
   * Get purchase order by ID
   */
  async getPurchaseOrderById(id: number): Promise<PurchaseOrder | null> {
    const query = `
      SELECT 
        po.*,
        s.name as supplier_name,
        s.gstin as supplier_gstin
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.id = ?
    `;
    const row = this.db.prepare(query).get(id) as any;
    if (!row) {
      return null;
    }

    const itemsQuery = `
      SELECT * FROM purchase_order_items WHERE purchase_order_id = ?
    `;
    const items = this.db.prepare(itemsQuery).all(id) as any[];

    const po = this.mapDbToPurchaseOrder(row);
    po.items = items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      hsnCode: item.hsn_code,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      gstPercent: item.gst_percent,
      lineTotal: item.line_total,
    }));

    return po;
  }

  /**
   * Create new purchase order
   */
  async createPurchaseOrder(data: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    const insertPO = this.db.prepare(`
      INSERT INTO purchase_orders (
        po_number, supplier_id, supplier_name_snapshot, supplier_gstin_snapshot, po_date, 
        total_taxable, gst_total, grand_total, status, notes
      ) VALUES (
        @poNumber, @supplierId, @supplierNameSnapshot, @supplierGstinSnapshot, @poDate, 
        @totalTaxable, @gstTotal, @grandTotal, @status, @notes
      )
    `);

    const insertItem = this.db.prepare(`
      INSERT INTO purchase_order_items (
        purchase_order_id, product_id, product_name, hsn_code,
        quantity, unit_price, gst_percent, line_total
      ) VALUES (
        @poId, @productId, @productName, @hsnCode,
        @quantity, @unitPrice, @gstPercent, @lineTotal
      )
    `);

    const transaction = this.db.transaction((poData: any) => {
      // 1. Generate PO Number if empty
      const prefix = 'PO-';
      const year = new Date().getFullYear();
      let newPoNumber = poData.poNumber;
      if (!newPoNumber) {
        const lastPO = this.db
          .prepare(
            `
          SELECT po_number FROM purchase_orders 
          WHERE po_number LIKE ? 
          ORDER BY id DESC LIMIT 1
        `
          )
          .get(`${prefix}${year}-%`) as { po_number: string } | undefined;

        let nextSeq = 1;
        if (lastPO) {
          const parts = lastPO.po_number.split('-');
          if (parts.length === 3) {
            nextSeq = parseInt(parts[2], 10) + 1;
          }
        }
        newPoNumber = `${prefix}${year}-${nextSeq.toString().padStart(4, '0')}`;
      }

      // 2. Insert PO
      const result = insertPO.run({
        poNumber: newPoNumber,
        supplierId: poData.supplierId,
        supplierNameSnapshot: poData.supplierNameSnapshot || 'Unknown',
        supplierGstinSnapshot: poData.supplierGstin || null,
        poDate: poData.poDate || new Date().toISOString().split('T')[0],
        totalTaxable: poData.totalTaxable || 0,
        gstTotal: poData.gstTotal || 0,
        grandTotal: poData.grandTotal || 0,
        status: poData.status || 'PENDING',
        notes: poData.notes || null,
      });

      const poId = result.lastInsertRowid as number;

      // 3. Insert Items
      if (poData.items && poData.items.length > 0) {
        for (const item of poData.items) {
          insertItem.run({
            poId,
            productId: item.productId || null,
            productName: item.productName,
            hsnCode: item.hsnCode || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            gstPercent: item.gstPercent,
            lineTotal: item.lineTotal,
          });
        }
      }

      return poId;
    });

    try {
      const result = transaction(data);
      const poId = result as number;
      // return full PO
      return this.getPurchaseOrderById(poId) as Promise<PurchaseOrder>;
    } catch (error) {
      console.error('Error creating purchase order:', error);
      throw error;
    }
  }

  /**
   * Update a purchase order status
   */
  async updatePurchaseOrderStatus(
    id: number,
    status: 'PENDING' | 'RECEIVED' | 'CANCELLED'
  ): Promise<boolean> {
    const stmt = this.db.prepare(
      "UPDATE purchase_orders SET status = ?, updated_at = datetime('now') WHERE id = ?"
    );
    const result = stmt.run(status, id);
    return result.changes > 0;
  }

  /**
   * Update an existing purchase order
   */
  async updatePurchaseOrder(id: number, data: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    const updatePO = this.db.prepare(`
      UPDATE purchase_orders SET
        po_number = @poNumber,
        supplier_id = @supplierId,
        supplier_name_snapshot = @supplierNameSnapshot,
        supplier_gstin_snapshot = @supplierGstinSnapshot,
        po_date = @poDate,
        total_taxable = @totalTaxable,
        gst_total = @gstTotal,
        grand_total = @grandTotal,
        notes = @notes,
        updated_at = datetime('now')
      WHERE id = @id
    `);

    const deleteItems = this.db.prepare(
      'DELETE FROM purchase_order_items WHERE purchase_order_id = ?'
    );

    const insertItem = this.db.prepare(`
      INSERT INTO purchase_order_items (
        purchase_order_id, product_id, product_name, hsn_code,
        quantity, unit_price, gst_percent, line_total
      ) VALUES (
        @poId, @productId, @productName, @hsnCode,
        @quantity, @unitPrice, @gstPercent, @lineTotal
      )
    `);

    const transaction = this.db.transaction((poData: any) => {
      // 1. Update PO Header
      updatePO.run({
        id,
        poNumber: poData.poNumber,
        supplierId: poData.supplierId,
        supplierNameSnapshot: poData.supplierNameSnapshot || 'Unknown',
        supplierGstinSnapshot: poData.supplierGstin || null,
        poDate: poData.poDate,
        totalTaxable: poData.totalTaxable || 0,
        gstTotal: poData.gstTotal || 0,
        grandTotal: poData.grandTotal || 0,
        notes: poData.notes || null,
      });

      // 2. Refresh Items (Delete and Re-insert)
      deleteItems.run(id);

      if (poData.items && poData.items.length > 0) {
        for (const item of poData.items) {
          insertItem.run({
            poId: id,
            productId: item.productId || null,
            productName: item.productName,
            hsnCode: item.hsnCode || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            gstPercent: item.gstPercent,
            lineTotal: item.lineTotal,
          });
        }
      }

      return id;
    });

    try {
      transaction(data);
      return this.getPurchaseOrderById(id) as Promise<PurchaseOrder>;
    } catch (error) {
      console.error('Error updating purchase order:', error);
      throw error;
    }
  }

  /**
   * Map DB row to PurchaseOrder entity
   */
  private mapDbToPurchaseOrder(row: any): PurchaseOrder {
    return {
      id: row.id,
      poNumber: row.po_number,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name || row.supplier_name_snapshot,
      supplierGstin: row.supplier_gstin_snapshot || row.supplier_gstin,
      poDate: row.po_date,
      totalTaxable: row.total_taxable,
      gstTotal: row.gst_total,
      grandTotal: row.grand_total,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
