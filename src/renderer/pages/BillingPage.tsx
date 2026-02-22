import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIPC, useIPCMutation } from '../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import type { Product } from '@shared/types/ipc';
import { BillItemList } from '../components/billing/BillItemList';
import { PaymentModeSelector, type PaymentMode } from '../components/billing/PaymentModeSelector';
import { BillHistoryModal } from '../components/billing/BillHistoryModal';
import {
  calculateBillPreview,
  formatCurrency,
  type BillCalculation,
  calculateDiscountAmount,
} from '../utils/billing-math';
import './BillingPage.css';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAppSettingsStore } from '../store';
import { reportApi } from '@renderer/services/report-api';
import type { DailySalesSummary } from '@shared/types/report.types';

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
  // Settings (for billing-only mode)
  const { settings } = useAppSettingsStore();

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

  // Click Outside Handler for Product Search
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [successMessage, setSuccessMessage] = useState<{
    billNumber: string;
    total: string;
  } | null>(null);

  // Dashboard State
  const [todaySummary, setTodaySummary] = useState<DailySalesSummary | null>(null);

  // Alert State (for custom styled alerts)
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'warning' | 'danger' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
  });

  const [searchParams, setSearchParams] = useSearchParams();

  // Handle global actions
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'clear-cart') {
      setCart([]);
      setDiscountAmount(0);
      setSelectedCustomer(null);
      // Remove param
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    } else if (action === 'history') {
      setShowHistory(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowProductSearch(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
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

  const {
    loading: finalizing,
    error: finalizingError,
    execute: finalizeBill,
  } = useIPCMutation<FinalizeBillInput, { bill: { id: number; billNumber: string } }>(
    IPC_CHANNELS.BILL_CREATE
  );

  // Initial Load (Focus)
  useEffect(() => {
    // Focus Search (Small delay to ensure DOM is ready)
    const timer = setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 300); // Increased delay to 300ms to be safe against page transitions
    return () => clearTimeout(timer);
  }, []);

  // Fetch Today's Summary
  const fetchTodaySummary = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const summary = await reportApi.getDailySalesSummary({ startDate: today, endDate: today });
      setTodaySummary(summary);
    } catch (err) {
      console.error('Failed to fetch today summary:', err);
    }
  }, []);

  useEffect(() => {
    fetchTodaySummary();
  }, [fetchTodaySummary]);

  // Update cart item quantity
  const updateQuantity = useCallback(
    (productId: number, quantity: number) => {
      if (quantity <= 0) {
        setCart((prev) => prev.filter((item) => item.product.id !== productId));
      } else {
        setCart((prev) =>
          prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
        );
      }
    },
    [setCart]
  );

  // Remove item from cart
  const removeFromCart = useCallback(
    (productId: number) => {
      setCart((prev) => prev.filter((item) => item.product.id !== productId));
    },
    [setCart]
  );

  // Add product to cart
  const addToCart = useCallback(
    (product: Product) => {
      // Check for out of stock (accounting for what's already in cart)
      setCart((prevCart) => {
        const existingItem = prevCart.find((item) => item.product.id === product.id);
        const currentQtyInCart = existingItem ? existingItem.quantity : 0;

        // Skip stock check in billing-only mode OR if product doesn't track inventory
        if (
          !settings.billingOnly &&
          product.trackInventory &&
          currentQtyInCart + 1 > product.stockQty
        ) {
          setAlertState({
            isOpen: true,
            title: 'Out of Stock',
            message: `"${product.name}" only has ${product.stockQty} available.`,
            type: 'warning',
          });
          return prevCart;
        }

        if (existingItem) {
          // Increment quantity
          return prevCart.map((item) =>
            item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        } else {
          // Add new item
          return [...prevCart, { product, quantity: 1 }];
        }
      });

      // Clear search and refocus for next item relative to current input
      setSearchQuery('');
      setSelectedResultIndex(-1);
      searchInputRef.current?.focus();
    },
    [settings.billingOnly, searchInputRef]
  );

  useEffect(() => {
    fetchTodaySummary();
  }, [fetchTodaySummary]);

  // Discount State
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>(() => {
    return (localStorage.getItem('billing:discountType') as 'amount' | 'percent') || 'amount';
  });
  const [discountValue, setDiscountValue] = useState<string>(''); // Store as string to handle empty input

  // Update calculation when discount changes
  useEffect(() => {
    let amt = 0;
    // const val = parseFloat(discountValue) || 0; // Unused after refactor

    if (calculation) {
      amt = calculateDiscountAmount(
        discountType,
        discountValue,
        calculation.subtotal,
        calculation.gstTotal
      );
    } else {
      // If no calculation yet, just handle fixed amount
      if (discountType === 'amount') {
        amt = (parseFloat(discountValue) || 0) * 100;
      }
    }

    setDiscountAmount(amt);

    // Persist preference
    localStorage.setItem('billing:discountType', discountType);
  }, [discountValue, discountType, calculation]);

  // Search products with Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchProducts({ query: searchQuery, includeInactive: false });
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
    if (searchResults && searchResults.length === 1 && searchQuery.length >= 3) {
      const product = searchResults[0];
      const query = searchQuery.toLowerCase();

      // Auto-add if it's an exact SKU/Barcode match OR a very likely name match
      const isExactMatch =
        product.sku?.toLowerCase() === query || product.barcode?.toLowerCase() === query;

      if (isExactMatch) {
        addToCart(product);
      }
    }

    if (searchResults && searchResults.length > 0) {
      setSelectedResultIndex(0);
    } else {
      setSelectedResultIndex(-1);
    }
  }, [searchResults, searchQuery, addToCart]);

  // Reset Bill State (Next Sale)
  const resetBill = useCallback(() => {
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
  }, [searchInputRef]);

  // Complete transaction
  const handleCheckout = useCallback(async () => {
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
      // 1. Automatic Printing is now handled by the backend 'bill:create' handler
      // based on the user's 'autoPrint' setting. Manual call removed to prevent duplicates.

      // 2. Show Success Notification (Non-blocking)
      setSuccessMessage({
        billNumber: result.bill.billNumber,
        total: formatCurrency(calculation.grandTotal),
      });

      // 3. Reset UI for next sale
      resetBill();
      fetchTodaySummary();

      // 4. Auto-hide success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    }
  }, [
    calculation,
    cart,
    finalizing,
    selectedCustomer,
    discountAmount,
    paymentMode,
    finalizeBill,
    resetBill,
    fetchTodaySummary,
  ]);

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
    handleCheckout,
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

  return (
    <div className="page billing-page">
      <div className="page-content-wrapper animate-fade-in">
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

          {/* Actions & Customer Section (Right aligned) */}
          <div className="header-actions">
            {/* 1. Search Section (Primary focus) */}
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
              <div
                className="search-results-container"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {showProductSearch && searchQuery.length >= 2 && (
                  <div className="search-results">
                    {searching ? (
                      <>
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="skeleton"
                            style={{
                              height: '50px',
                              width: '100%',
                              marginBottom: '4px',
                              borderRadius: 'var(--radius-md)',
                            }}
                          />
                        ))}
                      </>
                    ) : searchResults && searchResults.length > 0 ? (
                      searchResults.map((product, index) => (
                        <div
                          key={product.id}
                          className={`product-item ${index === selectedResultIndex ? 'selected' : ''}`}
                          onClick={() => addToCart(product)}
                        >
                          <span className="product-name">{product.name}</span>
                          <span className="product-meta">
                            SKU: {product.sku || product.barcode || '-'}
                          </span>
                          <div className="product-price">
                            {formatCurrency(product.salePrice)}
                            {!settings.billingOnly && product.trackInventory && (
                              <span
                                className={`search-stock-status ${
                                  product.stockQty <= 0
                                    ? 'out'
                                    : product.stockQty <= (product.lowStockAlert || 0)
                                      ? 'low'
                                      : 'ok'
                                }`}
                              >
                                {product.stockQty <= 0
                                  ? 'Out'
                                  : product.stockQty <= (product.lowStockAlert || 0)
                                    ? `Low (${product.stockQty})`
                                    : `Stock: ${product.stockQty}`}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="no-results" style={{ padding: '1rem', textAlign: 'center' }}>
                        No products found.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* History Button */}
            <button
              onClick={() => setShowHistory(true)}
              className="header-btn"
              title="View Bill History (F4)"
            >
              <span>🕒</span>
              <span>History</span>
            </button>

            {settings.customersEnabled &&
              (selectedCustomer ? (
                <div className="selected-customer-badge">
                  <span style={{ fontWeight: 600 }}>{selectedCustomer.name}</span>
                  <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                    ({selectedCustomer.phone})
                  </span>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: 'inherit',
                      fontWeight: 'bold',
                      padding: '0 0.25rem',
                      marginLeft: 'auto',
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
                    className="header-input"
                    value={customerQuery}
                    onChange={(e) => {
                      setCustomerQuery(e.target.value);
                      setShowCustomerSearch(true);
                    }}
                    onFocus={() => setShowCustomerSearch(true)}
                    onBlur={() => setTimeout(() => setShowCustomerSearch(false), 200)}
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
              ))}
          </div>
        </header>

        <div className="billing-content">
          {/* 2. Bill Items List (Left Column) */}
          <div className="cart-panel">
            <BillItemList cart={cart} onUpdateQuantity={updateQuantity} onRemove={removeFromCart} />
          </div>

          {/* 3. Totals & Actions (Right Column) */}
          <div className="totals-panel">
            <div className="totals-area">
              <div className="summary-row">
                <span>Subtotal</span>
                <span>{calculation ? formatCurrency(calculation.subtotal) : '₹ 0.00'}</span>
              </div>
              <div className="summary-row">
                <span>GST</span>
                <span>{calculation ? formatCurrency(calculation.gstTotal) : '₹ 0.00'}</span>
              </div>
              <div className="summary-row discount-row">
                <span>Discount</span>
                <div className="discount-controls">
                  <div className="discount-toggle-group">
                    <button
                      className={`discount-toggle-btn ${discountType === 'amount' ? 'active' : ''}`}
                      onClick={() => setDiscountType('amount')}
                    >
                      ₹
                    </button>
                    <button
                      className={`discount-toggle-btn ${discountType === 'percent' ? 'active' : ''}`}
                      onClick={() => setDiscountType('percent')}
                    >
                      %
                    </button>
                  </div>
                  <input
                    className="discount-input"
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="summary-row grand-total">
                <span>{calculation ? formatCurrency(calculation.grandTotal) : '₹ 0.00'}</span>
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

            {todaySummary && (
              <div className="billing-mini-dashboard side-panel animate-fade-in">
                <div className="dash-item">
                  <span className="dash-label">Today's Sales</span>
                  <span className="dash-value">{formatCurrency(todaySummary.totalSales)}</span>
                </div>
                <div className="dash-item">
                  <span className="dash-label">Net Sales</span>
                  <span className="dash-value highlight">
                    {formatCurrency(todaySummary.netSales)}
                  </span>
                </div>
                <div className="dash-item">
                  <span className="dash-label">Bills</span>
                  <span className="dash-value">{todaySummary.billCount}</span>
                </div>
              </div>
            )}

            {/* Shortcuts Legend */}
            <div
              className="shortcuts-legend"
              style={{
                padding: '0 1.5rem 1.5rem',
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

        {showHistory && <BillHistoryModal onClose={() => setShowHistory(false)} />}

        {/* Custom Reset Confirmation Modal */}
        {showResetConfirmation && (
          <div className="modal-overlay">
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

      {/* Alert Modal */}
      <ConfirmModal
        isOpen={alertState.isOpen}
        onClose={() => setAlertState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={() => setAlertState((prev) => ({ ...prev, isOpen: false }))}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        isAlert={true}
      />
    </div>
  );
}

export default BillingPage;
