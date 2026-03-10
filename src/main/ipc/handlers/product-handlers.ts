/**
 * Product IPC Handlers (Service-Based)
 *
 * Wires product operations from UI to ProductService.
 * No SQL logic, no repository calls - only service orchestration.
 */

import { IPC_CHANNELS } from '@shared/ipc/channels';
import { IPCHandler } from '../ipc-handler';
import * as XLSX from 'xlsx';
import fs from 'fs';
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
import { MedicalService } from '../../services/medical-service';
import { LicenseService } from '../../services/license-service';
import { getUserFriendlyMessage } from '../../services/errors/service-errors';
import { Product as ProductDomain } from '../../repositories/product-repository';
import { 
  Product,
  ProductHistoryItem, 
  IndianMedicine as IndianMedicineIPC 
} from '@shared/types/ipc';


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
    { items: Product[]; totalCount: number; hasMore: boolean; page: number }
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
      const items = result.items.map((p: ProductDomain) => _mapToUI(p));

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
  IPCHandler.handle<number, Product>(
    IPC_CHANNELS.PRODUCT_GET,
    async (productId) => {
      const product = productService.getProduct(productId);
      return _mapToUI(product);
    },
    {
      schema: ProductIdSchema,
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // CREATE PRODUCT
  // ============================================
  IPCHandler.handle<CreateProductRequest, Product>(
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
        hsnCode: request.hsnCode,
        batchNumber: request.batchNumber,
        expiryDate: request.expiryDate,
        saltName: request.saltName,
        uom: request.uom,
        isWeightBased: request.isWeightBased,
        stripSize: request.stripSize,
        drugCategory: request.drugCategory,
        variantGroupId: request.variantGroupId,
        lastSaleDate: request.lastSaleDate,
      };

      const product = productService.addProduct(input);
      return _mapToUI(product);
    },
    {
      schema: CreateProductSchema,
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // BULK IMPORT PRODUCTS
  // ============================================
  IPCHandler.handle<CreateProductRequest[], Product[]>(
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
        hsnCode: req.hsnCode,
      }));

      const products = productService.importProducts(inputs);
      return products.map((product) => _mapToUI(product));
    },
    {
      schema: ProductImportSchema,
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // PARSE EXCEL FOR IMPORT
  // ============================================
  IPCHandler.handle<string, { headers: string[]; data: string[][]; totalRows: number }>(
    IPC_CHANNELS.PRODUCT_PARSE_EXCEL,
    async (filePath) => {
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }

      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) {
        throw new Error('No worksheets found in the Excel file');
      }

      // Convert worksheet to array of arrays
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
      
      if (rows.length === 0) {
        throw new Error('Excel file is empty');
      }

      const headers = (rows[0] || []).map((h, i) => (h ? String(h).trim() : `Column ${i + 1}`));
      const data = rows.slice(1).map((row) => {
        // Ensure data row has same length as headers
        return Array.from({ length: headers.length }, (_, i) => (row[i] !== undefined ? String(row[i]).trim() : ''));
      }).filter((row) => row.some((val) => val !== '')); // Skip completely empty rows

      return {
        headers,
        data,
        totalRows: data.length,
      };
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  // ============================================
  // UPDATE PRODUCT
  // ============================================
  IPCHandler.handle<UpdateProductRequest, Product>(
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
        hsnCode: request.data.hsnCode,
        batchNumber: request.data.batchNumber,
        expiryDate: request.data.expiryDate,
        saltName: request.data.saltName,
        uom: request.data.uom,
        isWeightBased: request.data.isWeightBased,
        stripSize: request.data.stripSize,
        drugCategory: request.data.drugCategory,
        variantGroupId: request.data.variantGroupId,
        lastSaleDate: request.data.lastSaleDate,
      };

      const product = productService.updateProduct(request.id, updates);
      return _mapToUI(product);
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
    { items: Product[]; totalCount: number; hasMore: boolean }
  >(
    IPC_CHANNELS.PRODUCT_SEARCH,
    async ({ query, includeInactive, page, pageSize }) => {
      const result = productService.searchProducts(query, includeInactive, page, pageSize);

      return {
        items: result.items.map((p: ProductDomain) => _mapToUI(p)),
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
  IPCHandler.handle<void, Partial<Product>[]>(
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
  IPCHandler.handle<number, ProductHistoryItem[]>(
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

  // ============================================
  // MEDICAL SPECIALIZATION
  // ============================================
  const medicalService = new MedicalService();

  IPCHandler.handle<number, string | null>(
    IPC_CHANNELS.MEDICAL_DRUG_WARNING,
    async (productId) => {
      const product = productService.getProduct(productId);
      return medicalService.getDrugWarning(product);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  IPCHandler.handle<string, string[]>(
    IPC_CHANNELS.MEDICAL_SALT_SUGGESTIONS,
    async (query) => {
      return medicalService.getSaltSuggestions(query);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  IPCHandler.handle<string, IndianMedicineIPC[]>(
    IPC_CHANNELS.MEDICAL_MEDICINE_SUGGESTIONS,
    async (query) => {
      return medicalService.getMedicineSuggestions(query);
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );

  IPCHandler.handle<{ saltName: string; excludeProductId: number }, Partial<Product>[]>(
    IPC_CHANNELS.MEDICAL_ALTERNATIVES,
    async ({ saltName, excludeProductId }) => {
      const alternatives = medicalService.getAlternativesBySalt(saltName, excludeProductId);
      return alternatives.map((p) => ({
        id: p.id,
        name: p.name,
        salePrice: p.salePrice,
        stockQty: p.stockQty,
        saltName: p.saltName,
        drugCategory: p.drugCategory,
      }));
    },
    {
      transformError: (err) => getUserFriendlyMessage(err),
    }
  );
}

/**
 * Map Domain Product to UI Object
 */
function _mapToUI(p: ProductDomain): Product {
  return {
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
    hsnCode: p.hsnCode,
    batchNumber: p.batchNumber,
    expiryDate: p.expiryDate,
    saltName: p.saltName,
    uom: p.uom,
    isWeightBased: p.isWeightBased,
    stripSize: p.stripSize,
    drugCategory: p.drugCategory,
    variantGroupId: p.variantGroupId,
    createdAt: p.createdAt.getTime(),
    updatedAt: p.updatedAt.getTime(),
  };
}
