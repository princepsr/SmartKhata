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
import { Logger } from '../../utils/logger';
import { 
  ValidationError, 
  NotFoundError, 
  DuplicateEntryError,
  InactiveEntityError,
  getUserFriendlyMessage,
  isServiceError
} from '../../services/errors/service-errors';

/**
 * Safe Response Format
 */
interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

/**
 * Register All Product Handlers
 */
export function registerProductHandlers(): void {
  const productService = new ProductService();

  // ============================================
  // LIST ALL PRODUCTS
  // ============================================
  IPCHandler.handle<void, IPCResponse<any[]>>(
    IPC_CHANNELS.PRODUCT_LIST,
    async () => {
      try {
        const products = productService.getAllProducts();
        
        // Convert domain objects to plain objects for IPC
        const plainProducts = products.map(p => ({
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

        return {
          success: true,
          data: plainProducts
        };
      } catch (error) {
        Logger.error('Failed to list products', error);
        return {
          success: false,
          error: getUserFriendlyMessage(error)
        };
      }
    }
  );

  // ============================================
  // GET PRODUCT BY ID
  // ============================================
  IPCHandler.handle<number, IPCResponse<any>>(
    IPC_CHANNELS.PRODUCT_GET,
    async (productId) => {
      try {
        const product = productService.getProduct(productId);

        return {
          success: true,
          data: {
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
          }
        };
      } catch (error) {
        Logger.error('Failed to get product', error);
        
        if (error instanceof NotFoundError) {
          return {
            success: false,
            error: 'Product not found',
            errorCode: 'NOT_FOUND'
          };
        }

        return {
          success: false,
          error: getUserFriendlyMessage(error)
        };
      }
    },
    {
      schema: ProductIdSchema
    }
  );

  // ============================================
  // CREATE PRODUCT
  // ============================================
  IPCHandler.handle<CreateProductRequest, IPCResponse<any>>(
    IPC_CHANNELS.PRODUCT_CREATE,
    async (request) => {
      try {
        const input: AddProductInput = {
          name: request.name,
          sku: request.sku,
          barcode: request.barcode,
          salePrice: request.price,
          purchasePrice: request.cost,
          gstPercent: request.gstPercent,
          stockQty: request.stock,
          lowStockAlert: request.lowStockAlert
        };

        const product = productService.addProduct(input);

        return {
          success: true,
          data: {
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
          }
        };
      } catch (error) {
        Logger.error('Failed to create product', error);
        
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: error.getUserMessage(),
            errorCode: 'VALIDATION_ERROR'
          };
        }

        if (error instanceof DuplicateEntryError) {
          return {
            success: false,
            error: error.getUserMessage(),
            errorCode: 'DUPLICATE_ENTRY'
          };
        }

        return {
          success: false,
          error: getUserFriendlyMessage(error)
        };
      }
    },
    {
      schema: CreateProductSchema
    }
  );

  // ============================================
  // UPDATE PRODUCT
  // ============================================
  IPCHandler.handle<UpdateProductRequest, IPCResponse<any>>(
    IPC_CHANNELS.PRODUCT_UPDATE,
    async (request) => {
      try {
        const updates: UpdateProductData = {
          name: request.data.name,
          sku: request.data.sku,
          barcode: request.data.barcode,
          salePrice: request.data.price,
          purchasePrice: request.data.cost,
          gstPercent: request.data.gstPercent,
          lowStockAlert: request.data.lowStockAlert,
          isActive: request.data.isActive
        };

        const product = productService.updateProduct(request.id, updates);

        return {
          success: true,
          data: {
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
          }
        };
      } catch (error) {
        Logger.error('Failed to update product', error);
        
        if (error instanceof NotFoundError) {
          return {
            success: false,
            error: 'Product not found',
            errorCode: 'NOT_FOUND'
          };
        }

        if (error instanceof ValidationError) {
          return {
            success: false,
            error: error.getUserMessage(),
            errorCode: 'VALIDATION_ERROR'
          };
        }

        if (error instanceof DuplicateEntryError) {
          return {
            success: false,
            error: error.getUserMessage(),
            errorCode: 'DUPLICATE_ENTRY'
          };
        }

        return {
          success: false,
          error: getUserFriendlyMessage(error)
        };
      }
    },
    {
      schema: UpdateProductSchema
    }
  );

  // ============================================
  // SEARCH PRODUCTS
  // ============================================
  IPCHandler.handle<string, IPCResponse<any[]>>(
    IPC_CHANNELS.PRODUCT_SEARCH,
    async (query) => {
      try {
        const products = productService.searchProducts(query);

        const plainProducts = products.map(p => ({
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

        return {
          success: true,
          data: plainProducts
        };
      } catch (error) {
        Logger.error('Failed to search products', error);
        
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: error.getUserMessage(),
            errorCode: 'VALIDATION_ERROR'
          };
        }

        return {
          success: false,
          error: getUserFriendlyMessage(error)
        };
      }
    },
    {
      schema: ProductSearchSchema
    }
  );

  // ============================================
  // GET LOW STOCK PRODUCTS
  // ============================================
  IPCHandler.handle<void, IPCResponse<any[]>>(
    'product:lowStock',
    async () => {
      try {
        const products = productService.getLowStockProducts();

        const plainProducts = products.map(p => ({
          id: p.id,
          name: p.name,
          stockQty: p.stockQty,
          lowStockAlert: p.lowStockAlert,
          salePrice: p.salePrice
        }));

        return {
          success: true,
          data: plainProducts
        };
      } catch (error) {
        Logger.error('Failed to get low stock products', error);
        return {
          success: false,
          error: getUserFriendlyMessage(error)
        };
      }
    }
  );

  // ============================================
  // ADJUST STOCK
  // ============================================
  IPCHandler.handle<{ productId: number; deltaQty: number; reason: 'MANUAL' | 'ADJUSTMENT'; notes?: string }, IPCResponse<void>>(
    'product:adjustStock',
    async ({ productId, deltaQty, reason, notes }) => {
      try {
        productService.adjustStock({ productId, deltaQty, reason, notes });

        return {
          success: true
        };
      } catch (error) {
        Logger.error('Failed to adjust stock', error);
        
        if (error instanceof NotFoundError) {
          return {
            success: false,
            error: 'Product not found',
            errorCode: 'NOT_FOUND'
          };
        }

        if (error instanceof InactiveEntityError) {
          return {
            success: false,
            error: error.getUserMessage(),
            errorCode: 'INACTIVE_ENTITY'
          };
        }

        if (error instanceof ValidationError) {
          return {
            success: false,
            error: error.getUserMessage(),
            errorCode: 'VALIDATION_ERROR'
          };
        }

        return {
          success: false,
          error: getUserFriendlyMessage(error)
        };
      }
    }
  );
}
