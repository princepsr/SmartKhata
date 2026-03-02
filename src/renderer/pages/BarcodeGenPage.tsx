import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useIPC } from '../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { Product } from '@shared/types/ipc';
import { formatCurrency } from '../utils/formatters';
import './BarcodeGenPage.css';

const BarcodeGenPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [labelCount, setLabelCount] = useState(24);
  const [showDropdown, setShowDropdown] = useState(false);

  // Label UI Settings
  const [showBrand, setShowBrand] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [previewMode, setPreviewMode] = useState<'single' | 'sheet'>('single');

  const { data: searchResults, execute: searchProducts } = useIPC<{ items: Product[] }>(
    IPC_CHANNELS.PRODUCT_SEARCH
  );

  const { data: recentProductsData, execute: fetchRecentProducts } = useIPC<{ items: Product[] }>(
    IPC_CHANNELS.PRODUCT_LIST
  );

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchRecentProducts({ pageSize: 12, page: 1 });
  }, [fetchRecentProducts]);

  const handleSearch = useCallback(
    (q: string) => {
      setSearchQuery(q);
      if (q.length > 0) {
        searchProducts({ query: q, pageSize: 8 });
        setShowDropdown(true);
      } else {
        setShowDropdown(false);
      }
    },
    [searchProducts]
  );

  const selectProduct = (p: Product) => {
    setSelectedProduct(p);
    setSearchQuery('');
    setShowDropdown(false);
    setPreviewMode('sheet'); // Default to sheet preview when selected for better space utilization
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrint = async () => {
    if (!selectedProduct) {
      return;
    }

    try {
      await window.api.invoke(IPC_CHANNELS.UTILITY_GENERATE_BARCODE, {
        productId: selectedProduct.id,
        count: labelCount,
        options: {
          showBrand,
          showPrice,
        },
      });
    } catch (error) {
      console.error('Failed to generate barcodes:', error);
    }
  };

  const renderLabelMockup = (product: Product, isMini = false) => (
    <div className={`barcode-label-mockup ${isMini ? 'mini' : ''}`}>
      {showBrand && <div className="label-brand">SmartKhata</div>}
      <div className="label-content">
        <div className="label-pname">{product.name}</div>
        <div className="label-barcode-zone">
          <div className="barcode-stripes">
            {[...Array(isMini ? 20 : 40)].map((_, i) => (
              <div
                key={i}
                className="stripe"
                style={{
                  width: i % 3 === 0 ? '2px' : '1px',
                  opacity: i % 4 === 0 ? 0.4 : 1,
                }}
              />
            ))}
          </div>
          {(product.barcode || product.sku) && (
            <div className="barcode-val">{product.barcode || product.sku}</div>
          )}
        </div>
      </div>
      {showPrice && (
        <div className="label-pricing">
          <span className="mrp-tag">MRP:</span>
          <span className="mrp-val">{formatCurrency(product.salePrice)}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="page barcode-gen-page">
      <header className="page-header">
        <h1 className="page-title">Barcode Label Generator</h1>
        <div className="header-actions">
          <div className="header-search-container">
            <div className="search-box">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search Product..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => searchQuery.length > 0 && setShowDropdown(true)}
                className="search-input"
              />
              <svg
                className="search-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>

            {showDropdown && (
              <div className="search-dropdown custom-scrollbar" ref={dropdownRef}>
                {searchResults?.items.map((p) => (
                  <div key={p.id} className="dropdown-item" onClick={() => selectProduct(p)}>
                    <div className="item-info">
                      <span className="item-name">{p.name}</span>
                      <span className="item-meta">
                        {p.sku || 'No SKU'} • {formatCurrency(p.salePrice)}
                      </span>
                    </div>
                    {p.trackInventory && (
                      <span
                        className={`item-stock ${p.stockQty <= (p.lowStockAlert || 0) ? 'low' : ''}`}
                      >
                        {p.stockQty} in stock
                      </span>
                    )}
                  </div>
                ))}
                {searchResults?.items.length === 0 && (
                  <div className="dropdown-no-results">No products found</div>
                )}
              </div>
            )}
          </div>

          <button className="btn-primary" disabled={!selectedProduct} onClick={handlePrint}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginRight: '8px' }}
            >
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect width="12" height="8" x="6" y="14" />
            </svg>
            Print Labels
          </button>
        </div>
      </header>

      <div className="page-content-wrapper custom-scrollbar">
        <div className="barcode-layout">
          <div className="selection-panel card">
            {selectedProduct ? (
              <div className="selected-product-view">
                <div className="panel-header-simple">
                  <h3>Selected Product</h3>
                  <button className="btn-link" onClick={() => setSelectedProduct(null)}>
                    Clear
                  </button>
                </div>

                <div className="product-summary">
                  <div className="product-details">
                    <div className="selected-name">{selectedProduct.name}</div>
                    <div className="selected-meta">
                      SKU: {selectedProduct.sku || 'N/A'} •{' '}
                      {formatCurrency(selectedProduct.salePrice)}
                    </div>
                  </div>
                </div>

                <div className="label-settings">
                  <div className="settings-section">
                    <h4>Label Options</h4>
                    <div className="toggles-grid">
                      <label className="toggle-item">
                        <input
                          type="checkbox"
                          checked={showBrand}
                          onChange={(e) => setShowBrand(e.target.checked)}
                        />
                        <span>Show Brand Name</span>
                      </label>
                      <label className="toggle-item">
                        <input
                          type="checkbox"
                          checked={showPrice}
                          onChange={(e) => setShowPrice(e.target.checked)}
                        />
                        <span>Show MRP / Price</span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-divider" />

                  <div className="settings-section">
                    <h4>Print Settings</h4>
                    <div className="form-group">
                      <label>Number of Labels</label>
                      <div className="number-input-group">
                        <button onClick={() => setLabelCount(Math.max(1, labelCount - 1))}>
                          -
                        </button>
                        <input
                          type="number"
                          value={labelCount}
                          onChange={(e) =>
                            setLabelCount(Math.max(1, parseInt(e.target.value) || 1))
                          }
                          min={1}
                        />
                        <button onClick={() => setLabelCount(labelCount + 1)}>+</button>
                      </div>
                      <p className="setting-hint">Standard sheet has 24 labels</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state-workspace">
                <div className="selection-header">
                  <h3>Quick Select</h3>
                  <p>Or use the search box in header</p>
                </div>
                <div className="recent-products-grid custom-scrollbar">
                  {recentProductsData?.items.map((p) => (
                    <div
                      key={p.id}
                      className="recent-product-card"
                      onClick={() => selectProduct(p)}
                    >
                      <div className="recent-info">
                        <div className="recent-name">{p.name}</div>
                        <div className="recent-meta">{p.sku || 'No SKU'}</div>
                      </div>
                    </div>
                  ))}
                  {(!recentProductsData || recentProductsData.items.length === 0) && (
                    <div className="no-recent">Start searching to select products</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="preview-panel card">
            <div className="panel-header-simple">
              <h3>Preview Workspace</h3>
              <div className="preview-toggles">
                <button
                  className={`toggle-btn ${previewMode === 'single' ? 'active' : ''}`}
                  onClick={() => setPreviewMode('single')}
                >
                  Single Label
                </button>
                <button
                  className={`toggle-btn ${previewMode === 'sheet' ? 'active' : ''}`}
                  onClick={() => setPreviewMode('sheet')}
                >
                  Full Sheet (24)
                </button>
              </div>
            </div>

            <div className={`preview-area ${previewMode}-mode`}>
              {selectedProduct ? (
                <div className={`preview-container ${previewMode}`}>
                  {previewMode === 'single' ? (
                    <div className="single-preview-wrap">
                      {renderLabelMockup(selectedProduct)}
                      <div className="preview-badge">Actual Size: 38 x 25 mm</div>
                    </div>
                  ) : (
                    <div className="sheet-preview-wrap">
                      <div className="a4-sheet-mockup">
                        {[...Array(24)].map((_, i) => (
                          <div key={i} className="sheet-item">
                            {renderLabelMockup(selectedProduct, true)}
                          </div>
                        ))}
                      </div>
                      <div className="preview-badge">Print Layout: A4 Sheet (3x8)</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="preview-placeholder">
                  <div className="placeholder-icon">🖨️</div>
                  <p>Select a product to visualize your labels here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeGenPage;
