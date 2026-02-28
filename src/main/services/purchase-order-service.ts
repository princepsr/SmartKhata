import { PurchaseOrderRepository } from '../repositories/purchase-order-repository';
import { PurchaseOrder } from '@shared/types/ipc';

export class PurchaseOrderService {
  private repository: PurchaseOrderRepository;

  constructor() {
    this.repository = new PurchaseOrderRepository();
  }

  async list(options?: any): Promise<{ data: PurchaseOrder[]; total: number }> {
    try {
      const data = await this.repository.listPurchaseOrders();
      return { data, total: data.length };
    } catch (error) {
      console.error('Error in PurchaseOrderService.list:', error);
      throw error;
    }
  }

  async getById(id: number): Promise<PurchaseOrder> {
    try {
      const po = await this.repository.getPurchaseOrderById(id);
      if (!po) throw new Error(`Purchase order ${id} not found`);
      return po;
    } catch (error) {
      console.error('Error in PurchaseOrderService.getById:', error);
      throw error;
    }
  }

  async create(data: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    try {
      return await this.repository.createPurchaseOrder(data);
    } catch (error) {
      console.error('Error in PurchaseOrderService.create:', error);
      throw error;
    }
  }

  async updateStatus(id: number, status: 'PENDING' | 'RECEIVED' | 'CANCELLED'): Promise<boolean> {
    try {
      return await this.repository.updatePurchaseOrderStatus(id, status);
    } catch (error) {
      console.error('Error in PurchaseOrderService.updateStatus:', error);
      throw error;
    }
  }
}
