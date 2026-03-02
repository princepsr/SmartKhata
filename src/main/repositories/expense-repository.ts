import { BaseRepository } from './base-repository';
import { logger } from '../utils/logger';

/**
 * Expense Domain Object
 */
export interface Expense {
  id: number;
  category: string;
  amount: number;
  date: string; // YYYY-MM-DD
  paymentMode: string;
  description: string | null;
  createdAt: Date;
}

/**
 * Create Expense Input
 */
export interface CreateExpenseInput {
  category: string;
  amount: number;
  date: string;
  paymentMode: string;
  description?: string;
}

/**
 * Expense Repository
 */
export class ExpenseRepository extends BaseRepository {
  public create(data: CreateExpenseInput): Expense {
    const sql = `
      INSERT INTO expenses (category, amount, date, payment_mode, notes)
      VALUES (?, ?, ?, ?, ?)
    `;
    const result = this.execute(sql, [
      data.category,
      data.amount,
      data.date,
      data.paymentMode,
      data.description || null,
    ]);

    logger.info('Expense recorded', {
      id: result.lastInsertRowid,
      category: data.category,
      amount: data.amount,
    });
    return this.findById(Number(result.lastInsertRowid))!;
  }

  public findById(id: number): Expense | null {
    const row = this.queryOne<any>('SELECT * FROM expenses WHERE id = ?', [id]);
    return row ? this._mapToExpense(row) : null;
  }

  public list(startDate: string, endDate: string): Expense[] {
    const end = endDate.length <= 10 ? `${endDate} 23:59:59` : endDate;
    const sql = `
      SELECT * FROM expenses 
      WHERE date BETWEEN ? AND ? 
      ORDER BY date DESC, id DESC
    `;
    return this.queryAll<any>(sql, [startDate, end]).map((row) => this._mapToExpense(row));
  }

  public getSummaryByCategory(
    startDate: string,
    endDate: string
  ): { category: string; total: number }[] {
    const sql = `
      SELECT category, SUM(amount) as total 
      FROM expenses 
      WHERE date BETWEEN ? AND ? 
      GROUP BY category 
      ORDER BY total DESC
    `;
    return this.queryAll<any>(sql, [startDate, endDate]);
  }

  public getTotalExpenses(startDate: string, endDate: string): number {
    const end = endDate.length <= 10 ? `${endDate} 23:59:59` : endDate;
    const sql = `SELECT SUM(amount) as total FROM expenses WHERE date BETWEEN ? AND ?`;
    const row = this.queryOne<{ total: number }>(sql, [startDate, end]);
    return row?.total || 0;
  }

  public getExpensesByPeriod(
    startDate: string,
    endDate: string,
    dateFormat: string
  ): { periodId: string; total: number }[] {
    const end = endDate.length <= 10 ? `${endDate} 23:59:59` : endDate;
    const sql = `
      SELECT strftime('${dateFormat}', date) as periodId, COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE date BETWEEN ? AND ?
      GROUP BY periodId
    `;
    return this.queryAll<any>(sql, [startDate, end]);
  }

  private _mapToExpense(row: any): Expense {
    return {
      id: row.id,
      category: row.category,
      amount: row.amount,
      date: row.date,
      paymentMode: row.payment_mode,
      description: row.notes,
      createdAt: this.parseDate(row.created_at),
    };
  }
}
