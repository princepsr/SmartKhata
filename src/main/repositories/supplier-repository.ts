import { BaseRepository } from './base-repository';
import { logger } from '../utils/logger';

/**
 * Supplier Domain Object
 */
export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  gstin: string | null;
  address: string | null;
  email: string | null;
  balanceDue: number; // Positive = we owe them
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Supplier Ledger Entry
 */
export interface SupplierLedgerEntry {
  id: number;
  supplierId: number;
  amount: number;
  type: 'PURCHASE' | 'PAYMENT_OUT' | 'PAYMENT_IN' | 'OPENING_BALANCE';
  referenceId?: number;
  referenceNumber?: string; // invoice_number from purchases
  notes?: string;
  createdAt: Date;
}

/**
 * Create/Update Inputs
 */
export interface CreateSupplierInput {
  name: string;
  phone?: string;
  gstin?: string;
  address?: string;
  email?: string;
  balanceDue?: number;
}

export interface UpdateSupplierInput {
  name?: string;
  phone?: string;
  gstin?: string;
  address?: string;
  email?: string;
  balanceDue?: number;
  isActive?: boolean;
}

/**
 * Supplier Database Row
 */
interface SupplierRow {
  id: number;
  name: string;
  phone: string | null;
  gstin: string | null;
  address: string | null;
  email: string | null;
  balance_due: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/**
 * Supplier Ledger Database Row
 */
interface SupplierLedgerRow {
  id: number;
  supplier_id: number;
  amount: number;
  type: 'PURCHASE' | 'PAYMENT_OUT' | 'PAYMENT_IN' | 'OPENING_BALANCE';
  reference_id: number | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
}

/**
 * Supplier Repository
 */
export class SupplierRepository extends BaseRepository {
  public create(data: CreateSupplierInput): Supplier {
    return this.transaction(() => {
      const sql = `
        INSERT INTO suppliers (name, phone, gstin, address, email, balance_due)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      const result = this.execute(sql, [
        data.name,
        data.phone || null,
        data.gstin || null,
        data.address || null,
        data.email || null,
        data.balanceDue || 0,
      ]);

      const supplierId = Number(result.lastInsertRowid);

      // Add opening balance entry to ledger if balanceDue != 0
      if (data.balanceDue && data.balanceDue !== 0) {
        this.addLedgerEntry({
          supplierId,
          amount: Math.abs(data.balanceDue),
          type: 'OPENING_BALANCE',
          notes: 'Initial balance at creation',
        });
      }

      logger.info('Supplier created', { id: supplierId, name: data.name });
      const supplier = this.findById(supplierId);
      if (!supplier) {
        throw new Error('Failed to retrieve created supplier');
      }
      return supplier;
    });
  }

  public update(id: number, data: UpdateSupplierInput): Supplier {
    const fields: string[] = [];
    const values: unknown[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbKey =
          key === 'isActive'
            ? 'is_active'
            : key === 'balanceDue'
              ? 'balance_due'
              : key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        fields.push(`${dbKey} = ?`);
        values.push(key === 'isActive' ? (value ? 1 : 0) : value);
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }
    fields.push("updated_at = datetime('now')");

    const sql = `UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);
    this.execute(sql, values);

    const supplier = this.findById(id);
    if (!supplier) {
      throw new Error('Failed to retrieve updated supplier');
    }
    return supplier;
  }

  public findById(id: number): Supplier | null {
    const row = this.queryOne<SupplierRow>('SELECT * FROM suppliers WHERE id = ?', [id]);
    return row ? this._mapToSupplier(row) : null;
  }

  public findByPhone(phone: string): Supplier | null {
    const row = this.queryOne<SupplierRow>('SELECT * FROM suppliers WHERE phone = ? AND is_active = 1', [
      phone,
    ]);
    return row ? this._mapToSupplier(row) : null;
  }

  public findAll(includeInactive = false): Supplier[] {
    const sql = `SELECT * FROM suppliers ${includeInactive ? '' : 'WHERE is_active = 1'} ORDER BY name ASC`;
    return this.queryAll<SupplierRow>(sql).map((row) => this._mapToSupplier(row));
  }

  public search(query: string): Supplier[] {
    const sql = `
      SELECT * FROM suppliers 
      WHERE (name LIKE ? OR phone LIKE ? OR gstin LIKE ?) 
      AND is_active = 1 
      ORDER BY name ASC
    `;
    const pattern = `%${query}%`;
    return this.queryAll<SupplierRow>(sql, [pattern, pattern, pattern]).map((row) =>
      this._mapToSupplier(row)
    );
  }

  public updateBalance(id: number, delta: number): void {
    const sql = `UPDATE suppliers SET balance_due = balance_due + ?, updated_at = datetime('now') WHERE id = ?`;
    this.execute(sql, [delta, id]);
  }

  /**
   * Add a ledger entry
   */
  public addLedgerEntry(data: {
    supplierId: number;
    amount: number;
    type: 'PURCHASE' | 'PAYMENT_OUT' | 'PAYMENT_IN' | 'OPENING_BALANCE';
    referenceId?: number;
    notes?: string;
  }): void {
    const sql = `
      INSERT INTO supplier_ledger (supplier_id, amount, type, reference_id, notes)
      VALUES (?, ?, ?, ?, ?)
    `;
    this.execute(sql, [
      data.supplierId,
      data.amount,
      data.type,
      data.referenceId || null,
      data.notes || null,
    ]);
  }

  /**
   * Add a manual payment transaction (updates balance + ledger)
   */
  public addManualPayment(data: {
    supplierId: number;
    amount: number;
    type: 'PAYMENT_IN' | 'PAYMENT_OUT';
    notes?: string;
  }): void {
    this.transaction(() => {
      this.updateBalance(data.supplierId, data.amount);
      this.addLedgerEntry({
        supplierId: data.supplierId,
        amount: Math.abs(data.amount),
        type: data.type,
        notes: data.notes,
      });
    });
  }

  /**
   * Get ledger entries for a supplier
   */
  public getLedgerBySupplierId(supplierId: number): SupplierLedgerEntry[] {
    const sql = `
      SELECT 
        sl.*,
        p.invoice_number as reference_number
      FROM supplier_ledger sl
      LEFT JOIN purchases p ON sl.reference_id = p.id
      WHERE sl.supplier_id = ?
      ORDER BY sl.created_at DESC, sl.id DESC
    `;
    const rows = this.queryAll<SupplierLedgerRow>(sql, [supplierId]);
    return rows.map((row) => ({
      id: row.id,
      supplierId: row.supplier_id,
      amount: row.amount,
      type: row.type,
      referenceId: row.reference_id === null ? undefined : row.reference_id,
      referenceNumber: row.reference_number === null ? undefined : row.reference_number,
      notes: row.notes === null ? undefined : row.notes,
      createdAt: this.parseDate(row.created_at),
    }));
  }

  private _mapToSupplier(row: SupplierRow): Supplier {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      gstin: row.gstin,
      address: row.address,
      email: row.email,
      balanceDue: row.balance_due,
      isActive: row.is_active === 1,
      createdAt: this.parseDate(row.created_at),
      updatedAt: this.parseDate(row.updated_at),
    };
  }
}
