import { BaseRepository, DatabaseError } from './base-repository';
import { logger } from '../utils/logger';

/**
 * Customer Domain Object (application layer)
 * Monetary values in rupees
 */
export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  address?: string;
  email?: string;
  balanceDue: number; // In rupees (positive = owes, negative = advance)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Customer Ledger Entry
 */
export interface CustomerLedgerEntry {
  id: number;
  customerId: number;
  amount: number; // In rupees
  type: 'SALE' | 'PAYMENT_IN' | 'PAYMENT_OUT' | 'OPENING_BALANCE';
  referenceId?: number;
  referenceNumber?: string; // e.g. Bill Number
  notes?: string;
  createdAt: Date;
}

/**
 * Create Customer Input
 */
export interface CreateCustomerInput {
  name: string;
  phone?: string;
  address?: string;
  email?: string;
  balanceDue?: number; // In rupees (default 0)
}

/**
 * Update Customer Input
 */
export interface UpdateCustomerInput {
  name?: string;
  phone?: string;
  address?: string;
  email?: string;
  balanceDue?: number; // In rupees
  isActive?: boolean;
}

/**
 * Customer Repository
 *
 * Handles all database operations for customers.
 * Converts between database types (INTEGER paise) and domain types (number rupees).
 */
export class CustomerRepository extends BaseRepository {
  /**
   * Create a new customer
   */
  public create(data: CreateCustomerInput): Customer {
    const sql = `
      INSERT INTO customers (name, phone, address, email, balance_due)
      VALUES (?, ?, ?, ?, ?)
    `;

    const result = this.execute(sql, [
      data.name,
      data.phone || null,
      data.address || null,
      data.email || null,
      data.balanceDue || 0, // Direct Rupees
    ]);

    logger.info('Customer created', { id: result.lastInsertRowid, name: data.name });

    const customer = this.findById(Number(result.lastInsertRowid));
    if (!customer) {
      throw new Error('Failed to retrieve created customer');
    }

    return customer;
  }

  /**
   * Update a customer
   */
  public update(id: number, data: UpdateCustomerInput): Customer {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.phone !== undefined) {
      fields.push('phone = ?');
      values.push(data.phone || null);
    }
    if (data.address !== undefined) {
      fields.push('address = ?');
      values.push(data.address || null);
    }
    if (data.email !== undefined) {
      fields.push('email = ?');
      values.push(data.email || null);
    }
    if (data.balanceDue !== undefined) {
      fields.push('balance_due = ?');
      values.push(data.balanceDue); // Direct Rupees
    }
    if (data.isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(data.isActive ? 1 : 0);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    // Always update updated_at
    fields.push("updated_at = datetime('now', 'localtime')");

    const sql = `
      UPDATE customers
      SET ${fields.join(', ')}
      WHERE id = ?
    `;
    values.push(id);

    const result = this.execute(sql, values);

    if (result.changes === 0) {
      throw new DatabaseError('Customer not found', 'NOT_FOUND');
    }

    logger.info('Customer updated', { id, changes: result.changes });

    const customer = this.findById(id);
    if (!customer) {
      throw new Error('Failed to retrieve updated customer');
    }

    return customer;
  }

  /**
   * Find customer by ID
   */
  public findById(id: number): Customer | null {
    const sql = `SELECT * FROM customers WHERE id = ?`;
    const row = this.queryOne<any>(sql, [id]);
    return row ? this._mapToCustomer(row) : null;
  }

  /**
   * Find customer by phone number
   */
  public findByPhone(phone: string, includeInactive: boolean = false): Customer | null {
    const statusFilter = includeInactive ? '' : 'AND is_active = 1';
    const sql = `
      SELECT * FROM customers
      WHERE phone = ? ${statusFilter}
    `;
    const row = this.queryOne<any>(sql, [phone]);
    return row ? this._mapToCustomer(row) : null;
  }

  /**
   * List all active customers with pagination
   */
  public findAll(includeInactive: boolean = false, limit?: number, offset?: number): Customer[] {
    const statusFilter = includeInactive ? '' : 'WHERE is_active = 1';
    let sql = `
      SELECT * FROM customers
      ${statusFilter}
      ORDER BY name ASC
    `;

    const params: any[] = [];
    if (limit !== undefined) {
      sql += ` LIMIT ?`;
      params.push(limit);
    }
    if (offset !== undefined) {
      sql += ` OFFSET ?`;
      params.push(offset);
    }

    const rows = this.queryAll<any>(sql, params);
    return rows.map((row) => this._mapToCustomer(row));
  }

  /**
   * Get total count of customers
   */
  public countAll(includeInactive: boolean = false): number {
    const statusFilter = includeInactive ? '' : 'WHERE is_active = 1';
    const sql = `
      SELECT COUNT(*) as count FROM customers
      ${statusFilter}
    `;
    const row = this.queryOne<{ count: number }>(sql);
    return row ? row.count : 0;
  }

