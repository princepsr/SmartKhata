/**
 * Credit Note IPC Handlers
 *
 * Handles sales returns and credit note operations.
 */

import { IPCHandler } from '../ipc-handler';
import {
  CreditNoteService,
  CreateCreditNoteServiceInput,
} from '../../services/credit-note-service';
import { getUserFriendlyMessage } from '../../services/errors/service-errors';
import { IPC_CHANNELS } from '@shared/ipc/channels';

export function registerCreditNoteHandlers(): void {
  const creditNoteService = new CreditNoteService();

  // ============================================
  // CREATE CREDIT NOTE
  // ============================================
  IPCHandler.handle<CreateCreditNoteServiceInput, any>(
    IPC_CHANNELS.CREDIT_NOTE_CREATE,
    async (input) => {
      const result = creditNoteService.createCreditNote(input);
      return {
        creditNote: {
          id: result.creditNote.id,
          creditNoteNumber: result.creditNote.creditNoteNumber,
          originalBillId: result.creditNote.originalBillId,
          originalBillNumber: result.creditNote.originalBillNumber,
          reason: result.creditNote.reason,
          refundAmount: result.creditNote.refundAmount,
          taxableAmount: result.creditNote.taxableAmount,
          cgstAmount: result.creditNote.cgstAmount,
          sgstAmount: result.creditNote.sgstAmount,
          igstAmount: result.creditNote.igstAmount,
          gstTotal: result.creditNote.gstTotal,
          notes: result.creditNote.notes,
          createdAt: result.creditNote.createdAt.getTime(),
        },
        items: result.items,
      };
    },
    { transformError: (err) => getUserFriendlyMessage(err) }
  );

  // ============================================
  // LIST CREDIT NOTES
  // ============================================
  IPCHandler.handle<{ startDate: string; endDate: string; page?: number }, any>(
    IPC_CHANNELS.CREDIT_NOTE_LIST,
    async ({ startDate, endDate, page = 1 }) => {
      const result = creditNoteService.listCreditNotes(startDate, endDate, page);
      return {
        data: result.data.map((cn) => ({
          ...cn,
          createdAt: cn.createdAt.getTime(),
        })),
        total: result.total,
      };
    },
    { transformError: (err) => getUserFriendlyMessage(err) }
  );

  // ============================================
  // GET CREDIT NOTE BY ID
  // ============================================
  IPCHandler.handle<number, any>(
    IPC_CHANNELS.CREDIT_NOTE_GET_BY_ID,
    async (id) => {
      const result = creditNoteService.getCreditNoteById(id);
      return {
        creditNote: {
          ...result.creditNote,
          createdAt: result.creditNote.createdAt.getTime(),
        },
        items: result.items,
      };
    },
    { transformError: (err) => getUserFriendlyMessage(err) }
  );

  // ============================================
  // GENERATE CREDIT NOTE NUMBER
  // ============================================
  IPCHandler.handle<void, string>(
    IPC_CHANNELS.CREDIT_NOTE_GENERATE_NUMBER,
    async () => creditNoteService.generateCreditNoteNumber(),
    { transformError: (err) => getUserFriendlyMessage(err) }
  );
}
