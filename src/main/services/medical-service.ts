import { BaseService } from './base-service';
import { ProductRepository, Product } from '../repositories/product-repository';
import { logger } from '../utils/logger';
import { INDIAN_SALTS } from '../../shared/data/indian-salts';

/**
 * Medical / Pharmacy Specialized Service
 */
export class MedicalService extends BaseService {
  private productRepo: ProductRepository;

  constructor() {
    super();
    this.productRepo = new ProductRepository();
  }

  /**
   * Get products expiring within N days
   */
  public getExpiringProducts(daysAhead: number = 60): Product[] {
    const products = this.productRepo.findAll(false);
    const now = new Date();
    const limitDate = new Date();
    limitDate.setDate(now.getDate() + daysAhead);

    return products.filter((p) => {
      if (!p.expiryDate) {
        return false;
      }
      const expiry = new Date(p.expiryDate);
      return expiry > now && expiry <= limitDate;
    });
  }

  /**
   * Get already expired products
   */
  public getExpiredProducts(): Product[] {
    const products = this.productRepo.findAll(false);
    const now = new Date();

    return products.filter((p) => {
      if (!p.expiryDate) {
        return false;
      }
      const expiry = new Date(p.expiryDate);
      return expiry <= now;
    });
  }

  /**
   * Calculate fractional quantities for sales (e.g., selling 5 tablets from a strip of 10)
   * In the DB, quantity is usually stored as its base unit (Tablets/Pcs).
   *
   * @param stripSize - Number of units per strip
   * @param stripsSold - Number of full strips
   * @param unitsSold - Additional loose units
   * @returns Total base units to deduct
   */
  public calculateTotalUnits(stripSize: number, stripsSold: number, unitsSold: number): number {
    return stripsSold * stripSize + unitsSold;
  }

  /**
   * Convert base units back to Strip + Units for display
   */
  public formatQuantity(totalUnits: number, stripSize: number): string {
    if (stripSize <= 1) {
      return `${totalUnits} Pcs`;
    }

    const strips = Math.floor(totalUnits / stripSize);
    const units = totalUnits % stripSize;

    if (strips > 0 && units > 0) {
      return `${strips} Strip, ${units} Tablet`;
    }
    if (strips > 0) {
      return `${strips} Strip`;
    }
    return `${units} Tablet`;
  }

  /**
   * Search specifically by generic salt name
   */
  public searchBySalt(query: string): Product[] {
    logger.info('Performing generic salt search', { query });
    return this.productRepo.searchBySalt(query);
  }

  /**
   * Check if drug requires mandatory warning (Schedule H/Narcotic)
   */
  public getDrugWarning(product: Product): string | null {
    if (!product.drugCategory) {
      return null;
    }

    const category = product.drugCategory.toUpperCase();
    if (category.includes('SCHEDULE H1') || category.includes('H1')) {
      return '⚠️ Schedule H1 Drug: Mandatory to maintain register and retain original prescription copy.';
    }
    if (category.includes('SCHEDULE H') || category.includes('H')) {
      return '⚠️ Schedule H Drug: Warning: To be sold by retail on the prescription of a Registered Medical Practitioner only.';
    }
    if (category.includes('NARCOTIC') || category.includes('X')) {
      return '🚫 Narcotic / Schedule X: Strict compliance required. Do not sell without valid special prescription.';
    }
    return null;
  }

  /**
   * Get formatted salt + drug category for UI badges
   */
  public getProductBadges(product: Product): string[] {
    const badges: string[] = [];
    if (product.saltName) {
      badges.push(product.saltName);
    }
    if (product.drugCategory) {
      badges.push(product.drugCategory);
    }
    return badges;
  }

  /**
   * Get suggestions for salt names from the static Indian salts database
   */
  public getSaltSuggestions(query: string): string[] {
    if (!query || query.length < 2) {
      return [];
    }
    const lowerQuery = query.toLowerCase();
    return INDIAN_SALTS.filter((salt: string) => salt.toLowerCase().includes(lowerQuery)).slice(
      0,
      10
    );
  }

  /**
   * Find alternative medicines with the same salt
   */
  public getAlternativesBySalt(saltName: string, excludeProductId: number): Product[] {
    if (!saltName) {
      return [];
    }
    // Search products with EXACTLY the same salt or similar
    const alternatives = this.productRepo.searchBySalt(saltName);
    return alternatives.filter((p) => p.id !== excludeProductId);
  }
}