  /**
   * Search customers by name or phone with pagination
   */
  public searchByName(
    query: string,
    includeInactive: boolean = false,
    limit?: number,
    offset?: number
  ): Customer[] {
    let sql = `
      SELECT * FROM customers
      WHERE (name LIKE ? OR phone LIKE ?)
      ${includeInactive ? '' : 'AND is_active = 1'}
      ORDER BY name ASC
    `;

    const searchPattern = `%${query}%`;
    const params: any[] = [searchPattern, searchPattern];

    if (limit !== undefined) {
      sql += ` LIMIT ?`;
      params.push(limit);
    }
    if (offset !== undefined) {
      sql += ` OFFSET ?`;
      params.push(offset);
    }

    const rows = this.queryAll<any>(sql, params);
    return rows.map((row) => this._mapToCustomer(row));
  }

  /**
   * Get total count of customers matching search
   */
  public countSearch(query: string, includeInactive: boolean = false): number {
    const sql = `
      SELECT COUNT(*) as count FROM customers
      WHERE (name LIKE ? OR phone LIKE ?)
      ${includeInactive ? '' : 'AND is_active = 1'}
    `;
    const searchPattern = `%${query}%`;
    const row = this.queryOne<{ count: number }>(sql, [searchPattern, searchPattern]);
    return row ? row.count : 0;
  }

  /**
   * Update customer balance (for udhaar tracking)
   *
   * @param customerId - Customer ID
   * @param deltaAmount - Change in balance (in rupees)
   *                      Positive = customer owes more
   *                      Negative = customer paid/advance
   */
  public updateBalance(customerId: number, deltaAmount: number): void {
    const sql = `
      UPDATE customers
      SET balance_due = balance_due + ?, updated_at = datetime('now')
      WHERE id = ?
    `;

    const result = this.execute(sql, [deltaAmount, customerId]);

    if (result.changes === 0) {
      throw new DatabaseError('Customer not found', 'NOT_FOUND');
    }

    logger.info('Customer balance updated', { customerId, deltaAmount });
  }

  /**
   * Get customers with outstanding balance (udhaar)
   */
  public getCustomersWithBalance(): Customer[] {
    const sql = `
      SELECT * FROM customers
      WHERE is_active = 1 AND balance_due > 0
      ORDER BY balance_due DESC
    `;
    const rows = this.queryAll<any>(sql);
    return rows.map((row) => this._mapToCustomer(row));
  }

  /**
   * Get customers with advance payment
   */
  public getCustomersWithAdvance(): Customer[] {
    const sql = `
      SELECT * FROM customers
      WHERE is_active = 1 AND balance_due < 0
      ORDER BY balance_due ASC
    `;
    const rows = this.queryAll<any>(sql);
    return rows.map((row) => this._mapToCustomer(row));
  }

  /**
   * Soft delete a customer (set is_active = 0)
   */
  public delete(id: number): void {
    const sql = `
      UPDATE customers
      SET is_active = 0, updated_at = datetime('now')
      WHERE id = ?
    `;

    const result = this.execute(sql, [id]);

    if (result.changes === 0) {
      throw new DatabaseError('Customer not found', 'NOT_FOUND');
    }

    logger.info('Customer soft deleted (deactivated)', { id });
  }

  /**
   * Add a ledger entry
   */
  public addLedgerEntry(data: {
    customerId: number;
    amount: number;
    type: 'SALE' | 'PAYMENT_IN' | 'PAYMENT_OUT' | 'OPENING_BALANCE';
    referenceId?: number;
    notes?: string;
  }): void {
    const sql = `
      INSERT INTO customer_ledger (customer_id, amount, type, reference_id, notes)
      VALUES (?, ?, ?, ?, ?)
    `;
    this.execute(sql, [
      data.customerId,
      data.amount, // Direct Rupees
      data.type,
      data.referenceId || null,
      data.notes || null,
    ]);
  }

  /**
   * Get ledger entries for a customer
   */
  public getLedgerByCustomerId(customerId: number): CustomerLedgerEntry[] {
    const sql = `
      SELECT 
        cl.*,
        b.bill_number as reference_number
      FROM customer_ledger cl
      LEFT JOIN bills b ON cl.reference_id = b.id
      WHERE cl.customer_id = ?
      ORDER BY cl.created_at DESC, cl.id DESC
    `;
    const rows = this.queryAll<any>(sql, [customerId]);
    return rows.map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      amount: row.amount, // Direct rupees
      type: row.type,
      referenceId: row.reference_id,
      referenceNumber: row.reference_number,
      notes: row.notes,
      createdAt: this.parseDate(row.created_at),
    }));
  }

  /**
   * Map database row to Customer domain object
   *
   * Converts:
   * - INTEGER paise → number rupees
   * - INTEGER 0/1 → boolean
   * - TEXT ISO 8601 → Date
   */
  private _mapToCustomer(row: any): Customer {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      address: row.address,
      email: row.email,
      balanceDue: row.balance_due, // Direct Rupees
      isActive: row.is_active === 1, // INTEGER → boolean
      createdAt: this.parseDate(row.created_at), // TEXT → Date
      updatedAt: this.parseDate(row.updated_at),
    };
  }
}
