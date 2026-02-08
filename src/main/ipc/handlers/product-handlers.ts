/**
 * Product IPC Handlers (Service-Based)
 * 
 * Wires product operations from UI to ProductService.
 * No SQL logic, no repository calls - only service orchestration.
 */

import { IPC_CHANNELS } from '@shared/ipc/channels';
import { IPCHandler } from '../ipc-handler';
import { 
  CreateProductSchema, 
  UpdateProductSchema, 
  ProductIdSchema,
  ProductSearchSchema,
  type CreateProductRequest,
  type UpdateProductRequest 
} from '@shared/validation/schemas';
import { ProductService, AddProductInput, UpdateProductData } from '../../services/product-service';
import { 
  getUserFriendlyMessage
} from '../../services/errors/service-errors';

/**
 * Register All Product Handlers
 */
export function registerProductHandlers(): void {
  const productService = new ProductService();

  // ============================================
  // LIST ALL PRODUCTS
  // ============================================
  IPCHandler.handle<void, any[]>(
    IPC_CHANNELS.PRODUCT_LIST,
    async () => {
      const products = productService.getAllProducts();
      
      // Convert domain objects to plain objects for IPC
      return products.map(p => ({
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
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString()
      }));
    },
    {
        transformError: (err) => getUserFriendlyMessage(err)
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
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString()
      };
    },
    {
      schema: ProductIdSchema,
      transformError: (err) => getUserFriendlyMessage(err)
    }
  );

  // ============================================
  // CREATE PRODUCT
  // ============================================
  IPCHandler.handle<CreateProductRequest, any>(
    IPC_CHANNELS.PRODUCT_CREATE,
    async (request) => {
      const input: AddProductInput = {
        name: request.name,
        sku: request.sku,
        barcode: request.barcode,
        salePrice: request.salePrice,
        purchasePrice: request.cost,
        gstPercent: request.gstPercent,
        stockQty: request.stockQty,
        lowStockAlert: request.lowStockAlert
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
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString()
      };
    },
    {
      schema: CreateProductSchema,
      transformError: (err) => getUserFriendlyMessage(err)
    }
  );

  // ============================================
  // UPDATE PRODUCT
  // ============================================
  IPCHandler.handle<UpdateProductRequest, any>(
    IPC_CHANNELS.PRODUCT_UPDATE,
    async (request) => {
      const updates: UpdateProductData = {
        name: request.data.name,
        sku: request.data.sku,
        barcode: request.data.barcode,
        salePrice: request.data.salePrice,
        purchasePrice: request.data.cost,
        gstPercent: request.data.gstPercent,
        lowStockAlert: request.data.lowStockAlert,
        isActive: request.data.isActive
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
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString()
      };
    },
    {
      schema: UpdateProductSchema,
      transformError: (err) => getUserFriendlyMessage(err)
    }
  );

  // ============================================
  // SEARCH PRODUCTS
  // ============================================
  IPCHandler.handle<string, any[]>(
    IPC_CHANNELS.PRODUCT_SEARCH,
    async (query) => {
      const products = productService.searchProducts(query);

      return products.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        salePrice: p.salePrice,
        purchasePrice: p.purchasePrice,
        gstPercent: p.gstPercent,
        stockQty: p.stockQty,
        lowStockAlert: p.lowStockAlert,
        isActive: p.isActive
      }));
    },
    {
      schema: ProductSearchSchema,
      transformError: (err) => getUserFriendlyMessage(err)
    }
  );

  // ============================================
  // GET LOW STOCK PRODUCTS
  // ============================================
  IPCHandler.handle<void, any[]>(
    'product:lowStock',
    async () => {
      const products = productService.getLowStockProducts();

      return products.map(p => ({
        id: p.id,
        name: p.name,
        stockQty: p.stockQty,
        lowStockAlert: p.lowStockAlert,
        salePrice: p.salePrice
      }));
    },
    {
        transformError: (err) => getUserFriendlyMessage(err)
    }
  );

  // ============================================
  // ADJUST STOCK
  // ============================================
  IPCHandler.handle<{ productId: number; deltaQty: number; reason: 'MANUAL' | 'ADJUSTMENT'; notes?: string }, void>(
    'product:adjustStock',
    async ({ productId, deltaQty, reason, notes }) => {
      productService.adjustStock({ productId, deltaQty, reason, notes });
    },
    {
        transformError: (err) => getUserFriendlyMessage(err)
    }
  );
}
