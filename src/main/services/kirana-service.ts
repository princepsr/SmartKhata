import { BaseService } from './base-service';
import { ProductRepository, Product } from '../repositories/product-repository';
import { logger } from '../utils/logger';

/**
 * Kirana / Grocery Specialized Service
 */
export class KiranaService extends BaseService {
  private productRepo: ProductRepository;

  constructor() {
    super();
    this.productRepo = new ProductRepository();
  }

  /**
   * Convert weights between Kg and Gm
   */
  public convertToGm(kg: number): number {
    return Math.round(kg * 1000);
  }

  public convertToKg(gm: number): number {
    return Math.round((gm / 1000) * 1000) / 1000;
  }

  /**
   * Hardware Integration: Weighing Machine (SERIAL)
   *
   * In a real Electron environment, this would use `serialport` package.
   * For the service layer, we provide the logic to parse common scale protocols.
   */
  public parseWeighingScaleData(rawData: string): number {
    // Common protocol: "ST,GS,+  0.250kg"
    // This is a simplified regex for various Indian scales (Eagle, Phoenix, etc.)
    const weightMatch = rawData.match(/([\d.]+)\s*(kg|g)/i);
    if (!weightMatch) {return 0;}

    let value = parseFloat(weightMatch[1]);
    const unit = weightMatch[2].toLowerCase();

    if (unit === 'g') {
      value = this.convertToKg(value);
    }

    return value;
  }

  /**
   * Get "Quick-Pick" items
   * These are typically loose items or high-frequency items without barcodes.
   */
  public getQuickPickItems(): Product[] {
    const products = this.productRepo.findAll(false);
    return products.filter((p) => p.isWeightBased || p.barcode === null || p.barcode === '');
  }
}
