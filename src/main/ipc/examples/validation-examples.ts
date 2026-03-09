/**
 * Example: Product Handlers with Zod Validation
 *
 * Demonstrates how to use Zod schemas for IPC request validation
 */

import { IPC_CHANNELS } from '@shared/ipc/channels';
import { IPCHandler } from '../ipc-handler';
import {
  CreateProductSchema,
  UpdateProductSchema,
  ProductIdSchema,
  ProductSearchSchema,
  type CreateProductRequest,
  type UpdateProductRequest,
} from '@shared/validation/schemas';

// Mock Product Type
interface Product {
  id: number;
  name: string;
  sku?: string;
  salePrice: number;
  stockQty: number;
  barcode?: string;
}

const mockProducts: Product[] = [
  { id: 1, name: 'Sample Product 1', salePrice: 100, stockQty: 50 },
  { id: 2, name: 'Sample Product 2', salePrice: 200, stockQty: 30 },
];

let nextProductId = 3;

/**
 * Register Product Create Handler with Validation
 */
export function registerProductCreateHandler(): void {
  IPCHandler.handle<CreateProductRequest, Product>(
    IPC_CHANNELS.PRODUCT_CREATE,
    async (request) => {
      const newProduct: Product = {
        id: nextProductId++,
        name: request.name,
        sku: request.sku,
        salePrice: request.salePrice,
        stockQty: request.stockQty ?? 0,
        barcode: request.barcode,
      };

      mockProducts.push(newProduct);
      return newProduct;
    },
    {
      schema: CreateProductSchema,
    }
  );
}

/**
 * Register Product Search Handler with Validation
 */
export function registerProductSearchHandler(): void {
  IPCHandler.handle<{ query: string; includeInactive?: boolean }, Product[]>(
    IPC_CHANNELS.PRODUCT_SEARCH,
    async ({ query }) => {
      return mockProducts.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
    },
    {
      schema: ProductSearchSchema,
    }
  );
}

/**
 * Register All Example Handlers
 */
export function registerProductHandlersWithValidation(): void {
  registerProductCreateHandler();
  registerProductSearchHandler();

  // GET Handler
  IPCHandler.handle<number, Product>(
    IPC_CHANNELS.PRODUCT_GET,
    async (id) => {
      const product = mockProducts.find((p) => p.id === id);
      if (!product) {throw new Error('Product not found');}
      return product;
    },
    {
      schema: ProductIdSchema,
    }
  );

  // UPDATE Handler
  IPCHandler.handle<UpdateProductRequest, Product>(
    IPC_CHANNELS.PRODUCT_UPDATE,
    async (request) => {
      const index = mockProducts.findIndex((p) => p.id === request.id);
      if (index === -1) {throw new Error('Product not found');}

      const updatedProduct = {
        ...mockProducts[index],
        ...request.data,
      };

      mockProducts[index] = updatedProduct;
      return updatedProduct;
    },
    {
      schema: UpdateProductSchema,
    }
  );
}
