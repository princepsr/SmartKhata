import { ipcClient } from '../utils/ipc';
import { IPC_CHANNELS } from '@shared/ipc/channels';

/**
 * Medical / Pharmacy API Service
 */
export const medicalApi = {
  /**
   * Get salt name suggestions from static database
   */
  getSaltSuggestions: async (query: string): Promise<string[]> => {
    const result = await ipcClient.call<string[]>(IPC_CHANNELS.MEDICAL_SALT_SUGGESTIONS, query);
    return result.success ? result.data : [];
  },

  /**
   * Get alternative medicines with the same salt
   */
  getAlternatives: async (saltName: string, excludeProductId: number): Promise<any[]> => {
    const result = await ipcClient.call<any[]>(IPC_CHANNELS.MEDICAL_ALTERNATIVES, {
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
