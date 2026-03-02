/**
 * Utility IPC Handlers
 *
 * General utility operations like barcode generation.
 */

import { IPC_CHANNELS } from '@shared/ipc/channels';
import { IPCHandler } from '../ipc-handler';
import { ProductService } from '../../services/product-service';
import { PrintService } from '../../services/print-service';
import { getUserFriendlyMessage } from '../../services/errors/service-errors';

/**
 * Register All Utility Handlers
 */
export function registerUtilityHandlers(): void {
  const productService = new ProductService();
  const printService = PrintService.getInstance();

  // ============================================
  // GENERATE BARCODE (Real Printing)
  // ============================================
  IPCHandler.handle<
    { productId: number; count: number; options?: { showBrand?: boolean; showPrice?: boolean } },
    boolean
  >(
    IPC_CHANNELS.UTILITY_GENERATE_BARCODE,
    async ({ productId, count, options }) => {
      // 1. Fetch real product data
      const product = productService.getProduct(productId);

      // 2. Trigger high-fidelity printing
      return await printService.printBarcodes(product, count, options);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );
}
