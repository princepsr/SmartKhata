import { BaseService } from './base-service';
import { DebitNoteRepository } from '../repositories/debit-note-repository';
import { ProductRepository } from '../repositories/product-repository';
import { SupplierRepository } from '../repositories/supplier-repository';
import { PurchaseRepository } from '../repositories/purchase-repository';
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
    return this.dnRepo.transaction(() => {
      let finalSupplierId = input.supplierId;
      const originalPurchaseItems: Record<number, number> = {};

      if (input.purchaseId) {
        const purchaseRepo = new PurchaseRepository();
        const purchaseResult = purchaseRepo.findByIdWithItems(input.purchaseId);
        
        if (!purchaseResult) {
          throw new Error('Associated purchase not found.');
        }

        // 1. Resolve Supplier if missing
        if (!finalSupplierId || finalSupplierId === 0) {
          const supplier = this.supplierRepo.findByName(purchaseResult.purchase.supplierName);
          if (supplier) {
            finalSupplierId = supplier.id;
          } else {
            throw new Error(`Supplier '${purchaseResult.purchase.supplierName}' not found in database. Cannot issue debit note.`);
          }
        }

        // 2. Prepare quantity validation map
        purchaseResult.items.forEach(item => {
          if (item.productId) {
            originalPurchaseItems[item.productId] = (originalPurchaseItems[item.productId] || 0) + (item.quantity - item.returnedQuantity);
          }
        });
      }

      if (!finalSupplierId || finalSupplierId === 0) {
        throw new Error('Supplier ID is required to issue a debit note.');
      }

      let totalTaxable = 0;
      let totalGst = 0;

      const items = input.items.map((item) => {
        // 3. Validate Quantity
        if (input.purchaseId && item.productId) {
          const available = originalPurchaseItems[item.productId] || 0;
          if (item.quantity > available) {
            throw new Error(`Cannot return ${item.quantity} units of '${item.productName}'. Only ${available} units are available for return from this purchase.`);
          }
        }

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
          supplierId: finalSupplierId,
          totalTaxable,
          gstTotal: totalGst,
          grandTotal,
          reason: input.reason || null,
        },
        items
      );

      // 4. Record stock reduction
      items.forEach((item) => {
        if (item.productId) {
          this.productRepo.updateStock(item.productId, -item.quantity);
          logger.info('Stock reduced for return', { productId: item.productId, qty: item.quantity });
        }
      });

      // 5. Update Supplier Balance & Ledger
      this.supplierRepo.updateBalance(finalSupplierId, -grandTotal);
      this.supplierRepo.addLedgerEntry({
        supplierId: finalSupplierId,
        amount: grandTotal,
        type: 'PAYMENT_OUT', // Purchase return reduces balance we owe
        referenceId: id,
        notes: `Debit Note: ${debitNoteNumber}${input.purchaseId ? ` (Ref Purchase #${input.purchaseId})` : ''}`,
      });

      logger.info('Purchase return recorded', { debitNoteNumber, grandTotal });
      return this.dnRepo.findById(id);
    });
  }

  public listBySupplier(supplierId: number) {
    return this.dnRepo.findBySupplier(supplierId);
  }
}
