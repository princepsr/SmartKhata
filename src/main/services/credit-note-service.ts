/**
 * Credit Note Service
 *
 * Handles the creation of credit notes (sales returns) with proper
 * GST reversal. A credit note reverses all or part of a sale's GST.
 */

import { BaseService } from './base-service';
import {
  CreditNoteRepository,
  CreditNoteWithItems,
  CreateCreditNoteItemInput,
} from '../repositories/credit-note-repository';
import { BillRepository } from '../repositories/bill-repository';
import { ProductRepository } from '../repositories/product-repository';
import { SettingsService } from './settings-service';
import { NotFoundError, ValidationError } from './errors/service-errors';
import { logger } from '../utils/logger';

export interface ReturnItemInput {
  productId: number;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  hsnCode?: string;
}

export interface CreateCreditNoteServiceInput {
  originalBillId: number;
  items: ReturnItemInput[];
  reason: 'DEFECTIVE' | 'EXCESS' | 'WRONG_ITEM' | 'OTHER';
  notes?: string;
}

export class CreditNoteService extends BaseService {
  private creditNoteRepo: CreditNoteRepository;
  private billRepo: BillRepository;
  private productRepo: ProductRepository;

  constructor() {
    super();
    this.creditNoteRepo = new CreditNoteRepository();
    this.billRepo = new BillRepository();
    this.productRepo = new ProductRepository();
  }

  /**
   * Create a credit note for a full or partial return
   */
  public createCreditNote(input: CreateCreditNoteServiceInput): CreditNoteWithItems {
    // 1. Validate the original bill exists
    const originalBill = this.billRepo.findByIdWithItems(input.originalBillId);
    if (!originalBill) {
      throw new NotFoundError('Bill', input.originalBillId);
    }

    if (input.items.length === 0) {
      throw new ValidationError('At least one item must be returned', 'items');
    }

    const config = SettingsService.getInstance().getConfig();
    const isIntrastate = config.supplyType !== 'interstate';

    // 2. Calculate totals for returned items
    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalRefund = 0;

    const cnItems: CreateCreditNoteItemInput[] = input.items.map((item) => {
      const lineTotal = Math.round(item.unitPrice * item.quantity * 100) / 100;
      let lineTaxable: number;
      let lineCgst = 0;
      let lineSgst = 0;
      let lineIgst = 0;

      if (item.gstPercent > 0 && config.gstEnabled) {
        // Reverse-calculate taxable from GST-inclusive line total
        lineTaxable = Math.round((lineTotal / (1 + item.gstPercent / 100)) * 100) / 100;
        const lineGst = Math.round((lineTotal - lineTaxable) * 100) / 100;

        if (isIntrastate) {
          lineCgst = Math.round((lineGst / 2) * 100) / 100;
          lineSgst = Math.round((lineGst - lineCgst) * 100) / 100;
        } else {
          lineIgst = lineGst;
        }
      } else {
        lineTaxable = lineTotal;
      }

      totalTaxable = Math.round((totalTaxable + lineTaxable) * 100) / 100;
      totalCgst = Math.round((totalCgst + lineCgst) * 100) / 100;
      totalSgst = Math.round((totalSgst + lineSgst) * 100) / 100;
      totalIgst = Math.round((totalIgst + lineIgst) * 100) / 100;
      totalRefund = Math.round((totalRefund + lineTotal) * 100) / 100;

      return {
        productId: item.productId,
        productNameSnapshot: (() => {
          const p = this.productRepo.findById(item.productId);
          return p ? p.name : `Product #${item.productId}`;
        })(),
        hsnCode: item.hsnCode,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstPercent: item.gstPercent,
        lineTaxable,
        lineCgst,
        lineSgst,
        lineIgst,
        lineTotal,
      };
    });

    const gstTotal = Math.round((totalCgst + totalSgst + totalIgst) * 100) / 100;

    // 3. Generate credit note number
    const creditNoteNumber = this.generateCreditNoteNumber();

    logger.info('Creating credit note', {
      creditNoteNumber,
      originalBillId: input.originalBillId,
      refundAmount: totalRefund,
      gstReversed: gstTotal,
    });

    // 4. Persist
    return this.creditNoteRepo.createCreditNoteWithItems(
      {
        creditNoteNumber,
        originalBillId: input.originalBillId,
        originalBillNumber: originalBill.bill.billNumber,
        customerId: originalBill.bill.customerId ?? undefined,
        reason: input.reason,
        refundAmount: totalRefund,
        taxableAmount: totalTaxable,
        cgstAmount: totalCgst,
        sgstAmount: totalSgst,
        igstAmount: totalIgst,
        gstTotal,
        notes: input.notes,
      },
      cnItems
    );
  }

  /**
   * List credit notes for a date range
   */
  public listCreditNotes(startDate: string, endDate: string, page: number = 1) {
    return this.creditNoteRepo.list(startDate, endDate, page);
  }

  /**
   * Get credit note by ID
   */
  public getCreditNoteById(id: number): CreditNoteWithItems {
    const result = this.creditNoteRepo.findByIdWithItems(id);
    if (!result) {
      throw new NotFoundError('Credit Note', id);
    }
    return result;
  }

  /**
   * Generate a sequential credit note number: CN-YYYYMMDD-NNNN
   */
  public generateCreditNoteNumber(): string {
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const prefix = `CN-${datePart}-`;

    const last = this.creditNoteRepo.findLastCreditNoteNumberByPrefix(prefix);
    let seq = 1;
    if (last) {
      const parts = last.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {seq = lastSeq + 1;}
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}
