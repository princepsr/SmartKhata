/**
 * Product IPC Handlers (Service-Based)
 *
 * Wires product operations from UI to ProductService.
 * No SQL logic, no repository calls - only service orchestration.
 */

import { IPC_CHANNELS } from '@shared/ipc/channels';
import { IPCHandler } from '../ipc-handler';
import {
  UpdateProductSchema,
  ProductIdSchema,
  ProductSearchSchema,
  ProductImportSchema,
  ProductAdjustStockSchema,
  ProductToggleStatusSchema,
  CreateProductSchema,
  type CreateProductRequest,
  type UpdateProductRequest,
} from '@shared/validation/schemas';
import { ProductService, AddProductInput, UpdateProductData } from '../../services/product-service';
import { LicenseService } from '../../services/license-service';
import { getUserFriendlyMessage } from '../../services/errors/service-errors';

/**
 * Register All Product Handlers
 */
export function registerProductHandlers(): void {
  const productService = new ProductService();

  // ============================================
  // LIST ALL PRODUCTS
  // ============================================
  IPCHandler.handle<
    { includeInactive?: boolean; page?: number; pageSize?: number },
    { items: any[]; totalCount: number; hasMore: boolean; page: number }
  >(
    IPC_CHANNELS.PRODUCT_LIST,
    async (params) => {
      const includeInactive = params?.includeInactive ?? false;
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize ?? 100;

      const result = productService.getAllProducts(includeInactive, page, pageSize);
      const totalCount = productService.getProductCount(includeInactive);
      const hasMore = page * pageSize < totalCount;

      // Convert domain objects to plain objects for IPC
      const items = result.items.map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        salePrice: p.salePrice,
        purchasePrice: p.purchasePrice,
        gstPercent: p.gstPercent,
        stockQty: p.stockQty,
        lowStockAlert: p.lowStockAlert,
        isActive: p.isActive,
        isGstInclusive: p.isGstInclusive,
        trackInventory: p.trackInventory,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }));

      return {
        items,
        totalCount,
        hasMore,
        page: result.page,
      };
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // GET PRODUCT BY ID
  // ============================================
  IPCHandler.handle<number, any>(
    IPC_CHANNELS.PRODUCT_GET,
    async (productId) => {
      const product = productService.getProduct(productId);

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        salePrice: product.salePrice,
        purchasePrice: product.purchasePrice,
        gstPercent: product.gstPercent,
        stockQty: product.stockQty,
        lowStockAlert: product.lowStockAlert,
        isActive: product.isActive,
        isGstInclusive: product.isGstInclusive,
        trackInventory: product.trackInventory,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      };
    },
    {
      schema: ProductIdSchema,
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // CREATE PRODUCT
  // ============================================
  IPCHandler.handle<CreateProductRequest, any>(
    IPC_CHANNELS.PRODUCT_CREATE,
    async (request) => {
      // Polite Locking
      if (new LicenseService().getLicenseStatus().isLocked) {
        throw new Error(
          'Trial or License has expired. Please activate to continue adding products.'
        );
      }
      const input: AddProductInput = {
        name: request.name,
        sku: request.sku,
        barcode: request.barcode,
        salePrice: request.salePrice,
        purchasePrice: request.cost,
        gstPercent: request.gstPercent,
        stockQty: request.stockQty,
        lowStockAlert: request.lowStockAlert,
        trackInventory: request.trackInventory,
        isGstInclusive: request.isGstInclusive,
        isActive: request.isActive,
      };

      const product = productService.addProduct(input);

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        salePrice: product.salePrice,
        purchasePrice: product.purchasePrice,
        gstPercent: product.gstPercent,
        stockQty: product.stockQty,
        lowStockAlert: product.lowStockAlert,
        isActive: product.isActive,
        trackInventory: product.trackInventory,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      };
    },
    {
      schema: CreateProductSchema,
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // BULK IMPORT PRODUCTS
  // ============================================
  IPCHandler.handle<CreateProductRequest[], any[]>(
    IPC_CHANNELS.PRODUCT_IMPORT,
    async (requests) => {
      // Polite Locking
      if (new LicenseService().getLicenseStatus().isLocked) {
        throw new Error(
          'Trial or License has expired. Please activate to continue importing products.'
        );
      }
      const inputs: AddProductInput[] = requests.map((req) => ({
        name: req.name,
        sku: req.sku,
        barcode: req.barcode,
        salePrice: req.salePrice,
        purchasePrice: req.cost,
        gstPercent: req.gstPercent,
        stockQty: req.stockQty,
        lowStockAlert: req.lowStockAlert,
        trackInventory: req.trackInventory,
        isGstInclusive: req.isGstInclusive,
      }));

      const products = productService.importProducts(inputs);

      return products.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        salePrice: product.salePrice,
        purchasePrice: product.purchasePrice,
        gstPercent: product.gstPercent,
        stockQty: product.stockQty,
        lowStockAlert: product.lowStockAlert,
        isActive: product.isActive,
        isGstInclusive: product.isGstInclusive,
        trackInventory: product.trackInventory,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      }));
    },
    {
      schema: ProductImportSchema,
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // UPDATE PRODUCT
  // ============================================
  IPCHandler.handle<UpdateProductRequest, any>(
    IPC_CHANNELS.PRODUCT_UPDATE,
    async (request) => {
      // Polite Locking
      if (new LicenseService().getLicenseStatus().isLocked) {
        throw new Error(
          'Trial or License has expired. Please activate to continue editing products.'
        );
      }
      const updates: UpdateProductData = {
        name: request.data.name,
        sku: request.data.sku,
        barcode: request.data.barcode,
        salePrice: request.data.salePrice,
        purchasePrice: request.data.cost,
        gstPercent: request.data.gstPercent,
        lowStockAlert: request.data.lowStockAlert,
        isActive: request.data.isActive,
        isGstInclusive: request.data.isGstInclusive,
        trackInventory: request.data.trackInventory,
      };

      const product = productService.updateProduct(request.id, updates);

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        salePrice: product.salePrice,
        purchasePrice: product.purchasePrice,
        gstPercent: product.gstPercent,
        stockQty: product.stockQty,
        lowStockAlert: product.lowStockAlert,
        isActive: product.isActive,
        trackInventory: product.trackInventory,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      };
    },
    {
      schema: UpdateProductSchema,
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // SEARCH PRODUCTS
  // ============================================
  IPCHandler.handle<
    { query: string; includeInactive?: boolean; page?: number; pageSize?: number },
    { items: any[]; totalCount: number; hasMore: boolean }
  >(
    IPC_CHANNELS.PRODUCT_SEARCH,
    async ({ query, includeInactive, page, pageSize }) => {
      const result = productService.searchProducts(query, includeInactive, page, pageSize);

      return {
        items: result.items.map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          salePrice: p.salePrice,
          purchasePrice: p.purchasePrice,
          gstPercent: p.gstPercent,
          stockQty: p.stockQty,
          lowStockAlert: p.lowStockAlert,
          isActive: p.isActive,
          isGstInclusive: p.isGstInclusive,
          trackInventory: p.trackInventory,
        })),
        totalCount: result.totalCount,
        hasMore: result.hasMore,
        page: result.page,
      };
    },
    {
      schema: ProductSearchSchema,
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // GET LOW STOCK PRODUCTS
  // ============================================
  IPCHandler.handle<void, any[]>(
    IPC_CHANNELS.PRODUCT_LOW_STOCK,
    async () => {
      const products = productService.getLowStockProducts();

      return products.map((p) => ({
        id: p.id,
        name: p.name,
        stockQty: p.stockQty,
        lowStockAlert: p.lowStockAlert,
        salePrice: p.salePrice,
      }));
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // ADJUST STOCK
  // ============================================
  IPCHandler.handle<
    { productId: number; deltaQty: number; reason: 'MANUAL' | 'ADJUSTMENT'; notes?: string },
    void
  >(
    IPC_CHANNELS.PRODUCT_ADJUST_STOCK,
    async ({ productId, deltaQty, reason, notes }) => {
      // Polite Locking
      if (new LicenseService().getLicenseStatus().isLocked) {
        throw new Error('Trial or License has expired. Please activate to adjust stock.');
      }
      productService.adjustStock({ productId, deltaQty, reason, notes });
    },
    {
      schema: ProductAdjustStockSchema,
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // GET PRODUCT HISTORY
  // ============================================
  IPCHandler.handle<number, any[]>(
    IPC_CHANNELS.PRODUCT_HISTORY,
    async (productId) => {
      const logs = productService.getStockHistory(productId);

      return logs.map((log) => ({
        id: log.id,
        date: log.createdAt.toISOString(),
        changeQty: log.changeQty,
        reason: log.reason,
        reference: log.billNumber // Use bill number if available
          ? log.billNumber
          : log.referenceId
            ? `#${log.referenceId}`
            : '-',
        notes: log.notes || '-',
      }));
    },
    {
      schema: ProductIdSchema,
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );
  // ============================================
  // DEACTIVATE PRODUCT (SOFT DELETE)
  // ============================================
  IPCHandler.handle<number, void>(
    IPC_CHANNELS.PRODUCT_DELETE,
    async (productId) => {
      // Polite Locking
      if (new LicenseService().getLicenseStatus().isLocked) {
        throw new Error('Trial or License has expired. Please activate to manage products.');
      }
      productService.deactivateProduct(productId);
    },
    {
      schema: ProductIdSchema,
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // TOGGLE PRODUCT STATUS
  // ============================================
  IPCHandler.handle<{ id: number; isActive: boolean }, void>(
    IPC_CHANNELS.PRODUCT_TOGGLE_STATUS,
    async ({ id, isActive }) => {
      // Polite Locking
      if (new LicenseService().getLicenseStatus().isLocked) {
        throw new Error('Trial or License has expired. Please activate to manage products.');
      }
      productService.updateProduct(id, { isActive });
    },
    {
      schema: ProductToggleStatusSchema,
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );
}
