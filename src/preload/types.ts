/**
 * Type definitions for window.electron API
 * 
 * This file provides TypeScript types for the API exposed by the preload script.
 * Import this in your renderer components for type safety.
 */

export interface ElectronAPI {
  // Generic IPC invoke
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;

  // Products API
  products: {
    getAll: () => Promise<Product[]>;
    getById: (id: number) => Promise<Product | null>;
    create: (product: CreateProductDTO) => Promise<Product>;
    update: (id: number, product: UpdateProductDTO) => Promise<Product>;
    delete: (id: number) => Promise<void>;
    search: (query: string) => Promise<Product[]>;
  };

  // Sales API
  sales: {
    create: (sale: CreateSaleDTO) => Promise<Sale>;
    getAll: () => Promise<Sale[]>;
    getById: (id: number) => Promise<Sale | null>;
    getByDateRange: (startDate: string, endDate: string) => Promise<Sale[]>;
  };

  // Customers API
  customers: {
    getAll: () => Promise<Customer[]>;
    create: (customer: CreateCustomerDTO) => Promise<Customer>;
    update: (id: number, customer: UpdateCustomerDTO) => Promise<Customer>;
  };

  // Printing API
  print: {
    invoice: (saleId: number) => Promise<void>;
  };

  // App API
  app: {
    getVersion: () => Promise<string>;
    getConfig: () => Promise<AppConfig>;
  };
}

// Extend the Window interface to include our electron API
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

// Domain types (placeholders - will be replaced with actual types from shared)
export interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  barcode?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDTO {
  name: string;
  price: number;
  stock: number;
  barcode?: string;
  category?: string;
}

export interface UpdateProductDTO {
  name?: string;
  price?: number;
  stock?: number;
  barcode?: string;
  category?: string;
}

export interface Sale {
  id: number;
  customerId?: number;
  total: number;
  items: SaleItem[];
  createdAt: string;
}

export interface SaleItem {
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface CreateSaleDTO {
  customerId?: number;
  items: {
    productId: number;
    quantity: number;
    price: number;
  }[];
}

export interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt: string;
}

export interface CreateCustomerDTO {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface UpdateCustomerDTO {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface AppConfig {
  appVersion: string;
  isDevelopment: boolean;
  userDataPath: string;
  databasePath: string;
  logsPath: string;
}
