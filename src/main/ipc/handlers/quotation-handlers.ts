import { IPCHandler } from '../ipc-handler';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { QuotationService, CreateQuotationInput } from '../../services/quotation-service';
import { 
  Quotation as QuotationIPC, 
  QuotationWithItems 
} from '@shared/types/ipc';
import { 
  Quotation as QuotationDomain 
} from '../../repositories/quotation-repository';
import { logger } from '../../utils/logger';
import { getUserFriendlyMessage } from '../../services/errors/service-errors';
import { PrintService } from '../../services/print-service';

const quotationService = new QuotationService();

export function registerQuotationHandlers() {
  logger.info('Registering Quotation handlers');

  // Create Quotation
  IPCHandler.handle<CreateQuotationInput, QuotationIPC>(
    IPC_CHANNELS.QUOTATION_CREATE,
    async (input) => {
      const quotation = await quotationService.createQuotation(input);
      return _mapToUI(quotation);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // List Quotations
  IPCHandler.handle<number, QuotationIPC[]>(
    IPC_CHANNELS.QUOTATION_LIST,
    async (page) => {
      const items = await quotationService.listQuotations(page);
      return items.map((q: QuotationDomain) => _mapToUI(q));
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // Get Quotation
  IPCHandler.handle<number, QuotationIPC | null>(
    IPC_CHANNELS.QUOTATION_GET,
    async (id) => {
      const quotation = await quotationService.getQuotationById(id);
      return quotation ? _mapToUI(quotation) : null;
    },
    {
      transformError: (err) => (err instanceof Error ? err.message : String(err)),
    }
  );

  // ============================================
  // GET QUOTATION WITH ITEMS
  // ============================================
  IPCHandler.handle<number, QuotationWithItems>(
    IPC_CHANNELS.QUOTATION_GET_WITH_ITEMS,
    async (id) => {
      const result = await quotationService.getQuotationWithItems(id);
      if (!result) {
        throw new Error('Quotation not found');
      }
      return {
        quotation: _mapToUI(result.quotation),
        items: result.items,
      };
    },
    {
      transformError: (err) => (err instanceof Error ? err.message : String(err)),
    }
  );

  // ============================================
  // UPDATE QUOTATION STATUS
  // ============================================
  IPCHandler.handle<{ id: number; status: QuotationIPC['status'] }, void>(
    IPC_CHANNELS.QUOTATION_UPDATE_STATUS,
    async ({ id, status }) => {
      await quotationService.updateQuotationStatus(id, status);
    },
    {
      transformError: (err) => (err instanceof Error ? err.message : String(err)),
    }
  );

  // ============================================
  // PRINT QUOTATION
  // ============================================
  IPCHandler.handle<{ quotationId: number; printerName?: string }, boolean>(
    IPC_CHANNELS.QUOTATION_PRINT,
    async ({ quotationId, printerName }) => {
      const printService = PrintService.getInstance();
      return await printService.printQuotation(quotationId, printerName);
    },
    {
      transformError: (err) => (err instanceof Error ? err.message : String(err)),
    }
  );
}

/**
 * Map Quotation Domain to IPC Object
 */
function _mapToUI(q: QuotationDomain): QuotationIPC {
  return {
    ...q,
    createdAt: q.createdAt.getTime(),
  };
}
