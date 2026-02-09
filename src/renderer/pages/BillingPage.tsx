import { useState, useEffect, useRef } from 'react';
import { useIPC, useIPCMutation } from '../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import type { Product } from '@shared/types/ipc';
import { BillItemList } from '../components/billing/BillItemList';
import { PaymentModeSelector, type PaymentMode } from '../components/billing/PaymentModeSelector';
import { BillHistoryModal } from '../components/billing/BillHistoryModal';
import { calculateBillPreview, formatCurrency, type BillCalculation } from '../utils/billing-math';
import './BillingPage.css';

/**
 * Billing Page
 *
 * Main POS billing interface with:
 * - Product search and selection
 * - Cart management
 * - Real-time bill calculation (via local preview)
 * - Transaction completion
 * - Optional Customer Selection
 * - Payment Mode Selection
 * - Thermal Printing Integration
 *
 * Keyboard shortcut: F2
 */

// Types matching billing-service.ts
interface BillItemInput {
  productId: number;
  quantity: number;
}

interface FinalizeBillInput {
  billNumber?: string;
  customerId?: number;
  items: BillItemInput[];
  discountAmount?: number;
  paymentMode: 'cash' | 'upi' | 'mixed';
  paymentReceived?: number;
}

// Cart item (UI state)
interface CartItem {
  product: Product;
  quantity: number;
}

// Customer Type
interface Customer {
  id: number;
  name: string;
  phone: string;
  balanceDue: number;
}

