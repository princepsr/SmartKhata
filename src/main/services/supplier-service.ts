import { BaseService } from './base-service';
import {
  SupplierRepository,
  CreateSupplierInput,
  UpdateSupplierInput,
  Supplier,
  SupplierLedgerEntry,
} from '../repositories/supplier-repository';
import { ValidationError, NotFoundError, DuplicateEntryError } from './errors/service-errors';

export interface SupplierHistory {
  supplier: {
    id: number;
    name: string;
    balanceDue: number;
  };
  ledger: SupplierLedgerEntry[];
}

export class SupplierService extends BaseService {
  private supplierRepo: SupplierRepository;

  constructor() {
    super();
    this.supplierRepo = new SupplierRepository();
  }

  public createSupplier(input: CreateSupplierInput): Supplier {
    this._validateSupplierInput(input);

    if (input.phone) {
      const existing = this.supplierRepo.findByPhone(input.phone);
      if (existing) {
        throw new DuplicateEntryError('Supplier', 'phone', input.phone);
      }
    }

    return this.supplierRepo.create(input);
  }

  public updateSupplier(id: number, input: UpdateSupplierInput): Supplier {
    const existing = this.supplierRepo.findById(id);
    if (!existing) {
      throw new NotFoundError('Supplier', id);
    }

    if (input.phone && input.phone !== existing.phone) {
      const existingByPhone = this.supplierRepo.findByPhone(input.phone);
      if (existingByPhone && existingByPhone.id !== id) {
        throw new DuplicateEntryError('Supplier', 'phone', input.phone);
      }
    }

    if (input.name !== undefined) {
      if (!input.name.trim()) {
        throw new ValidationError('Supplier name cannot be empty', 'name');
      }
    }

    return this.supplierRepo.update(id, input);
  }

  public getSupplier(id: number): Supplier {
    const supplier = this.supplierRepo.findById(id);
    if (!supplier) {
      throw new NotFoundError('Supplier', id);
    }
    return supplier;
  }

  public getAllSuppliers(includeInactive = false): Supplier[] {
    return this.supplierRepo.findAll(includeInactive);
  }

  public searchSuppliers(query: string): Supplier[] {
    if (!query.trim()) {
      return [];
    }
    return this.supplierRepo.search(query);
  }

  public getSupplierHistory(id: number): SupplierHistory {
    const supplier = this.supplierRepo.findById(id);
    if (!supplier) {
      throw new NotFoundError('Supplier', id);
    }

    const ledger = this.supplierRepo.getLedgerBySupplierId(id);
    return {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        balanceDue: supplier.balanceDue,
      },
      ledger,
    };
  }

  public updateBalance(id: number, deltaAmount: number): void {
    const supplier = this.supplierRepo.findById(id);
    if (!supplier) {
      throw new NotFoundError('Supplier', id);
    }
    if (!supplier.isActive) {
      throw new Error('Supplier is inactive');
    }

    this.supplierRepo.updateBalance(id, deltaAmount);
  }

  public addManualPayment(supplierId: number, amount: number, notes?: string): void {
    const supplier = this.supplierRepo.findById(supplierId);
    if (!supplier) {
      throw new NotFoundError('Supplier', supplierId);
    }

    const type = amount > 0 ? 'PAYMENT_IN' : 'PAYMENT_OUT';

    this.supplierRepo.addManualPayment({
      supplierId,
      amount,
      type,
      notes: notes || (amount > 0 ? 'Payment Received (Refund)' : 'Payment Given'),
    });
  }

  private _validateSupplierInput(input: CreateSupplierInput): void {
    if (!input.name || !input.name.trim()) {
      throw new ValidationError('Supplier name is required', 'name');
    }
    if (input.phone) {
      const cleanPhone = input.phone.replace(/[\s-()]/g, '');
      if (!/^\d{10}$/.test(cleanPhone)) {
        throw new ValidationError('Phone number must be 10 digits', 'phone');
      }
    }
  }
}
