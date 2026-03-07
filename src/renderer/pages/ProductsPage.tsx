import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIPC } from '../hooks/useIPC';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { formatCurrency } from '../utils/formatters';
import { useAppSettingsStore } from '../store/useAppSettingsStore';
import { ProductFormModal } from '../components/products/ProductFormModal';
import { StockAdjustmentModal } from '../components/products/StockAdjustmentModal';
import { BulkImportModal } from '../components/products/BulkImportModal';
import { ProductHistoryModal } from '../components/products/ProductHistoryModal';
import { ConfirmModal } from '../components/ConfirmModal';
import EmptyState from '../components/common/EmptyState';
import './ProductsPage.css';

interface Product {
  id: number;
  name: string;
  sku?: string;
  barcode?: string;
  salePrice: number;
  purchasePrice?: number;
  gstPercent?: number;
  stockQty: number;
  lowStockAlert?: number;
  isActive: boolean;
  isGstInclusive: boolean;
  trackInventory: boolean;
  batchNumber?: string;
  expiryDate?: string;
}

const SkeletonRows: React.FC = () => (
  <>
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="skeleton skeleton-row" />
    ))}
  </>
);

const ProductsPage: React.FC = () => {
  const { settings } = useAppSettingsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  const {
    data: paginatedData,
    loading,
    error,
    execute: fetchItems,
  } = useIPC<{ items: Product[]; totalCount: number; hasMore: boolean; page: number }>(
    debouncedSearchQuery.trim().length >= 1
      ? IPC_CHANNELS.PRODUCT_SEARCH
      : IPC_CHANNELS.PRODUCT_LIST
  );

  const [products, setProducts] = useState<Product[]>([]);
  const isInitialLoading = loading && products.length === 0;
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [adjustingProductId, setAdjustingProductId] = useState<number | null>(null);
  const [showLowStockOnly, setShowLowStockOnly] = useLocalStorage('products_show_low_stock', false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Derived state to catch updates after refresh
  const editingProduct = useMemo(
    () =>
      editingProductId && products ? products.find((p) => p.id === editingProductId) || null : null,
    [products, editingProductId]
  );

  const adjustingProduct = useMemo(
    () =>
      adjustingProductId && products
        ? products.find((p) => p.id === adjustingProductId) || null
        : null,
    [products, adjustingProductId]
  );

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [includeInactive, setIncludeInactive] = useLocalStorage('products_show_inactive', false);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const handleAddProduct = useCallback(() => {
    setEditingProductId(null);
    setIsFormOpen(true);
  }, []);

  const handleEditProduct = useCallback((product: Product) => {
    setEditingProductId(product.id);
    setIsFormOpen(true);
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  // Handle global actions (e.g. from Command Center)
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'add') {
      handleAddProduct();
      // Remove the param so it doesn't re-open on refresh or navigation back
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, handleAddProduct]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search on Ctrl+F
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // New product on Alt+N
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        handleAddProduct();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAddProduct]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Initial fetch / Search trigger
  useEffect(() => {
    setPage(1);
    setProducts([]); // Clear existing items on search or filter change
    if (debouncedSearchQuery.trim().length >= 1) {
      fetchItems({
        includeInactive,
        query: debouncedSearchQuery,
        page: 1,
        pageSize: 100,
      });
    } else {
      fetchItems({
        includeInactive,
        page: 1,
        pageSize: 100,
      });
    }
  }, [fetchItems, includeInactive, debouncedSearchQuery]);

  // Fetch more items
  const fetchNextPage = useCallback(() => {
    if (loading || !hasMore) {
      return;
    }

    const nextPage = page + 1;
    setPage(nextPage);
    fetchItems({
      includeInactive,
      query: debouncedSearchQuery,
      page: nextPage,
      pageSize: 100,
    });
  }, [fetchItems, includeInactive, debouncedSearchQuery, page, loading, hasMore]);

  // Handle data updates
  useEffect(() => {
    if (paginatedData) {
      if (paginatedData.page === 1) {
        setProducts(paginatedData.items);
      } else {
        setProducts((prev) => [...prev, ...paginatedData.items]);
      }
      setHasMore(paginatedData.hasMore);
      setTotalCount(paginatedData.totalCount);
    }
  }, [paginatedData]);

  // Intersection Observer for Infinite Scroll
  const loaderRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore || loading) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      {
        root: listContainerRef.current,
        threshold: 0.1,
        rootMargin: '100px', // Start loading before reaching bottom
      }
    );

    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
      observer.disconnect();
    };
  }, [hasMore, loading, fetchNextPage]);

  const handleAdjustStock = useCallback((e: React.MouseEvent, product: Product) => {
    e.stopPropagation(); // Prevent row selection
    setAdjustingProductId(product.id);
    setIsAdjustmentOpen(true);
  }, []);

  const handleViewHistory = useCallback((e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    setHistoryProduct(product);
    setIsHistoryOpen(true);
  }, []);

  const handleFormSuccess = useCallback(() => {
    setPage(1);
    setProducts([]);
    fetchItems({
      includeInactive,
      query: debouncedSearchQuery,
      page: 1,
      pageSize: 100,
    }); // Refresh list
    setIsFormOpen(false); // Close form if open
    setIsAdjustmentOpen(false); // Close adjustment if open
    setIsImportOpen(false); // Close import if open
  }, [fetchItems, includeInactive, debouncedSearchQuery]);

  const handleImportSuccess = useCallback(() => {
    handleFormSuccess();
  }, [handleFormSuccess]);

  const { execute: toggleStatus } = useIPC(IPC_CHANNELS.PRODUCT_TOGGLE_STATUS);

  const handleToggleStatus = useCallback(
    async (e: React.MouseEvent, product: Product) => {
      e.stopPropagation();
      const isDeactivating = product.isActive;

      if (isDeactivating) {
        setConfirmDialog({
          isOpen: true,
          title: 'Deactivate Product',
          message: `Are you sure you want to deactivate "${product.name}"? It will be hidden from the billing search.`,
          onConfirm: async () => {
            try {
              await toggleStatus({ id: product.id, isActive: false });
              handleFormSuccess(); // Reuse refresh logic
            } catch (err) {
              console.error('Failed to toggle product status:', err);
            }
          },
        });
        return;
      }

      try {
        await toggleStatus({ id: product.id, isActive: !product.isActive });
        handleFormSuccess();
      } catch (err) {
        console.error('Failed to toggle product status:', err);
      }
    },
    [toggleStatus, handleFormSuccess]
  );

  // Filter products (client side filters only, search is server side)
  const filteredProducts = useMemo(() => {
    if (!products) {
      return [];
    }

    let result = products;

    // Filter by low stock if enabled (still client side for now as it's a simple toggle)
    if (showLowStockOnly) {
      result = result.filter((p) => p.stockQty <= (p.lowStockAlert || 0));
    }

    return result;
  }, [products, showLowStockOnly]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if modal is open (except for shortcuts that might work globally, but usually not in this context)
      if (document.querySelector('.modal-overlay')) {
        return;
      }

      // Global page shortcuts
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleAddProduct();
        return;
      }

      if (filteredProducts.length === 0) {
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, filteredProducts.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredProducts[selectedIndex]) {
            handleEditProduct(filteredProducts[selectedIndex]);
          }
          break;
        case 'Insert': // Add new product
          e.preventDefault();
          handleAddProduct();
          break;
        // F7 for Stock Adjustment on selected item? Maybe later.
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredProducts, selectedIndex, handleAddProduct, handleEditProduct]);

  // Auto-scroll to selected item
  useEffect(() => {
    if (listContainerRef.current && listContainerRef.current.children.length > 0) {
      const selectedElement = listContainerRef.current.children[selectedIndex + 1] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Reset selection on search
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  return (
    <div className="page products-page">
      <div className="page-content-wrapper animate-fade-in">
        <header className="page-header">
          <h1 className="page-title">Products & Inventory</h1>
          <div className="header-actions">
            <div className="filter-group">
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={showLowStockOnly}
                  onChange={(e) => setShowLowStockOnly(e.target.checked)}
                />
                Low Stock Only
              </label>
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={includeInactive}
                  onChange={(e) => setIncludeInactive(e.target.checked)}
                />
                Show Inactive
              </label>
            </div>
            <button
              className="btn-secondary"
              onClick={() => setIsImportOpen(true)}
              style={{ marginRight: '1rem' }}
            >
              Import CSV
            </button>
            <input
              ref={searchInputRef}
              type="text"
              className="search-input"
              placeholder="Search Product (F2) - Name / SKU / Barcode"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <button className="btn-primary" onClick={handleAddProduct} title="Ctrl + N">
              + Add Product (Ctrl+N)
            </button>
          </div>
        </header>

        <div className="products-content">
          {isInitialLoading && (
            <div className="data-table-container">
              <SkeletonRows />
            </div>
          )}
          {error && (
            <div className="no-results" style={{ color: 'var(--color-error)' }}>
              Error: {error}
            </div>
          )}

          {(!isInitialLoading || products.length > 0) && !error && (
            <div className="data-table-container" ref={listContainerRef}>
              <div className="data-table-header">
                <div className="col-name">Name</div>
                <div className="col-sku">SKU / Barcode</div>
                <div className="col-price">Sale Price</div>
                <div className="col-cost">Purchase</div>
                <div className="col-stock">Stock</div>
                <div className="col-status">Status</div>
                <div className="col-actions">Actions</div>
              </div>

              {filteredProducts.length === 0 ? (
                <EmptyState
                  title="No Products Found"
                  message={
                    searchQuery
                      ? `We couldn't find any products matching "${searchQuery}".`
                      : "You haven't added any products yet. Let's get started!"
                  }
                  icon="📦"
                  action={
                    !searchQuery
                      ? { label: 'Add New Product', onClick: handleAddProduct }
                      : undefined
                  }
                />
              ) : (
                filteredProducts.map((product, index) => (
                  <div
                    key={product.id}
                    className={`data-table-row ${index === selectedIndex ? 'selected' : ''} ${!product.isActive ? 'inactive-row' : ''}`}
                    onClick={() => setSelectedIndex(index)}
                    onDoubleClick={() => handleEditProduct(product)}
                  >
                    <div className="col-name">
                      <div className="product-info-wrapper">
                        <span className="product-display-name">{product.name}</span>
                        {(product.batchNumber || product.expiryDate) && (
                          <div className="product-sub-info">
                            {product.batchNumber && (
                              <span className="info-batch">{product.batchNumber}</span>
                            )}
                            {product.expiryDate && (
                              <span className="info-expiry">{product.expiryDate}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-sku">{product.sku || product.barcode || '-'}</div>
                    <div className="col-price">
                      {formatCurrency(product.salePrice)}
                      {product.isGstInclusive &&
                        settings.gstEnabled &&
                        !settings.gstExclusiveMode && (
                          <span
                            className="inclusive-badge"
                            title="Price is inclusive of GST"
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              background: '#e0e7ff',
                              color: '#4338ca',
                              borderRadius: '10px',
                              marginLeft: '6px',
                              fontWeight: '600',
                              verticalAlign: 'middle',
                            }}
                          >
                            MRP
                          </span>
                        )}
                    </div>
                    <div className="col-cost">
                      {product.purchasePrice && product.purchasePrice > 0 ? (
                        formatCurrency(product.purchasePrice)
                      ) : (
                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                          N/A
                        </span>
                      )}
                    </div>
                    <div className="col-stock">
                      {product.trackInventory ? (
                        <span
                          className={
                            product.stockQty <= 0
                              ? 'stock-out'
                              : product.stockQty <= (product.lowStockAlert || 0)
                                ? 'stock-low'
                                : 'stock-ok'
                          }
                          title={
                            product.stockQty <= 0
                              ? 'Out of Stock'
                              : product.stockQty <= (product.lowStockAlert || 0)
                                ? 'Low Stock Warning'
                                : 'Sufficient Stock'
                          }
                        >
                          {product.stockQty}
                        </span>
                      ) : (
                        <span className="text-muted" title="Not Tracked">
                          -
                        </span>
                      )}
                    </div>
                    <div className="col-status">
                      <span className={`status-badge ${product.isActive ? 'active' : 'inactive'}`}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="col-actions">
                      <button
                        className="action-icon-btn action-edit"
                        onClick={() => handleEditProduct(product)}
                        title="Edit Product"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="lucide lucide-pencil"
                        >
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          <path d="m15 5 4 4" />
                        </svg>
                      </button>
                      {!settings.billingOnly && (
                        <button
                          className="action-icon-btn action-adjust"
                          onClick={(e) => handleAdjustStock(e, product)}
                          title="Adjust Stock"
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="lucide lucide-boxes"
                          >
                            <path d="M2.97 12.92A2 2 0 0 0 2 14.75v3.24c0 .85.47 1.62 1.2 1.98l2.91 1.43a2 2 0 0 0 1.78 0l2.91-1.43c.73-.36 1.2-1.13 1.2-1.98v-3.24a2 2 0 0 0-.97-1.83L8.14 11.3a2 2 0 0 0-1.78 0l-1.39.62Z" />
                            <path d="M7 14.5 2.7 12.5" />
                            <path d="m7 14.5 4.3-2" />
                            <path d="M7 14.5v5.3" />
                            <path d="M12.97 12.92a2 2 0 0 0-.97 1.83v3.24c0 .85.47 1.62 1.2 1.98l2.91 1.43a2 2 0 0 0 1.78 0l2.91-1.43c.73-.36 1.2-1.13 1.2-1.98v-3.24a2 2 0 0 0-.97-1.83L18.14 11.3a2 2 0 0 0-1.78 0l-1.39.62Z" />
                            <path d="M17 14.5l-4.3-2" />
                            <path d="m17 14.5 4.3-2" />
                            <path d="M17 14.5v5.3" />
                            <path d="M7.97 4.42A2 2 0 0 0 7 6.25v3.24c0 .85.47 1.62 1.2 1.98l2.91 1.43a2 2 0 0 0 1.78 0l2.91-1.43c.73-.36 1.2-1.13 1.2-1.98V6.25a2 2 0 0 0-.97-1.83L13.14 2.8a2 2 0 0 0-1.78 0l-1.39.62Z" />
                            <path d="M12 6.5 7.7 4.5" />
                            <path d="m12 6.5 4.3-2" />
                            <path d="M12 6.5v5.3" />
                          </svg>
                        </button>
                      )}
                      <button
                        className="action-icon-btn action-history"
                        onClick={(e) => handleViewHistory(e, product)}
                        title="Stock History"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="lucide lucide-history"
                        >
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                          <path d="M12 7v5l4 2" />
                        </svg>
                      </button>
                      <button
                        className={`action-icon-btn action-toggle ${product.isActive ? 'active' : 'inactive'}`}
                        onClick={(e) => handleToggleStatus(e, product)}
                        title={product.isActive ? 'Deactivate Product' : 'Activate Product'}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="lucide lucide-power"
                        >
                          <path d="M12 2v10" />
                          <path d="M18.4 6.6a9 9 0 1 1-12.77.1" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}

              {hasMore && (
                <div ref={loaderRef} className="loading-more">
                  {loading ? 'Loading more products...' : 'Scroll for more'}
                </div>
              )}

              {!hasMore && products.length > 0 && totalCount > 100 && (
                <div className="end-of-list">Showing all {totalCount} products</div>
              )}
            </div>
          )}
        </div>
      </div>

      <ProductFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingProductId(null);
        }}
        onSuccess={handleFormSuccess}
        initialData={editingProduct}
      />

      <StockAdjustmentModal
        isOpen={isAdjustmentOpen}
        onClose={() => {
          setIsAdjustmentOpen(false);
          setAdjustingProductId(null);
        }}
        onSuccess={handleFormSuccess}
        product={adjustingProduct}
      />

      <BulkImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={handleImportSuccess}
      />

      <ProductHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        product={historyProduct}
      />

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        type="warning"
        confirmLabel="Deactivate"
      />
    </div>
  );
};

export default ProductsPage;