function BillingPage() {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [calculation, setCalculation] = useState<BillCalculation | null>(null);

  // Customer State
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Keyboard Navigation State
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const checkoutBtnRef = useRef<HTMLButtonElement>(null);

  // Printer State
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');

  // Click Outside Handler for Product Search
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [successMessage, setSuccessMessage] = useState<{
    billNumber: string;
    total: string;
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowProductSearch(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // IPC Hooks
  const {
    data: searchResults,
    loading: searching,
    execute: searchProducts,
  } = useIPC<Product[]>(IPC_CHANNELS.PRODUCT_SEARCH);

  const {
    data: customerResults,
    loading: searchingCustomers,
    execute: searchCustomers,
  } = useIPC<Customer[]>(IPC_CHANNELS.CUSTOMER_SEARCH);

  const { data: printers, execute: fetchPrinters } = useIPC<Electron.PrinterInfo[]>(
    IPC_CHANNELS.PRINTER_LIST
  );

  const {
    loading: finalizing,
    error: finalizingError,
    execute: finalizeBill,
  } = useIPCMutation<FinalizeBillInput, { bill: { id: number; billNumber: string } }>(
    IPC_CHANNELS.BILL_CREATE
  );

  const { execute: printBill } = useIPCMutation<{ billId: number; printerName: string }, boolean>(
    IPC_CHANNELS.BILL_PRINT
  );

  // Focus search input on mount and whenever returning to the page
  // Initial Load (Printers & Focus)
  useEffect(() => {
    // Load Printers
    fetchPrinters();
    const savedPrinter = localStorage.getItem('settings:printer');
    if (savedPrinter) {
      setSelectedPrinter(savedPrinter);
    }

    // Focus Search (Small delay to ensure DOM is ready)
    const timer = setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 300); // Increased delay to 300ms to be safe against page transitions
    return () => clearTimeout(timer);
  }, [fetchPrinters]);

  // Discount State
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>(() => {
    return (localStorage.getItem('billing:discountType') as 'amount' | 'percent') || 'amount';
  });
  const [discountValue, setDiscountValue] = useState<string>(''); // Store as string to handle empty input

  // Update calculation when discount changes
  useEffect(() => {
    let amt = 0;
    const val = parseFloat(discountValue) || 0;

    if (discountType === 'percent') {
      // Calculate percentage of Subtotal + GST
      // Note: calculation object might be null initially
      if (calculation) {
        const baseTotal = calculation.subtotal + calculation.gstTotal;
        amt = Math.round((baseTotal * val) / 100);
      }
    } else {
      amt = val * 100; // Convert to paise
    }

    setDiscountAmount(amt);

    // Persist preference
    localStorage.setItem('billing:discountType', discountType);
  }, [discountValue, discountType, calculation]);

  // Persist Printer Selection
  const handlePrinterChange = (printerName: string) => {
    setSelectedPrinter(printerName);
    localStorage.setItem('settings:printer', printerName);
  };

  // Search products with Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchProducts(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchProducts]);

  // Search customers with Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerQuery.length >= 2) {
        searchCustomers(customerQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerQuery, searchCustomers]);

  // Auto-select first result when results change
  useEffect(() => {
    if (searchResults && searchResults.length > 0) {
      setSelectedResultIndex(0);
    } else {
      setSelectedResultIndex(-1);
    }
  }, [searchResults]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If History or Reset Modal is open, handle appropriately
      if (showHistory || showResetConfirmation) {
        if (e.key === 'Escape') {
          setShowHistory(false);
          setShowResetConfirmation(false);
        }
        return;
      }

      // Global Shortcuts
      switch (e.key) {
        case 'F2':
          e.preventDefault();
          searchInputRef.current?.focus();
          break;
        case 'F4':
          e.preventDefault();
          setShowHistory(true);
          break;
        case 'F9':
          e.preventDefault();
          if (calculation && !finalizing && cart.length > 0) {
            handleCheckout();
          }
          break;
        case 'Escape':
          e.preventDefault();
          // Hierarchy:
          // 1. Clear Search Query
          // 2. Clear Selected Customer
          // 3. Clear Cart (with confirmation)

          if (searchQuery) {
            setSearchQuery('');
            setSelectedResultIndex(-1);
            searchInputRef.current?.focus();
          } else if (selectedCustomer) {
            setSelectedCustomer(null);
          } else if (cart.length > 0) {
            setShowResetConfirmation(true);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    calculation,
    finalizing,
    searchQuery,
    selectedCustomer,
    cart,
    showHistory,
    showCustomerSearch,
    showResetConfirmation,
  ]);

  // Search Input Navigation
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!searchResults || searchResults.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedResultIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedResultIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();

      // If we have a selected result, add it
      if (selectedResultIndex !== -1 && searchResults && searchResults[selectedResultIndex]) {
        addToCart(searchResults[selectedResultIndex]);
        return;
      }
    }
  };

  // Recalculate bill PREVIEW instantly when cart or discount changes
  useEffect(() => {
    if (cart.length > 0) {
      const preview = calculateBillPreview(cart, discountAmount);
      setCalculation(preview);
    } else {
      setCalculation(null);
    }
  }, [cart, discountAmount]);

  // Add product to cart
  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.product.id === product.id);

    if (existingItem) {
      // Increment quantity
      setCart(
        cart.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      // Add new item
      setCart([...cart, { product, quantity: 1 }]);
    }

    // Clear search and refocus for next item relative to current input
    setSearchQuery('');
    setSelectedResultIndex(-1);
    searchInputRef.current?.focus();
  };

  // Update cart item quantity
  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      setCart(cart.map((item) => (item.product.id === productId ? { ...item, quantity } : item)));
    }
  };

  // Remove item from cart
  const removeFromCart = (productId: number) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  // Reset Bill State (Next Sale)
  const resetBill = () => {
    setCart([]);
    setDiscountAmount(0);
    setDiscountValue('');
    // Do not reset discountType, keep user preference
    setCalculation(null);
    setSelectedCustomer(null);
    setPaymentMode('cash');
    setSearchQuery('');
    setSelectedResultIndex(-1);

    // Simple focus is enough now since we are not leaving the window context
    // But we keep a tiny delay just to be safe with React state updates
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 50);
  };

  // Complete transaction
  const handleCheckout = async () => {
    if (!calculation || cart.length === 0 || finalizing) {
      return;
    }

    // We no longer generate bill number here on the client side.
    // The server handles it safely to avoid collisions.

    const input: FinalizeBillInput = {
      // billNumber is now optional and generated by server if omitted
      customerId: selectedCustomer?.id,
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      })),
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      paymentMode,
    };

    const result = await finalizeBill(input);

    if (result) {
      // 1. Trigger Print (Silent) - Fire and forget
      printBill({
        billId: result.bill.id,
        printerName: selectedPrinter,
      }).catch((err) => {
        console.error('Print failed', err);
        alert('Bill saved, but printing failed. Please reprint from dashboard.');
      });

      // 2. Show Success Notification (Non-blocking)
      setSuccessMessage({
        billNumber: result.bill.billNumber,
        total: formatCurrency(calculation.grandTotal),
      });

      // 3. Reset UI for next sale
      resetBill();

      // 4. Auto-hide success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    }
  };

  return (
    <div className="page billing-page">
      {/* Success Message Banner */}
      {successMessage && (
        <div className="success-banner" onClick={() => setSuccessMessage(null)}>
          <div className="success-content">
            <span className="success-icon">✅</span>
            <div className="success-details">
              <strong>Bill #{successMessage.billNumber} Saved!</strong>
              <span>Total: ₹{successMessage.total}</span>
            </div>
          </div>
          <button className="close-success">&times;</button>
        </div>
      )}

      <header className="page-header">
        <h1 className="page-title">Billing - New Sale</h1>

        {/* Customer Section in Header */}
        <div
          className="header-actions"
          style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}
        >
          {/* History Button */}
          <button
            onClick={() => setShowHistory(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 1rem',
              background: '#f8fafc',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#475569',
              transition: 'all 0.2s',
            }}
            className="hover:bg-gray-100"
          >
            <span>🕒</span>
            <span>History (F4)</span>
          </button>

          {/* Printer Selector */}
          <div className="printer-selector">
            <select
              value={selectedPrinter}
              onChange={(e) => handlePrinterChange(e.target.value)}
              style={{
                padding: '0.4rem',
                fontSize: '0.9rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                maxWidth: '150px',
              }}
            >
              <option value="">Default Printer</option>
              {printers?.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} {p.isDefault ? '(Default)' : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedCustomer ? (
            <div
              className="selected-customer-badge"
              style={{
                background: '#e0f2fe',
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                border: '1px solid #bae6fd',
              }}
            >
              <span style={{ fontWeight: 600, color: '#0369a1' }}>{selectedCustomer.name}</span>
              <span style={{ fontSize: '0.85rem', color: '#0c4a6e' }}>
                ({selectedCustomer.phone})
              </span>
              <button
                onClick={() => setSelectedCustomer(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#0369a1',
                  fontWeight: 'bold',
                  padding: '0 0.25rem',
                }}
              >
                ×
              </button>
            </div>
          ) : (
            <div className="customer-search" style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Customer (Optional)"
                className="customer-search-input"
                value={customerQuery}
                onChange={(e) => {
                  setCustomerQuery(e.target.value);
                  setShowCustomerSearch(true);
                }}
                onFocus={() => setShowCustomerSearch(true)}
                onBlur={() => setTimeout(() => setShowCustomerSearch(false), 200)} // Delay to allow click
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #d1d5db',
                  fontSize: '0.9rem',
                  width: '200px',
                }}
              />

              {/* Customer Search Results Dropdown */}
              {showCustomerSearch && customerQuery.length >= 2 && customerResults && (
                <div
                  className="customer-results-dropdown"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    width: '300px',
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 6px -1px update(0, 0, 0, 0.1)',
                    zIndex: 20,
                    marginTop: '0.25rem',
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}
                >
                  {searchingCustomers ? (
                    <div style={{ padding: '0.5rem', color: '#6b7280' }}>Searching...</div>
                  ) : customerResults.length > 0 ? (
                    customerResults.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerQuery('');
                          setShowCustomerSearch(false);
                        }}
                        style={{
                          padding: '0.5rem 0.75rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f3f4f6',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                        className="hover:bg-gray-50"
                      >
                        <span style={{ fontWeight: 500 }}>{c.name}</span>
                        <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{c.phone}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '0.5rem', color: '#6b7280' }}>No customer found</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="billing-content">
        {/* 1. Search Section (Full Width Top) */}
        <div className="search-panel" ref={searchContainerRef}>
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder="Search Item (F2) - Name / SKU / Barcode"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowProductSearch(true);
            }}
            onFocus={() => setShowProductSearch(true)}
            onKeyDown={handleSearchKeyDown}
            autoFocus
          />

          {/* Absolute dropdown for results */}
          <div className="search-results-container">
            {searching && <div className="loading">Searching...</div>}

            {showProductSearch &&
              searchQuery.length >= 2 &&
              searchResults &&
              searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map((product, index) => (
                    <div
                      key={product.id}
                      className={`product-item ${index === selectedResultIndex ? 'selected' : ''}`}
                      onClick={() => addToCart(product)}
                    >
                      <span className="product-name">{product.name}</span>
                      <span className="product-meta">
                        Stock: {product.stockQty} • SKU: {product.sku}
                      </span>
                      <span className="product-price">₹{formatCurrency(product.salePrice)}</span>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>

        {/* 2. Bill Items List (Left Column) */}
        <div className="cart-panel">
          <BillItemList cart={cart} onUpdateQuantity={updateQuantity} onRemove={removeFromCart} />
        </div>

        {/* 3. Totals & Actions (Right Column) */}
        <div className="totals-panel">
          <div className="totals-area">
            <div className="summary-row">
              <span>Subtotal</span>
              <span>₹{calculation ? formatCurrency(calculation.subtotal) : '0.00'}</span>
            </div>
            <div className="summary-row">
              <span>GST</span>
              <span>₹{calculation ? formatCurrency(calculation.gstTotal) : '0.00'}</span>
            </div>
            <div className="summary-row">
              <span>Discount</span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '0.5rem',
                }}
              >
                <div
                  className="toggle-switch"
                  style={{
                    display: 'flex',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.25rem',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    onClick={() => setDiscountType('amount')}
                    style={{
                      padding: '0.1rem 0.4rem',
                      background: discountType === 'amount' ? '#e0f2fe' : 'white',
                      color: discountType === 'amount' ? '#0369a1' : '#64748b',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: discountType === 'amount' ? 600 : 400,
                    }}
                  >
                    ₹
                  </button>
                  <button
                    onClick={() => setDiscountType('percent')}
                    style={{
                      padding: '0.1rem 0.4rem',
                      background: discountType === 'percent' ? '#e0f2fe' : 'white',
                      color: discountType === 'percent' ? '#0369a1' : '#64748b',
                      border: 'none',
                      borderLeft: '1px solid #d1d5db',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: discountType === 'percent' ? 600 : 400,
                    }}
                  >
                    %
                  </button>
                </div>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="0"
                  style={{ width: '80px', textAlign: 'right', fontSize: '1.2rem' }}
                />
              </div>
            </div>

            <div className="summary-row grand-total">
              <span>₹{calculation ? formatCurrency(calculation.grandTotal) : '0.00'}</span>
            </div>
          </div>

          <div className="actions-area">
            <PaymentModeSelector
              currentMode={paymentMode}
              onModeChange={setPaymentMode}
              disabled={finalizing}
            />

            {finalizingError && (
              <div
                className="error-message"
                style={{
                  color: '#ef4444',
                  marginBottom: '0.5rem',
                  textAlign: 'right',
                  fontSize: '0.9rem',
                }}
              >
                Error: {finalizingError}
              </div>
            )}

            <button
              ref={checkoutBtnRef}
              className="btn-pay"
              disabled={finalizing || cart.length === 0}
              onClick={handleCheckout}
            >
              {finalizing ? 'Processing...' : `PAY (F9)`}
            </button>
          </div>

          {/* Shortcuts Legend */}
          <div
            className="shortcuts-legend"
            style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: '#f8fafc',
              borderRadius: '0.5rem',
              fontSize: '0.75rem',
              color: '#64748b',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem',
            }}
          >
            <div>
              <strong style={{ color: '#475569' }}>F2</strong> Focus Search
            </div>
            <div>
              <strong style={{ color: '#475569' }}>Enter</strong> Add Item
            </div>
            <div>
              <strong style={{ color: '#475569' }}>F9</strong> Pay & Print
            </div>
            <div>
              <strong style={{ color: '#475569' }}>Esc</strong> Clear / Reset
            </div>
          </div>
        </div>
      </div>

      {showHistory && (
        <BillHistoryModal onClose={() => setShowHistory(false)} printerName={selectedPrinter} />
      )}

      {/* Custom Reset Confirmation Modal */}
      {showResetConfirmation && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 2000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            className="modal-content"
            style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '0.5rem',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              width: '350px',
              textAlign: 'center',
            }}
          >
            <h3 style={{ marginTop: 0 }}>Clear Bill?</h3>
            <p>Are you sure you want to discard the current sale?</p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '1rem',
                marginTop: '1.5rem',
              }}
            >
              <button
                onClick={() => setShowResetConfirmation(false)}
                style={{
                  padding: '0.5rem 1.5rem',
                  borderRadius: '0.25rem',
                  border: '1px solid #d1d5db',
                  background: 'white',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowResetConfirmation(false);
                  resetBill();
                }}
                autoFocus
                style={{
                  padding: '0.5rem 1.5rem',
                  borderRadius: '0.25rem',
                  border: 'none',
                  background: '#ef4444',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Clear Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BillingPage;
