import { databaseManager } from '../database';
import {
  BillRepository,
  CreateBillInput,
  CreateBillItemInput,
} from '../repositories/bill-repository';
import { ProductRepository, Product } from '../repositories/product-repository';
import { CustomerRepository } from '../repositories/customer-repository';
import { SettingsRepository } from '../repositories/settings-repository';
import { InventoryRepository } from '../repositories/inventory-repository';
import { FinalizeBillInput } from '@shared/types/ipc';
import { calculateBillPreview } from '@shared/utils/billing-math';
import { NotFoundError } from './errors/service-errors';

export class BillingTransactionService {
  private billRepo: BillRepository;
  private productRepo: ProductRepository;
  private customerRepo: CustomerRepository;
  private settingsRepo: SettingsRepository;
  private inventoryRepo: InventoryRepository;

  constructor() {
    this.billRepo = new BillRepository();
    this.productRepo = new ProductRepository();
    this.customerRepo = new CustomerRepository();
    this.settingsRepo = new SettingsRepository();
    this.inventoryRepo = new InventoryRepository();
  }

  async createSale(input: FinalizeBillInput): Promise<{ id: number; billNumber: string }> {
    // 1. Fetch Config and Products (Pre-transaction, Async allowed here)
    const config = await this.settingsRepo.getConfig();
    const productIds = input.items.map((i) => i.productId);
    const products = await this.productRepo.findByIds(productIds);
    const productMap = new Map<number, Product>(products.map((p) => [p.id, p]));

    // 2. Generate Bill Number (Pre-transaction)
    const billNumber = this.billRepo.generateBillNumber();

    return databaseManager.transaction(() => {
      // 3. Prepare items for calculateBillPreview
      const previewItems = input.items.map((item) => {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new NotFoundError('Product', item.productId);
        }
        return {
          product,
          quantity: item.quantity,
          discountValue: item.discountValue,
          discountType: item.discountType,
        };
      });

      // 4. Centralized Calculation Logic
      const calculation = calculateBillPreview(
        previewItems,
        input.discountAmount || 0,
        config.gstEnabled,
        config.gstExclusiveMode,
        config.supplyType || 'intrastate'
      );

      // 5. Map to Repository Inputs
      const calculatedItems: CreateBillItemInput[] = calculation.items.map((ci) => {
        const product = productMap.get(ci.productId);
        if (!product) {
          throw new NotFoundError('Product', ci.productId);
        }
        return {
          productId: ci.productId,
          productNameSnapshot: ci.productName,
          hsnSnapshot: product.hsnCode,
          quantity: ci.quantity,
          unitPrice: ci.unitPrice,
          gstPercent: ci.gstPercent,
          purchasePrice: product.purchasePrice ?? undefined,
          lineSubtotal: ci.lineSubtotal,
          lineGst: ci.lineGst,
          lineCgst: ci.lineCgst,
          lineSgst: ci.lineSgst,
          lineIgst: ci.lineIgst,
          lineTotal: ci.lineTotal,
        };
      });

      // 6. Create Bill Record
      const billInput: CreateBillInput = {
        billNumber: billNumber,
        customerId: input.customerId,
        subtotal: calculation.subtotal,
        gstTotal: calculation.gstTotal,
        cgstAmount: calculation.cgstTotal,
        sgstAmount: calculation.sgstTotal,
        igstAmount: calculation.igstTotal,
        discountAmount: calculation.discountAmount,
        grandTotal: calculation.grandTotal,
        paymentMode: input.paymentMode,
        paymentReceived: input.paymentReceived || 0,
      };

      // B2B Snapshots
      if (input.customerId) {
        const customer = this.customerRepo.findById(input.customerId);
        if (customer) {
          billInput.customerGstinSnapshot = customer.gstin;
          billInput.billingAddressSnapshot = customer.billingAddress;
          billInput.shippingAddressSnapshot = customer.shippingAddress;
        }
      }

      const billId = this.billRepo.createBillWithItems(billInput, calculatedItems);

      // 7. Update Stock & History
      const today = new Date().toISOString().split('T')[0];
      for (const item of input.items) {
        const product = productMap.get(item.productId);
        if (!product) {
          continue;
        }

        // A. Update Stock Level (Skip if billing only mode is enabled)
        if (!config.billingOnly && product.trackInventory) {
          this.productRepo.updateStock(item.productId, -item.quantity);
        }

        // B. Always Update Last Sale Date
        this.productRepo.updateLastSaleDate(item.productId, today);

        // C. Always Log Inventory Change (History)
        this.inventoryRepo.logChange({
          productId: item.productId,
          changeQty: -item.quantity,
          reason: 'SALE',
          referenceId: billId.bill.id,
          notes: `Sold via Bill ${billNumber}`,
        });
      }

      // 8. Update Customer Ledger & Balance
      if (input.customerId) {
        const paymentReceived = input.paymentReceived || 0;
        const grandTotal = calculation.grandTotal;

        // Record Sale entry
        this.customerRepo.addLedgerEntry({
          customerId: input.customerId,
          amount: grandTotal,
          type: 'SALE',
          referenceId: billId.bill.id,
        });

        // Record Payment entry (if any)
        if (paymentReceived > 0) {
          this.customerRepo.addLedgerEntry({
            customerId: input.customerId,
            amount: paymentReceived,
            type: 'PAYMENT_IN',
            referenceId: billId.bill.id,
          });
        }

        // Update Balance (if mismatch)
        if (Math.abs(paymentReceived - grandTotal) > 0.01) {
          const balanceDelta = Math.round((grandTotal - paymentReceived) * 100) / 100;
          this.customerRepo.updateBalance(input.customerId, balanceDelta);
        }
      }

      return { id: billId.bill.id, billNumber: billInput.billNumber };
    });
  }
}
