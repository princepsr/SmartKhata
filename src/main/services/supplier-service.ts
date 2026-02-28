import { BaseService } from './base-service';
import {
  SupplierRepository,
  CreateSupplierInput,
  UpdateSupplierInput,
} from '../repositories/supplier-repository';
import { ValidationError, NotFoundError, DuplicateEntryError } from './errors/service-errors';

export class SupplierService extends BaseService {
  private supplierRepo: SupplierRepository;

  constructor() {
    super();
    this.supplierRepo = new SupplierRepository();
  }

  public createSupplier(input: CreateSupplierInput): any {
    this._validateSupplierInput(input as any);

    if (input.phone) {
      const existing = this.supplierRepo.findByPhone(input.phone);
      if (existing) {
        throw new DuplicateEntryError('Supplier', 'phone', input.phone);
      }
    }

    return this.supplierRepo.create(input);
  }

  public updateSupplier(id: number, input: UpdateSupplierInput): any {
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

  public getSupplier(id: number): any {
    const supplier = this.supplierRepo.findById(id);
    if (!supplier) throw new NotFoundError('Supplier', id);
    return supplier;
  }

  public getAllSuppliers(includeInactive = false): any[] {
    return this.supplierRepo.findAll(includeInactive);
  }

  public searchSuppliers(query: string): any[] {
    if (!query.trim()) return [];
    return this.supplierRepo.search(query);
  }

  public updateBalance(id: number, deltaAmount: number): void {
    const supplier = this.supplierRepo.findById(id);
    if (!supplier) throw new NotFoundError('Supplier', id);
    if (!supplier.isActive) throw new Error('Supplier is inactive');

    this.supplierRepo.updateBalance(id, deltaAmount);
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
