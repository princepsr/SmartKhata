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
  paymentStatus?: 'PENDING' | 'PAID' | 'PARTIAL';
  amountPaid?: number;
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
    const shopGstin = config.gstNumber || '';
    const shopStateCode = shopGstin.substring(0, 2);
    const supplierGstin = input.supplierGstin || '';
    const supplierStateCode = supplierGstin.substring(0, 2);

    let isIntrastate = true;
    if (
      shopStateCode &&
      supplierStateCode &&
      /^\d+$/.test(shopStateCode) &&
      /^\d+$/.test(supplierStateCode)
    ) {
      // If both state codes exist and are numeric, compare them
      isIntrastate = shopStateCode === supplierStateCode;
    } else {
      // Fallback to manual supply type setting if GSTINs are missing or invalid
      isIntrastate = config.supplyType === 'intrastate';
    }

    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let grandTotal = 0;

    const productRepo = new ProductRepository();

    // Pre-process items to auto-create missing products
    const processedItems = input.items.map((item) => {
      let productId = item.productId;
      if (!productId) {
        // Try to find by exact name first
        const existing = productRepo
          .findAll()
          .find((p) => p.name.toLowerCase() === item.productName.toLowerCase());
        if (existing) {
          productId = existing.id;
        } else {
          try {
            const newProduct = productRepo.create({
              name: item.productName,
              salePrice: item.unitPrice, // Default sale price to purchase price
              purchasePrice: item.unitPrice,
              gstPercent: item.gstPercent,
              hsnCode: item.hsnCode,
              stockQty: 0, // Will be incremented later
              trackInventory: true,
            });
            productId = newProduct.id;
            logger.info('Auto-created missing product during purchase', {
              productId,
              name: item.productName,
            });
          } catch (err) {
            logger.error('Failed to auto-create product', {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
      return { ...item, productId };
    });

    const repoItems: CreatePurchaseItemInput[] = processedItems.map((item) => {
      if (item.quantity <= 0) {
        throw new ValidationError('Quantity must be positive', 'quantity');
      }
      if (item.unitPrice < 0) {
        throw new ValidationError('Unit price cannot be negative', 'unitPrice');
      }

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
        paymentStatus: input.paymentStatus,
        amountPaid: input.amountPaid,
        supplierId: input.supplierId,
      },
      repoItems
    );

    // Automation: Ledger and Balance
    if (input.supplierId) {
      const supplierRepo = new SupplierRepository();
      try {
        // 1. Record the Purchase in Ledger
        this.purchaseRepo.recordLedgerEntry({
          supplierId: input.supplierId,
          amount: grandTotal,
          type: 'PURCHASE',
          referenceId: purchase.purchase.id,
          notes: input.notes,
        });

        // 2. Record the Payment in Ledger if any
        const paidAmount = input.amountPaid || 0;
        if (paidAmount > 0) {
          this.purchaseRepo.recordLedgerEntry({
            supplierId: input.supplierId,
            amount: paidAmount,
            type: 'PAYMENT_OUT',
            referenceId: purchase.purchase.id,
            notes: `Payment for ${purchaseNumber}`,
          });
        }

        // 3. Update Balance (Net increase = Grand Total - Paid)
        const balanceDelta = grandTotal - paidAmount;
        supplierRepo.updateBalance(input.supplierId, balanceDelta);

        logger.info('Updated supplier ledger and balance', {
          supplierId: input.supplierId,
          total: grandTotal,
          paid: paidAmount,
          delta: balanceDelta,
        });
      } catch (err) {
        logger.error('Failed to update supplier ledger/balance', {
          supplierId: input.supplierId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Automation: Update Inventory stock
    if (input.updateInventory !== false) {
      processedItems.forEach((item) => {
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
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}
