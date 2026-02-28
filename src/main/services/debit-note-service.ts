import { BaseService } from './base-service';
import { DebitNoteRepository } from '../repositories/debit-note-repository';
import { ProductRepository } from '../repositories/product-repository';
import { SupplierRepository } from '../repositories/supplier-repository';
import { logger } from '../utils/logger';

export interface RecordReturnInput {
  purchaseId?: number;
  supplierId: number;
  items: {
    productId: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    gstPercent: number;
  }[];
  reason?: string;
}

export class DebitNoteService extends BaseService {
  private dnRepo: DebitNoteRepository;
  private productRepo: ProductRepository;
  private supplierRepo: SupplierRepository;

  constructor() {
    super();
    this.dnRepo = new DebitNoteRepository();
    this.productRepo = new ProductRepository();
    this.supplierRepo = new SupplierRepository();
  }

  public recordReturn(input: RecordReturnInput) {
    let totalTaxable = 0;
    let totalGst = 0;

    const items = input.items.map((item) => {
      const lineTaxable = item.unitPrice * item.quantity;
      const lineGst = (lineTaxable * item.gstPercent) / 100;
      const lineTotal = lineTaxable + lineGst;

      totalTaxable += lineTaxable;
      totalGst += lineGst;

      return {
        ...item,
        lineTotal,
      };
    });

    const grandTotal = totalTaxable + totalGst;
    const debitNoteNumber = this.dnRepo.generateNumber();

    const id = this.dnRepo.createWithItems(
      {
        debitNoteNumber,
        purchaseId: input.purchaseId || null,
        supplierId: input.supplierId,
        totalTaxable,
        gstTotal: totalGst,
        grandTotal,
        reason: input.reason || null,
      },
      items
    );

    // Automation: Deduct stock
    items.forEach((item) => {
      if (item.productId) {
        this.productRepo.updateStock(item.productId, -item.quantity);
        logger.info('Stock reduced for return', { productId: item.productId, qty: item.quantity });
      }
    });

    // Automation: Update Supplier Balance (Reverse UDHAAR)
    this.supplierRepo.updateBalance(input.supplierId, -grandTotal);

    logger.info('Purchase return recorded', { debitNoteNumber, grandTotal });
    return this.dnRepo.findById(id);
  }
}
