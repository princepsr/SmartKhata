import { ExpenseRepository, CreateExpenseInput, Expense } from '../repositories/expense-repository';
import { BaseService } from './base-service';
import { logger } from '../utils/logger';

/**
 * Expense Service
 *
 * Handles business logic for shop expenditures.
 */
export class ExpenseService extends BaseService {
  private expenseRepository: ExpenseRepository;

  constructor() {
    super();
    this.expenseRepository = new ExpenseRepository();
  }

  /**
   * Record a new expense
   */
  public async createExpense(input: CreateExpenseInput): Promise<Expense> {
    try {
      return this.expenseRepository.create(input);
    } catch (error) {
      logger.error('Failed to create expense', { error, input });
      throw error;
    }
  }

  /**
   * List expenses for a date range
   * Defaults to current month if dates not provided
   */
  public async listExpenses(startDate?: string, endDate?: string): Promise<Expense[]> {
    try {
      const today = new Date();
      const start =
        startDate || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const end = endDate || today.toISOString().split('T')[0];

      return this.expenseRepository.list(start, end);
    } catch (error) {
      logger.error('Failed to list expenses', { error, startDate, endDate });
      throw error;
    }
  }

  /**
   * Get expense by ID
   */
  public async getExpenseById(id: number): Promise<Expense | null> {
    try {
      return this.expenseRepository.findById(id);
    } catch (error) {
      logger.error('Failed to get expense', { error, id });
      throw error;
    }
  }

  /**
   * Get total expenses for a range
   */
  public async getTotalExpenses(startDate: string, endDate: string): Promise<number> {
    try {
      return this.expenseRepository.getTotalExpenses(startDate, endDate);
    } catch (error) {
      logger.error('Failed to get total expenses', { error, startDate, endDate });
      throw error;
    }
  }
}
