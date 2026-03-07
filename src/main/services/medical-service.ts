import { BaseService } from './base-service';
import { ProductRepository, Product } from '../repositories/product-repository';
import { logger } from '../utils/logger';
import { INDIAN_SALTS } from '../../shared/data/indian-salts';
import { INDIAN_MEDICINES, IndianMedicine } from '../../shared/data/indian-medicines';

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
   * Get suggestions for salt names from both static database and user added products
   */
  public getSaltSuggestions(query: string): string[] {
    if (!query || query.length < 2) {
      return [];
    }
    const lowerQuery = query.toLowerCase();

    // 1. Get from static database
    const staticSuggestions = INDIAN_SALTS.filter((salt: string) =>
      salt.toLowerCase().includes(lowerQuery)
    );

    // 2. Get from user's actual inventory (dynamic)
    const customSuggestions = this.productRepo.getUniqueSaltNames(query);

    // 3. Merge and deduplicate (case-insensitive deduplication)
    const combined = [...staticSuggestions, ...customSuggestions];
    const uniqueMap = new Map<string, string>();

    combined.forEach((salt) => {
      const lower = salt.toLowerCase();
      if (!uniqueMap.has(lower)) {
        uniqueMap.set(lower, salt);
      }
    });

    const deduplicated = Array.from(uniqueMap.values());

    // 4. Return top 12 results (sorted by relevance - exact start first, then includes)
    return deduplicated
      .sort((a, b) => {
        const aStart = a.toLowerCase().startsWith(lowerQuery);
        const bStart = b.toLowerCase().startsWith(lowerQuery);
        if (aStart && !bStart) {
          return -1;
        }
        if (!aStart && bStart) {
          return 1;
        }
        return a.localeCompare(b);
      })
      .slice(0, 12);
  }

  /**
   * Get suggestions for common Indian medicines (Brand + Salt)
   */
  public getMedicineSuggestions(query: string): IndianMedicine[] {
    if (!query || query.length < 2) {
      return [];
    }
    const lowerQuery = query.toLowerCase();
    return INDIAN_MEDICINES.filter(
      (med) =>
        med.name.toLowerCase().includes(lowerQuery) ||
        med.saltName.toLowerCase().includes(lowerQuery)
    ).slice(0, 10);
  }

  /**
   * Extract core salt names by stripping dosages and generic terms
   */
  public extractCoreSalts(saltString: string): string[] {
    if (!saltString) {
      return [];
    }

    // Split by common separators: +, and, & or comma
    const parts = saltString.split(/\s*(?:\+|and|&|,)\s*/i);

    return parts
      .map((part) => {
        // Remove common dosage patterns: numbers followed by mg, ml, gm, mcg, IU, % etc.
        let cleaned = part.replace(/\d+(?:\.\d+)?\s*(?:mg|ml|g|gm|mcg|iu|%|w\/v|v\/v)\b/gi, '');

        // Remove pharmacopoeia and formulation terms
        cleaned = cleaned.replace(
          /\b(?:IP|USP|BP|EP|Tablet|Capsule|Syrup|Suspension|Ointment|Cream|Injection|Drop|Drops|Dry|Sustained Release|Extended Release|SR|ER|CR|PR|TR)\b/gi,
          ''
        );

        // Remove any leftover parentheses
        cleaned = cleaned.replace(/[()]/g, '');

        return cleaned.trim();
      })
      .filter((part) => part.length > 2); // Keep only meaningful parts
  }

  /**
   * Find alternative medicines with the same salt
   */
  public getAlternativesBySalt(saltName: string, excludeProductId: number): Product[] {
    if (!saltName) {
      return [];
    }

    // Extract core ingredients for fuzzy matching
    const coreSalts = this.extractCoreSalts(saltName);

    let alternatives: Product[] = [];
    if (coreSalts.length > 0) {
      // Fuzzy match (dosage-agnostic)
      alternatives = this.productRepo.searchByFuzzySalts(coreSalts);
    } else {
      // Fallback to exact match if extraction failed to produce meaningful terms
      alternatives = this.productRepo.searchBySalt(saltName);
    }

    return alternatives.filter((p) => p.id !== excludeProductId);
  }
}
