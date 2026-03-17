/**
 * Debit Note IPC Handlers
 * 
 * Handles purchase returns and debit note generation.
 */

import { IPCHandler } from '../ipc-handler';
import { DebitNoteService, RecordReturnInput } from '../../services/debit-note-service';
import { getUserFriendlyMessage } from '../../services/errors/service-errors';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { DebitNote, DebitNoteWithItems } from '@shared/types/ipc';

export function registerDebitNoteHandlers(): void {
  const debitNoteService = new DebitNoteService();

  // ============================================
  // CREATE DEBIT NOTE (Purchase Return)
  // ============================================
  IPCHandler.handle<RecordReturnInput, DebitNote>(
    IPC_CHANNELS.DEBIT_NOTE_CREATE,
    async (input) => {
      const result = await debitNoteService.recordReturn(input);
      if (!result) {
        throw new Error('Failed to create debit note');
      }
      return {
        ...result,
        createdAt: result.createdAt.getTime(),
      };
    },
    { transformError: (err) => getUserFriendlyMessage(err) }
  );

  // ============================================
  // LIST DEBIT NOTES BY SUPPLIER
  // ============================================
  IPCHandler.handle<number, DebitNote[]>(
    IPC_CHANNELS.DEBIT_NOTE_LIST,
    async (supplierId) => {
      const results = await debitNoteService.listBySupplier(supplierId);
      return results.map(dn => ({
        ...dn,
        createdAt: dn.createdAt.getTime()
      }));
    },
    { transformError: (err) => getUserFriendlyMessage(err) }
  );
}
