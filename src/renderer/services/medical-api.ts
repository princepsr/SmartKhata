import { ipcClient } from '../utils/ipc';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import type { IndianMedicine, Product } from '@shared/types/ipc';

/**
 * Medical / Pharmacy API Service
 */
export const medicalApi = {
  getSaltSuggestions: async (query: string): Promise<string[]> => {
    const result = await ipcClient.call<string[]>(IPC_CHANNELS.MEDICAL_SALT_SUGGESTIONS, query);
    return result.success ? result.data : [];
  },

  /**
   * Get common Indian medicine suggestions (Brand + Salt)
   */
  getMedicineSuggestions: async (query: string): Promise<IndianMedicine[]> => {
    const result = await ipcClient.call<IndianMedicine[]>(IPC_CHANNELS.MEDICAL_MEDICINE_SUGGESTIONS, query);
    return result.success ? result.data : [];
  },

  /**
   * Get alternative medicines with the same salt
   */
  getAlternatives: async (saltName: string, excludeProductId: number): Promise<Partial<Product>[]> => {
    const result = await ipcClient.call<Partial<Product>[]>(IPC_CHANNELS.MEDICAL_ALTERNATIVES, {
      saltName,
      excludeProductId,
    });
    return result.success ? result.data : [];
  },

  /**
   * Get drug safety warning for a product
   */
  getDrugWarning: async (productId: number): Promise<string | null> => {
    const result = await ipcClient.call<string | null>(
      IPC_CHANNELS.MEDICAL_DRUG_WARNING,
      productId
    );
    return result.success ? result.data : null;
  },
};
