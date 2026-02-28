import { BaseService } from './base-service';
import { Product } from '../repositories/product-repository';
import { logger } from '../utils/logger';

/**
 * Barcode & Label Service
 */
export class BarcodeService extends BaseService {
  /**
   * Generate a unique barcode for an item if it doesn't have one
   * Format: SKU (if exists) or ID-based padded string
   */
  public generateInternalBarcode(product: Product): string {
    if (product.barcode) return product.barcode;

    // Default internal: SK-ID-RAND
    const idPart = String(product.id).padStart(5, '0');
    const namePart = product.name.substring(0, 3).toUpperCase();
    return `SK${namePart}${idPart}`;
  }

  /**
   * Logic for label printing payload
   * Prepares data for common label sizes (e.g. 50mm x 25mm)
   */
  public prepareLabelPayload(product: Product, price: number, copies: number = 1) {
    return {
      name: product.name,
      barcode: product.barcode || this.generateInternalBarcode(product),
      price: price.toFixed(2),
      currency: 'INR',
      copies,
    };
  }

  /**
   * Mock for Thermal Print
   */
  public async printLabels(payload: any): Promise<boolean> {
    logger.info('Printing barcode labels', payload);
    // Real implementation would interface with print-service.ts using ESC/POS
    return true;
  }
}
