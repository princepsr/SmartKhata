import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useIPC } from '../hooks/useIPC';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { formatCurrency } from '../utils/billing-math';
import { ProductFormModal } from '../components/products/ProductFormModal';
import { StockAdjustmentModal } from '../components/products/StockAdjustmentModal';
import { BulkImportModal } from '../components/products/BulkImportModal';
import { ProductHistoryModal } from '../components/products/ProductHistoryModal';
import { ConfirmModal } from '../components/ConfirmModal';
import './ProductsPage.styles.css';

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
  trackInventory: boolean;
}

const SkeletonRows: React.FC = () => (
  <>
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="skeleton skeleton-row" />
    ))}
  </>
);

const ProductsPage: React.FC = () => {
  const {
    data: products,
    loading,
    error,
    execute: fetchProducts,
  } = useIPC<Product[]>(IPC_CHANNELS.PRODUCT_LIST);
  const [searchQuery, setSearchQuery] = useState('');
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

  // Initial fetch
  useEffect(() => {
    fetchProducts({ includeInactive });
  }, [fetchProducts, includeInactive]);

  const handleAddProduct = () => {
    setEditingProductId(null);
    setIsFormOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setIsFormOpen(true);
  };

  const handleAdjustStock = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation(); // Prevent row selection
    setAdjustingProductId(product.id);
    setIsAdjustmentOpen(true);
  };

  const handleViewHistory = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    setHistoryProduct(product);
    setIsHistoryOpen(true);
  };

  const handleFormSuccess = () => {
    fetchProducts({ includeInactive }); // Refresh list
    setIsFormOpen(false); // Close form if open
    setIsAdjustmentOpen(false); // Close adjustment if open
    setIsImportOpen(false); // Close import if open
  };

  const { execute: toggleStatus } = useIPC(IPC_CHANNELS.PRODUCT_TOGGLE_STATUS);

  const handleToggleStatus = async (e: React.MouseEvent, product: Product) => {
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
            fetchProducts({ includeInactive });
          } catch (err) {
            console.error('Failed to toggle product status:', err);
          }
        },
      });
      return;
    }

    try {
      await toggleStatus({ id: product.id, isActive: !product.isActive });
      fetchProducts({ includeInactive });
    } catch (err) {
      console.error('Failed to toggle product status:', err);
    }
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!products) {
      return [];
    }

    let result = products;

    // Filter by low stock first if enabled
    if (showLowStockOnly) {
      result = result.filter((p) => p.stockQty <= (p.lowStockAlert || 0));
    }

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(lowerQuery) ||
          p.sku?.toLowerCase().includes(lowerQuery) ||
          p.barcode?.includes(lowerQuery)
      );
    }

    return result;
  }, [products, searchQuery, showLowStockOnly]);

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
  }, [filteredProducts, selectedIndex]);

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
          {loading && (
            <div className="data-table-container">
              <SkeletonRows />
            </div>
          )}
          {error && <div className="error">Error: {error}</div>}

          {!loading && !error && (
            <div className="data-table-container" ref={listContainerRef}>
              <div className="data-table-header">
                <div className="col-name">Name</div>
                <div className="col-sku">SKU / Barcode</div>
                <div className="col-price">Price</div>
                <div className="col-stock">Stock</div>
                <div className="col-status">Status</div>
                <div className="col-actions">Actions</div>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="no-results">No products found</div>
              ) : (
                filteredProducts.map((product, index) => (
                  <div
                    key={product.id}
                    className={`data-table-row ${index === selectedIndex ? 'selected' : ''} ${!product.isActive ? 'inactive-row' : ''}`}
                    onClick={() => setSelectedIndex(index)}
                    onDoubleClick={() => handleEditProduct(product)}
                  >
                    <div className="col-name">{product.name}</div>
                    <div className="col-sku">{product.sku || product.barcode || '-'}</div>
                    <div className="col-price">{formatCurrency(product.salePrice)}</div>
                    <div className="col-stock">
                      {product.trackInventory ? (
                        <span
                          className={
                            product.stockQty <= 0
                              ? 'stock-out'
                              : product.stockQty <= (product.lowStockAlert || 0)
                                ? 'stock-low'
                                : ''
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
                        className="btn-sm btn-secondary"
                        onClick={(e) => handleAdjustStock(e, product)}
                        title="Adjust Stock"
                      >
                        Adj
                      </button>
                      <button
                        className="btn-sm btn-secondary"
                        onClick={(e) => handleViewHistory(e, product)}
                        title="View History"
                        style={{ marginLeft: '0.5rem' }}
                      >
                        Hist
                      </button>
                      <button
                        className={`btn-sm ${product.isActive ? 'btn-secondary' : 'btn-success'}`}
                        onClick={(e) => handleToggleStatus(e, product)}
                        title={product.isActive ? 'Deactivate' : 'Activate'}
                        style={{ marginLeft: '0.5rem' }}
                      >
                        {product.isActive ? 'Off' : 'On'}
                      </button>
                    </div>
                  </div>
                ))
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
        onSuccess={handleFormSuccess}
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
