import { IPCHandler } from '../ipc-handler';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { ExpenseService } from '../../services/expense-service';
import { CreateExpenseInput, Expense } from '../../repositories/expense-repository';
import { logger } from '../../utils/logger';
import { getUserFriendlyMessage } from '../../services/errors/service-errors';

const expenseService = new ExpenseService();

/**
 * Register Expense IPC Handlers
 */
export function registerExpenseHandlers() {
  logger.info('Registering Expense handlers');

  // Create Expense
  IPCHandler.handle<CreateExpenseInput, Expense>(
    IPC_CHANNELS.EXPENSE_CREATE,
    async (input) => {
      return await expenseService.createExpense(input);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // List Expenses
  IPCHandler.handle<{ startDate?: string; endDate?: string } | undefined, Expense[]>(
    IPC_CHANNELS.EXPENSE_LIST,
    async (params) => {
      return await expenseService.listExpenses(params?.startDate, params?.endDate);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // Get Expense
  IPCHandler.handle<number, Expense | null>(
    IPC_CHANNELS.EXPENSE_GET,
    async (id) => {
      return await expenseService.getExpenseById(id);
    },
    {
      transformError: (err) => (err instanceof Error ? err.message : String(err)),
    }
  );
}
