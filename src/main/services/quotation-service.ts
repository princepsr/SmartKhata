import { BaseService } from './base-service';
import {
  QuotationRepository,
  Quotation,
  QuotationItem,
} from '../repositories/quotation-repository';
import { ProductRepository } from '../repositories/product-repository';
import { CustomerRepository } from '../repositories/customer-repository';
import { SettingsService } from './settings-service';
import { calculateBillPreview, calculateDiscountAmount } from '@shared/utils/billing-math';
import { ValidationError, NotFoundError } from './errors/service-errors';

export interface CreateQuotationInput {
  customerId?: number;
  items: {
    productId: number;
    quantity: number;
    discountValue?: number;
    discountType?: 'amount' | 'percent';
  }[];
  billDiscountValue?: number;
  billDiscountType?: 'amount' | 'percent';
  notes?: string;
  validUntil?: string;
}

export class QuotationService extends BaseService {
  private quotationRepo: QuotationRepository;
  private productRepo: ProductRepository;
  private customerRepo: CustomerRepository;

  constructor() {
    super();
    this.quotationRepo = new QuotationRepository();
    this.productRepo = new ProductRepository();
    this.customerRepo = new CustomerRepository();
  }

  /**
   * Create a new quotation
   */
  public async createQuotation(input: CreateQuotationInput): Promise<Quotation> {
    if (!input.items || input.items.length === 0) {
      throw new ValidationError('Quotation must have at least one item', 'items');
    }

    // 1. Resolve Customer Name Snapshot
    let customerNameSnapshot = 'Cash Customer';
    if (input.customerId) {
      const customer = this.customerRepo.findById(input.customerId);
      if (!customer) {
        throw new NotFoundError('Customer', input.customerId);
      }
      customerNameSnapshot = customer.name;
    }

    // 2. Resolve Product Details and Calculate Totals using billing-math for consistency
    const productIds = input.items.map((i) => i.productId);
    const products = this.productRepo.findByIds(productIds);
    const productMap = new Map(products.map((p) => [p.id, p]));

    const settings = SettingsService.getInstance().getConfig();

    // Map to the format expected by calculateBillPreview
    const calculationItems = input.items.map((item) => {
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

    // Calculate absolute bill discount amount
    const totalNetPayableBeforeBillDiscount = calculationItems.reduce((sum, item) => {
      const itemGross = item.quantity * item.product.salePrice;
      const itemDisc = calculateDiscountAmount(
        item.discountType || 'amount',
        (item.discountValue || 0).toString(),
        itemGross
      );
      return sum + (itemGross - itemDisc);
    }, 0);

    const billDiscountAmount = calculateDiscountAmount(
      input.billDiscountType || 'percent',
      (input.billDiscountValue || 0).toString(),
      totalNetPayableBeforeBillDiscount
    );

    const calculation = calculateBillPreview(
      calculationItems,
      billDiscountAmount,
      settings.gstEnabled,
      settings.gstExclusiveMode,
      settings.supplyType
    );

    const quotationNumber = await this.generateQuotationNumber();

    const quotationData: Omit<Quotation, 'id' | 'createdAt' | 'status'> = {
      quotationNumber,
      customerId: input.customerId || null,
      customerNameSnapshot,
      totalTaxable: calculation.subtotal,
      gstTotal: calculation.gstTotal,
      grandTotal: calculation.grandTotal,
      expiresAt: input.validUntil || null,
      notes: input.notes || null,
      billDiscountValue: input.billDiscountValue || 0,
      billDiscountType: input.billDiscountType || 'percent',
    };

    const quotationItems = calculation.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountValue: item.discountValue,
      discountType: item.discountType,
      gstPercent: item.gstPercent,
      lineTotal: item.lineTotal,
      uom: item.uom,
    }));

    return this.quotationRepo.create({ ...quotationData, status: 'PENDING' }, quotationItems);
  }

  /**
   * Get quotation by ID with its items
   */
  public async getQuotationWithItems(
    id: number
  ): Promise<{ quotation: Quotation; items: QuotationItem[] } | null> {
    return this.quotationRepo.findByIdWithItems(id);
  }

  /**
   * Update quotation status
   */
  public async updateQuotationStatus(id: number, status: Quotation['status']): Promise<void> {
    this.quotationRepo.updateStatus(id, status);
  }

  /**
   * List quotations
   */
  public async listQuotations(page: number = 1): Promise<Quotation[]> {
    return this.quotationRepo.list(page);
  }

  /**
   * Get quotation by ID
   */
  public async getQuotationById(id: number): Promise<Quotation | null> {
    return this.quotationRepo.findById(id);
  }

  /**
   * Generate next quotation number
   */
  public async generateQuotationNumber(): Promise<string> {
    const today = new Date();
    const dateStr =
      today.getFullYear() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');
    const prefix = `QTN-${dateStr}-`;

    // Use robust count from repository
    const count = this.quotationRepo.countToday(prefix);
    return `${prefix}${String(count + 1).padStart(3, '0')}`;
  }
}
