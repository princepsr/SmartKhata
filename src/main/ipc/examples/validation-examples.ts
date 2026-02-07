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

/**
 * Mock Product Type
 */
interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  barcode?: string;
}

/**
 * Mock Database
 */
const mockProducts: Product[] = [
  { id: 1, name: 'Sample Product 1', price: 100, stock: 50 },
  { id: 2, name: 'Sample Product 2', price: 200, stock: 30 },
];

let nextProductId = 3;

/**
 * Example 1: Create Product with Zod Schema Validation
 */
export function registerProductCreateHandler(): void {
  IPCHandler.handle<CreateProductRequest, Product>(
    IPC_CHANNELS.PRODUCT_CREATE,
    async (request) => {
      // Request is already validated by Zod schema
      // TypeScript knows the exact shape of request
      
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
      // Zod schema handles all validation automatically
      schema: CreateProductSchema,
    }
  );
}

/**
 * Example 2: Update Product with Zod Schema
 */
export function registerProductUpdateHandler(): void {
  IPCHandler.handle<UpdateProductRequest, Product>(
    IPC_CHANNELS.PRODUCT_UPDATE,
    async (request) => {
      const product = mockProducts.find(p => p.id === request.id);
      
      if (!product) {
        throw new Error('Product not found');
      }
      
      // Update product with validated data
      Object.assign(product, request.data);
      
      return product;
    },
    {
      schema: UpdateProductSchema,
    }
  );
}

/**
 * Example 3: Get Product by ID with Zod Schema
 */
export function registerProductGetHandler(): void {
  IPCHandler.handle<number, Product>(
    IPC_CHANNELS.PRODUCT_GET,
    async (productId) => {
      const product = mockProducts.find(p => p.id === productId);
      
      if (!product) {
        throw new Error('Product not found');
      }
      
      return product;
    },
    {
      // Validate that productId is a positive integer
      schema: ProductIdSchema,
    }
  );
}

/**
 * Example 4: Search Products with Zod Schema
 */
export function registerProductSearchHandler(): void {
  IPCHandler.handle<string, Product[]>(
    IPC_CHANNELS.PRODUCT_SEARCH,
    async (query) => {
      const lowerQuery = query.toLowerCase();
      
      return mockProducts.filter(p => 
        p.name.toLowerCase().includes(lowerQuery) ||
        p.barcode?.includes(query)
      );
    },
    {
      // Validates query is at least 2 characters
      schema: ProductSearchSchema,
    }
  );
}

/**
 * Example 5: Combining Zod Schema + Custom Validation
 */
export function registerProductCreateWithCustomValidation(): void {
  IPCHandler.handle<CreateProductRequest, Product>(
    IPC_CHANNELS.PRODUCT_CREATE,
    async (request) => {
      // Both Zod schema and custom validation passed
      
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
      // Zod schema validates basic structure and types
      schema: CreateProductSchema,
      
      // Custom validation for business logic
      validate: async (request) => {
        // Check if product name already exists
        const exists = mockProducts.some(
          p => p.name.toLowerCase() === request.name.toLowerCase()
        );
        
        if (exists) {
          throw new Error('Product with this name already exists');
        }
        
        // Check if barcode is unique (if provided)
        if (request.barcode) {
          const barcodeExists = mockProducts.some(
            p => p.barcode === request.barcode
          );
          
          if (barcodeExists) {
            throw new Error('Product with this barcode already exists');
          }
        }
      },
    }
  );
}

/**
 * Example 6: No Validation (Not Recommended)
 */
export function registerProductListHandler(): void {
  IPCHandler.handle<void, Product[]>(
    IPC_CHANNELS.PRODUCT_LIST,
    async () => {
      return mockProducts;
    }
    // No validation needed for void requests
  );
}

/**
 * Register All Handlers
 */
export function registerProductHandlersWithValidation(): void {
  registerProductListHandler();
  registerProductGetHandler();
  registerProductCreateHandler();
  registerProductUpdateHandler();
  registerProductSearchHandler();
}
