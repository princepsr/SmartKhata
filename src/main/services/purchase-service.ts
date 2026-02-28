/**
 * Purchase Service (ITC Tracking)
 *
 * Records supplier purchase invoices and computes the Input Tax Credit (ITC)
 * available for the shop. Used for GST filing (GSTR-3B).
 */

import { BaseService } from './base-service';
import {
  PurchaseRepository,
  PurchaseWithItems,
  CreatePurchaseItemInput,
  ITCSummary,
} from '../repositories/purchase-repository';
import { ProductRepository } from '../repositories/product-repository';
import { SupplierRepository } from '../repositories/supplier-repository';
import { SettingsService } from './settings-service';
import { ValidationError } from './errors/service-errors';
import { logger } from '../utils/logger';

export interface PurchaseItemServiceInput {
  productId?: number;
  productName: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  gstPercent: number; // e.g. 12 for 12%
}

export interface RecordPurchaseInput {
  supplierName: string;
  supplierGstin?: string;
  invoiceNumber?: string;
  invoiceDate: string; // YYYY-MM-DD
  items: PurchaseItemServiceInput[];
  notes?: string;
  updateInventory?: boolean; // Default true in Pro
  supplierId?: number; // Optional: link to supplier table
}

export interface PurchaseNetGstLiability {
  outputGst: number; // GST collected from sales
  inputItc: number; // ITC available from purchases
  netPayable: number; // outputGst - inputItc (amount owed to govt)
}

export class PurchaseService extends BaseService {
  private purchaseRepo: PurchaseRepository;

  constructor() {
    super();
    this.purchaseRepo = new PurchaseRepository();
  }

  /**
   * Record a supplier purchase invoice (ATOMIC)
   *
   * Automatically calculates CGST/SGST or IGST based on supply type setting.
   */
  public recordPurchase(input: RecordPurchaseInput): PurchaseWithItems {
    if (!input.supplierName || !input.supplierName.trim()) {
      throw new ValidationError('Supplier name is required', 'supplierName');
    }
    if (!input.invoiceDate) {
      throw new ValidationError('Invoice date is required', 'invoiceDate');
    }
    if (!input.items || input.items.length === 0) {
      throw new ValidationError('At least one item is required', 'items');
    }

    const config = SettingsService.getInstance().getConfig();
    const isIntrastate = config.supplyType !== 'interstate';

    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let grandTotal = 0;

    const repoItems: CreatePurchaseItemInput[] = input.items.map((item) => {
      if (item.quantity <= 0) throw new ValidationError('Quantity must be positive', 'quantity');
      if (item.unitPrice < 0)
        throw new ValidationError('Unit price cannot be negative', 'unitPrice');

      const lineTaxable = Math.round(item.unitPrice * item.quantity * 100) / 100;
      const lineGst = Math.round(((lineTaxable * item.gstPercent) / 100) * 100) / 100;
      const lineTotal = Math.round((lineTaxable + lineGst) * 100) / 100;

      let lineCgst = 0;
      let lineSgst = 0;
      let lineIgst = 0;

      if (isIntrastate && lineGst > 0) {
        lineCgst = Math.round((lineGst / 2) * 100) / 100;
        lineSgst = Math.round((lineGst - lineCgst) * 100) / 100;
      } else if (!isIntrastate && lineGst > 0) {
        lineIgst = lineGst;
      }

      totalTaxable = Math.round((totalTaxable + lineTaxable) * 100) / 100;
      totalCgst = Math.round((totalCgst + lineCgst) * 100) / 100;
      totalSgst = Math.round((totalSgst + lineSgst) * 100) / 100;
      totalIgst = Math.round((totalIgst + lineIgst) * 100) / 100;
      grandTotal = Math.round((grandTotal + lineTotal) * 100) / 100;

      return {
        productId: item.productId,
        productName: item.productName,
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
    const purchaseNumber = this.generatePurchaseNumber();

    logger.info('Recording purchase', {
      purchaseNumber,
      supplierName: input.supplierName,
      grandTotal,
      gstTotal,
    });

    const purchase = this.purchaseRepo.createPurchaseWithItems(
      {
        purchaseNumber,
        supplierName: input.supplierName.trim(),
        supplierGstin: input.supplierGstin?.trim(),
        invoiceNumber: input.invoiceNumber?.trim(),
        invoiceDate: input.invoiceDate,
        totalTaxable,
        cgstAmount: totalCgst,
        sgstAmount: totalSgst,
        igstAmount: totalIgst,
        gstTotal,
        grandTotal,
        notes: input.notes,
      },
      repoItems
    );

    // Automation: Update Inventory stock
    if (input.updateInventory !== false) {
      const productRepo = new ProductRepository();
      input.items.forEach((item) => {
        if (item.productId) {
          try {
            productRepo.updateStock(item.productId, item.quantity);
            logger.info('Auto-updated stock from purchase', {
              productId: item.productId,
              qtyAdded: item.quantity,
            });
          } catch (err) {
            logger.error('Failed to update stock for product', {
              productId: item.productId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      });
    }

    // Automation: Update Supplier Balance
    if (input.supplierId) {
      const supplierRepo = new SupplierRepository();
      try {
        supplierRepo.updateBalance(input.supplierId, grandTotal);
        logger.info('Updated supplier balance from purchase', {
          supplierId: input.supplierId,
          amountAdded: grandTotal,
        });
      } catch (err) {
        logger.error('Failed to update supplier balance', {
          supplierId: input.supplierId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return purchase;
  }

  /**
   * Get ITC summary for a period
   */
  public getITCSummary(startDate: string, endDate: string): ITCSummary {
    return this.purchaseRepo.getITCSummary(startDate, endDate);
  }

  /**
   * List purchases for a date range
   */
  public listPurchases(startDate: string, endDate: string, page: number = 1) {
    return this.purchaseRepo.list(startDate, endDate, page);
  }

  /**
   * Get purchase by ID
   */
  public getPurchaseById(id: number): PurchaseWithItems | null {
    return this.purchaseRepo.findByIdWithItems(id);
  }

  /**
   * Calculate net GST liability for a period
   * Net = GST Collected (Output) - ITC Available (Input)
   */
  public getNetGstLiability(
    startDate: string,
    endDate: string,
    outputGst: number
  ): PurchaseNetGstLiability {
    const itc = this.purchaseRepo.getITCSummary(startDate, endDate);
    const netPayable = Math.max(0, Math.round((outputGst - itc.totalItc) * 100) / 100);
    return {
      outputGst,
      inputItc: itc.totalItc,
      netPayable,
    };
  }

  /**
   * Generate sequential purchase number: PUR-YYYYMMDD-NNNN
   */
  public generatePurchaseNumber(): string {
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const prefix = `PUR-${datePart}-`;
    const last = this.purchaseRepo.findLastPurchaseNumberByPrefix(prefix);
    let seq = 1;
    if (last) {
      const parts = last.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}
