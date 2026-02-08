/**
 * Product IPC Handlers
 * 
 * Wires product operations from UI to ProductRepository.
 * No SQL logic here - only orchestration.
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
import { ProductRepository, CreateProductInput, UpdateProductInput } from '../../repositories/product-repository';
import { Logger } from '../../utils/logger';
import { DatabaseError } from '../../repositories/base-repository';

/**
 * Safe Response Format
 */
interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Register All Product Handlers
 */
export function registerProductHandlers(): void {
  const productRepo = new ProductRepository();

  // ============================================
  // LIST ALL PRODUCTS
  // ============================================
  IPCHandler.handle<void, IPCResponse<any[]>>(
    IPC_CHANNELS.PRODUCT_LIST,
    async () => {
      try {
        const products = productRepo.findAll();
        
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
          error: error instanceof Error ? error.message : 'Failed to list products'
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
        const product = productRepo.findById(productId);
        
        if (!product) {
          return {
            success: false,
            error: 'Product not found'
          };
        }

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
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get product'
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
        const input: CreateProductInput = {
          name: request.name,
          sku: request.sku,
          barcode: request.barcode,
          salePrice: request.price,
          purchasePrice: request.cost,
          gstPercent: request.gstPercent || 18,
          stockQty: request.stock || 0,
          lowStockAlert: request.lowStockAlert
        };

        const product = productRepo.create(input);

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
        
        if (error instanceof DatabaseError) {
          if (error.isCode('UNIQUE_VIOLATION')) {
            return {
              success: false,
              error: 'Product with this SKU or barcode already exists'
            };
          }
        }

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create product'
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
        const input: UpdateProductInput = {
          name: request.data.name,
          sku: request.data.sku,
          barcode: request.data.barcode,
          salePrice: request.data.price,
          purchasePrice: request.data.cost,
          gstPercent: request.data.gstPercent,
          stockQty: request.data.stock,
          lowStockAlert: request.data.lowStockAlert,
          isActive: request.data.isActive
        };

        const product = productRepo.update(request.id, input);

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
        
        if (error instanceof DatabaseError) {
          if (error.isCode('NOT_FOUND')) {
            return {
              success: false,
              error: 'Product not found'
            };
          }
        }

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update product'
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
        const products = productRepo.searchByName(query);

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
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search products'
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
        const products = productRepo.getLowStock();

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
          error: error instanceof Error ? error.message : 'Failed to get low stock products'
        };
      }
    }
  );
}
