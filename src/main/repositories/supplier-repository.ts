import { BaseRepository, DatabaseError } from './base-repository';
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
 * Supplier Repository
 */
export class SupplierRepository extends BaseRepository {
  public create(data: CreateSupplierInput): Supplier {
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

    logger.info('Supplier created', { id: result.lastInsertRowid, name: data.name });
    return this.findById(Number(result.lastInsertRowid))!;
  }

  public update(id: number, data: UpdateSupplierInput): Supplier {
    const fields: string[] = [];
    const values: any[] = [];

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

    if (fields.length === 0) throw new Error('No fields to update');
    fields.push("updated_at = datetime('now')");

    const sql = `UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);
    this.execute(sql, values);

    return this.findById(id)!;
  }

  public findById(id: number): Supplier | null {
    const row = this.queryOne<any>('SELECT * FROM suppliers WHERE id = ?', [id]);
    return row ? this._mapToSupplier(row) : null;
  }

  public findByPhone(phone: string): Supplier | null {
    const row = this.queryOne<any>('SELECT * FROM suppliers WHERE phone = ? AND is_active = 1', [
      phone,
    ]);
    return row ? this._mapToSupplier(row) : null;
  }

  public findAll(includeInactive = false): Supplier[] {
    const sql = `SELECT * FROM suppliers ${includeInactive ? '' : 'WHERE is_active = 1'} ORDER BY name ASC`;
    return this.queryAll<any>(sql).map((row) => this._mapToSupplier(row));
  }

  public search(query: string): Supplier[] {
    const sql = `
      SELECT * FROM suppliers 
      WHERE (name LIKE ? OR phone LIKE ? OR gstin LIKE ?) 
      AND is_active = 1 
      ORDER BY name ASC
    `;
    const pattern = `%${query}%`;
    return this.queryAll<any>(sql, [pattern, pattern, pattern]).map((row) =>
      this._mapToSupplier(row)
    );
  }

  public updateBalance(id: number, delta: number): void {
    const sql = `UPDATE suppliers SET balance_due = balance_due + ?, updated_at = datetime('now') WHERE id = ?`;
    this.execute(sql, [delta, id]);
  }

  private _mapToSupplier(row: any): Supplier {
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
