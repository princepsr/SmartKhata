import { useState } from 'react';
import { useIPC } from '../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { Product } from '@shared/types/ipc';
import './BarcodeGenPage.css';

function BarcodeGenPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [labelCount, setLabelCount] = useState(12);

  const { data: searchResults, execute: searchProducts } = useIPC<{ items: Product[] }>(
    IPC_CHANNELS.PRODUCT_SEARCH
  );

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (q.length > 1) {
      searchProducts({ query: q });
    }
  };

  const handlePrint = async () => {
    if (!selectedProduct) return;
    // Call main process to generate PDF and show print dialog
    await window.api.invoke(IPC_CHANNELS.UTILITY_GENERATE_BARCODE, {
      productId: selectedProduct.id,
      count: labelCount,
    });
  };

  return (
    <div className="page barcode-gen-page animate-fade-in">
      <header className="page-header">
        <div className="header-info">
          <h1 className="page-title">Barcode Label Generator</h1>
          <p className="page-subtitle">Print labels for your products</p>
        </div>
      </header>

      <div className="page-content barcode-layout">
        <div className="selection-panel card">
          <h3>1. Select Product</h3>
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
          />
          <div className="search-results-mini">
            {searchResults?.items.map((p) => (
              <div
                key={p.id}
                className={`mini-result ${selectedProduct?.id === p.id ? 'active' : ''}`}
                onClick={() => setSelectedProduct(p)}
              >
                <span>{p.name}</span>
                <span className="text-xs text-gray">{p.sku || 'No SKU'}</span>
              </div>
            ))}
          </div>

          <div className="label-controls" style={{ marginTop: '2rem' }}>
            <h3>2. Print Settings</h3>
            <div className="form-group">
              <label>Number of Labels</label>
              <input
                type="number"
                value={labelCount}
                onChange={(e) => setLabelCount(parseInt(e.target.value))}
                min={1}
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '1rem' }}
              disabled={!selectedProduct}
              onClick={handlePrint}
            >
              Generate & Print Labels
            </button>
          </div>
        </div>

        <div className="preview-panel card">
          <h3>Preview</h3>
          {selectedProduct ? (
            <div className="barcode-preview">
              <div className="preview-label">
                <div className="label-store">{selectedProduct.name}</div>
                <div className="label-barcode-placeholder">
                  || ||| | || ||| || ||
                  <div className="barcode-text">
                    {selectedProduct.barcode || selectedProduct.sku || '12345678'}
                  </div>
                </div>
                <div className="label-price">
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
                    selectedProduct.salePrice
                  )}
                </div>
              </div>
              <p className="preview-hint">
                Actual labels will use standard 38mm x 25mm dimensions.
              </p>
            </div>
          ) : (
            <div className="empty-preview">Select a product to see label preview</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BarcodeGenPage;
