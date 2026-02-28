/**
 * Validation Schemas
 *
 * Zod schemas for validating IPC request payloads.
 *
 * WHY ZOD?
 * - TypeScript-first with excellent type inference
 * - Runtime validation + compile-time types
 * - Small bundle size
 * - Great error messages
 * - Easy to compose and reuse
 */

import { z } from 'zod';

/**
 * Product Schemas
 */

// Create Product Request
export const CreateProductSchema = z.object({
  name: z
    .string()
    .min(1, 'Product name is required')
    .max(100, 'Product name must be less than 100 characters')
    .trim(),

  sku: z.string().max(50, 'SKU must be less than 50 characters').optional(),

  barcode: z.string().max(50, 'Barcode must be less than 50 characters').optional(),

  salePrice: z.number().nonnegative('Price cannot be negative').max(999999.99, 'Price is too high'),

  cost: z
    .number()
    .nonnegative('Cost cannot be negative')
    .max(999999.99, 'Cost is too high')
    .optional(),

  gstPercent: z
    .number()
    .nonnegative('GST cannot be negative')
    .max(100, 'GST cannot exceed 100%')
    .optional(),

  stockQty: z
    .number()
    .int('Stock must be a whole number')
    .nonnegative('Stock cannot be negative')
    .optional(),

  lowStockAlert: z
    .number()
    .int('Low stock alert must be a whole number')
    .nonnegative('Low stock alert cannot be negative')
    .optional(),

  trackInventory: z.boolean().optional(),
  isGstInclusive: z.boolean().optional(),
  isActive: z.boolean().optional(),
  hsnCode: z.string().max(20, 'HSN Code must be less than 20 characters').optional().nullable(),
});

// Infer TypeScript type from schema
export type CreateProductRequest = z.infer<typeof CreateProductSchema>;

// Update Product Request
export const UpdateProductSchema = z.object({
  id: z.number().int('Product ID must be a whole number').positive('Invalid product ID'),

  data: z
    .object({
      name: z
        .string()
        .min(1, 'Product name is required')
        .max(100, 'Product name must be less than 100 characters')
        .trim()
        .optional(),

      sku: z.string().max(50, 'SKU must be less than 50 characters').optional(),

      barcode: z.string().max(50, 'Barcode must be less than 50 characters').optional(),

      salePrice: z
        .number()
        .nonnegative('Price cannot be negative')
        .max(999999.99, 'Price is too high')
        .optional(),

      cost: z
        .number()
        .nonnegative('Cost cannot be negative')
        .max(999999.99, 'Cost is too high')
        .nullable()
        .optional(),

      gstPercent: z
        .number()
        .nonnegative('GST cannot be negative')
        .max(100, 'GST cannot exceed 100%')
        .optional(),

      stockQty: z
        .number()
        .int('Stock must be a whole number')
        .nonnegative('Stock cannot be negative')
        .optional(),

      lowStockAlert: z
        .number()
        .int('Low stock alert must be a whole number')
        .nonnegative('Low stock alert cannot be negative')
        .optional(),

      trackInventory: z.boolean().optional(),

      isGstInclusive: z.boolean().optional(),

      isActive: z.boolean().optional(),

      hsnCode: z.string().max(20, 'HSN Code must be less than 20 characters').optional().nullable(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update',
    }),
});

export type UpdateProductRequest = z.infer<typeof UpdateProductSchema>;

// Product ID Schema (for get/delete)
export const ProductIdSchema = z
  .number()
  .int('Product ID must be a whole number')
  .positive('Invalid product ID');

// Product Search Schema
export const ProductSearchSchema = z.object({
  query: z
    .string()
    .min(1, 'Search query must be at least 1 character')
    .max(100, 'Search query is too long'),
  includeInactive: z.boolean().optional(),
});

// Customer Search Schema
export const CustomerSearchSchema = z.object({
  query: z
    .string()
    .min(1, 'Search query must be at least 1 character')
    .max(100, 'Search query is too long'),
  includeInactive: z.boolean().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
});

// Create Product Array (for Import)
export const ProductImportSchema = z.array(CreateProductSchema);

// Adjust Stock Request
export const ProductAdjustStockSchema = z.object({
  productId: z.number().int().positive('Invalid product ID'),
  deltaQty: z.number(),
  reason: z.enum(['MANUAL', 'ADJUSTMENT']),
  notes: z.string().max(500).optional(),
});

// Toggle Status Request
export const ProductToggleStatusSchema = z.object({
  id: z.number().int().positive('Invalid product ID'),
  isActive: z.boolean(),
});

/**
 * Sale Schemas
 */

// Sale Item Schema
export const SaleItemSchema = z.object({
  productId: z.number().int('Product ID must be a whole number').positive('Invalid product ID'),

  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .positive('Quantity must be at least 1'),

  price: z.number().positive('Price must be greater than 0'),
});

// Create Sale Request
export const CreateSaleSchema = z.object({
  customerId: z
    .number()
    .int('Customer ID must be a whole number')
    .positive('Invalid customer ID')
    .optional(),

  items: z
    .array(SaleItemSchema)
    .min(1, 'Sale must have at least one item')
    .max(100, 'Sale cannot have more than 100 items'),

  discount: z
    .number()
    .nonnegative('Discount cannot be negative')
    .max(100, 'Discount cannot exceed 100%')
    .default(0),

  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
});

export type CreateSaleRequest = z.infer<typeof CreateSaleSchema>;

// Date Range Schema
export const DateRangeSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),

    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  })
  .refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
    message: 'Start date must be before or equal to end date',
  });

export type DateRangeRequest = z.infer<typeof DateRangeSchema>;

/**
 * Customer Schemas
 */

// Create Customer Request
export const CreateCustomerSchema = z.object({
  name: z
    .string()
    .min(1, 'Customer name is required')
    .max(50, 'Customer name must be less than 50 characters')
    .trim(),

  phone: z
    .string()
    .regex(/^\d{10}$/, 'Phone number must be 10 digits')
    .optional(),

  email: z.string().email('Invalid email address').optional(),

  address: z.string().max(200, 'Address must be less than 200 characters').optional(),
});

export type CreateCustomerRequest = z.infer<typeof CreateCustomerSchema>;

// Update Customer Request
export const UpdateCustomerSchema = z.object({
  id: z.number().int('Customer ID must be a whole number').positive('Invalid customer ID'),

  data: CreateCustomerSchema.partial().refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  }),
});

export type UpdateCustomerRequest = z.infer<typeof UpdateCustomerSchema>;

/**
 * Helper: Validate data against schema
 *
 * @param schema - Zod schema
 * @param data - Data to validate
 * @returns Validated data
 * @throws Error with validation message if invalid
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    // Extract first error message
    const firstError = result.error.issues[0];
    throw new Error(firstError.message);
  }

  return result.data;
}
