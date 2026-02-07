/**
 * Product IPC Handlers
 * 
 * Implements product management logic with Zod schema validation.
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
import type { Product } from '@shared/types/ipc';

/**
 * Mock Database (will be replaced with real database)
 */
const mockProducts: Product[] = [
  { id: 1, name: 'Sample Product 1', price: 100, stock: 50 },
  { id: 2, name: 'Sample Product 2', price: 200, stock: 30 },
];

let nextProductId = 3;

/**
 * Register All Product Handlers
 */
export function registerProductHandlers(): void {
  // LIST
  IPCHandler.handle<void, Product[]>(
    IPC_CHANNELS.PRODUCT_LIST,
    async () => {
      // Simulate database query
      await delay(100);
      return mockProducts;
    }
  );

  // GET
  IPCHandler.handle<number, Product>(
    IPC_CHANNELS.PRODUCT_GET,
    async (productId) => {
      await delay(50);
      
      const product = mockProducts.find(p => p.id === productId);
      
      if (!product) {
        throw new Error('Product not found');
      }
      
      return product;
    },
    {
      schema: ProductIdSchema
    }
  );

  // CREATE
  IPCHandler.handle<CreateProductRequest, Product>(
    IPC_CHANNELS.PRODUCT_CREATE,
    async (request) => {
      await delay(150);
      
      const newProduct: Product = {
        id: nextProductId++,
        name: request.name,
        price: request.price,
        stock: request.stock,
        barcode: request.barcode,
      };
      
      mockProducts.push(newProduct);
      
      return newProduct;
    },
    {
      schema: CreateProductSchema
    }
  );

  // UPDATE
  IPCHandler.handle<UpdateProductRequest, Product>(
    IPC_CHANNELS.PRODUCT_UPDATE,
    async (request) => {
      await delay(100);
      
      const product = mockProducts.find(p => p.id === request.id);
      
      if (!product) {
        throw new Error('Product not found');
      }
      
      // Update product
      Object.assign(product, request.data);
      
      return product;
    },
    {
      schema: UpdateProductSchema
    }
  );

  // SEARCH
  IPCHandler.handle<string, Product[]>(
    IPC_CHANNELS.PRODUCT_SEARCH,
    async (query) => {
      await delay(100);
      
      const lowerQuery = query.toLowerCase();
      
      return mockProducts.filter(p => 
        p.name.toLowerCase().includes(lowerQuery) ||
        p.barcode?.includes(query)
      );
    },
    {
      schema: ProductSearchSchema
    }
  );

  // COUNT
  IPCHandler.handle<void, number>(
    IPC_CHANNELS.PRODUCT_COUNT,
    async () => {
      await delay(50);
      return mockProducts.length;
    }
  );
}

/**
 * Helper: Simulate async delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
