import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIPC, useIPCMutation } from '../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import type { Product, Quotation, CreateQuotationInput } from '@shared/types/ipc';
import { BillItemList } from '../components/billing/BillItemList';
import { PaymentModeSelector, type PaymentMode } from '../components/billing/PaymentModeSelector';
import { BillHistoryModal } from '../components/billing/BillHistoryModal';
import { formatCurrency, toLocalDateISO } from '../utils/formatters';
import {
  calculateBillPreview,
  calculateDiscountAmount,
  BillCalculation,
} from '@shared/utils/billing-math';
import './BillingPage.css';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAppSettingsStore } from '../store';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { reportApi } from '@renderer/services/report-api';
import { medicalApi } from '@renderer/services/medical-api';
import type { DailySalesSummary } from '@shared/types/report.types';
import { ReferralModal } from '../components/modals/ReferralModal';
import { GstReminderModal } from '../components/modals/GstReminderModal';
import { QRCodeSVG } from 'qrcode.react';

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
  discountValue?: number;
  discountType?: 'amount' | 'percent';
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
  discountValue?: number;
  discountType?: 'amount' | 'percent';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const isQuotationMode = searchParams.get('type') === 'quotation';

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useLocalStorage<CartItem[]>('billing_cart', []);
  const [discountAmount, setDiscountAmount] = useLocalStorage('billing_discountAmount', 0);
  const [paymentMode, setPaymentMode] = useLocalStorage<PaymentMode>('billing_paymentMode', 'cash');
  const [amountPaid, setAmountPaid] = useLocalStorage<string>('billing_amountPaid', '');
  const [calculation, setCalculation] = useState<BillCalculation | null>(null);
  const [activeQuotationId, setActiveQuotationId] = useLocalStorage<number | null>(
    'billing_activeQuotationId',
    null
  );
  const { execute: updateQuotationStatus } = useIPCMutation(IPC_CHANNELS.QUOTATION_UPDATE_STATUS);

  // Customer State
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useLocalStorage<Customer | null>(
    'billing_selectedCustomer',
    null
  );
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Keyboard Navigation State
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const checkoutBtnRef = useRef<HTMLButtonElement>(null);

  // Click Outside Handler for Product Search
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const customerSearchContainerRef = useRef<HTMLDivElement>(null);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [successMessage, setSuccessMessage] = useState<{
    billNumber: string;
    total: string;
    received?: string;
    customerName?: string;
  } | null>(null);

  // Discount State
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>(() => {
    return (localStorage.getItem('billing:discountType') as 'amount' | 'percent') || 'percent';
  });
  const [discountValue, setDiscountValue] = useState<string>(''); // Store as string to handle empty input

  // Cart Base Total (Sum of MRPs) for discount calculations
  const cartBaseTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.salePrice * item.quantity, 0);
  }, [cart]);

  // Calculate effective amount for QR and Persistence
  const effectivePaymentAmount = useMemo(() => {
    if (selectedCustomer && amountPaid !== '') {
      const val = parseFloat(amountPaid);
      return isNaN(val) ? 0 : val;
    }
    return calculation?.grandTotal || 0;
  }, [selectedCustomer, amountPaid, calculation]);

  // Update calculation when discount changes
  useEffect(() => {
    const amt = calculateDiscountAmount(discountType, discountValue, cartBaseTotal);
    setDiscountAmount(amt);

    // Persist preference
    localStorage.setItem('billing:discountType', discountType);
  }, [discountValue, discountType, cartBaseTotal, setDiscountAmount]);

  // Dashboard State
  const [todaySummary, setTodaySummary] = useState<DailySalesSummary | null>(null);

  // Medical Alternatives State
  const [saltAlternatives, setSaltAlternatives] = useState<Product[]>([]);

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
  }, [
    searchParams,
    setSearchParams,
    setCart,
    setDiscountAmount,
    setSelectedCustomer,
    setShowHistory,
  ]);

  // Handle Quotation Conversion
  const quotationId = searchParams.get('quotationId');
  const { execute: getQuotationWithItems } = useIPCMutation(IPC_CHANNELS.QUOTATION_GET_WITH_ITEMS);
  const { execute: getCustomer } = useIPCMutation(IPC_CHANNELS.CUSTOMER_GET);

  useEffect(() => {
    if (quotationId) {
      const loadQuotation = async () => {
        try {
          const result = (await getQuotationWithItems(Number(quotationId))) as any;
          if (result && result.quotation) {
            // Map items to cart
            const newCart = result.items.map((item: any) => ({
              product: {
                id: item.productId,
                name: item.productName,
                salePrice: item.unitPrice,
                gstPercent: item.gstPercent,
                uom: item.uom || 'Pcs',
                isWeightBased: !!item.isWeightBased,
                stripSize: item.stripSize || 1,
                saltName: item.saltName,
                drugCategory: item.drugCategory,
                isActive: true,
                isGstInclusive: !!item.isGstInclusive,
                trackInventory: !!item.trackInventory,
              } as Product,
              quantity: item.quantity,
              discountValue: item.discountValue || 0,
              discountType: item.discountType || 'percent',
            }));
            setCart(newCart);

            setActiveQuotationId(Number(quotationId));
            if (result.quotation.billDiscountValue) {
              setDiscountValue(result.quotation.billDiscountValue.toString());
              setDiscountType(result.quotation.billDiscountType || 'percent');
            }

            // Set customer if exists
            if (result.quotation.customerId) {
              const customerResult = (await getCustomer(result.quotation.customerId)) as any;
              if (customerResult) {
                setSelectedCustomer(customerResult);
              }
            }

            // Remove quotationId from URL to prevent re-triggering if user navigates back
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('quotationId');
            setSearchParams(newParams, { replace: true });
          }
        } catch (err) {
          console.error('Failed to load quotation for conversion', err);
        }
      };
      loadQuotation();
    }
  }, [
    quotationId,
    getQuotationWithItems,
    getCustomer,
    setCart,
    setSelectedCustomer,
    searchParams,
    setSearchParams,
    setActiveQuotationId,
    setDiscountValue,
    setDiscountType,
  ]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowProductSearch(false);
      }
      if (
        customerSearchContainerRef.current &&
        !customerSearchContainerRef.current.contains(event.target as Node)
      ) {
        setShowCustomerSearch(false);
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
  } = useIPC<{ items: Product[]; totalCount: number; hasMore: boolean }>(
    IPC_CHANNELS.PRODUCT_SEARCH
  );

  const {
    data: customerResults,
    loading: searchingCustomers,
    execute: searchCustomers,
  } = useIPC<{ items: Customer[]; totalCount: number; hasMore: boolean }>(
    IPC_CHANNELS.CUSTOMER_SEARCH
  );

  const {
    loading: finalizing,
    error: finalizingError,
    execute: finalizeBill,
  } = useIPCMutation<FinalizeBillInput, { bill: { id: number; billNumber: string } }>(
    IPC_CHANNELS.BILL_CREATE
  );

  const {
    loading: creatingQuotation,
    error: quotationError,
    execute: createQuotation,
  } = useIPCMutation<CreateQuotationInput, Quotation>(IPC_CHANNELS.QUOTATION_CREATE);

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
      const today = toLocalDateISO();
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

  // Update cart item discount
  const updateDiscount = useCallback(
    (productId: number, value: number, type: 'amount' | 'percent') => {
      setCart((prev) =>
        prev.map((item) =>
          item.product.id === productId
            ? { ...item, discountValue: value, discountType: type }
            : item
        )
      );
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

        // Medical Specialization: Drug Warnings
        if (product.drugCategory && ['H', 'H1', 'X', 'G'].includes(product.drugCategory)) {
          setAlertState({
            isOpen: true,
            title: `Schedule ${product.drugCategory} Drug Warning`,
            message: `"${product.name}" is a controlled drug. Ensure you have a valid prescription and record doctor details if required.`,
            type: 'warning',
          });
        }

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
          // Add new item (Default to percent discount)
          return [...prevCart, { product, quantity: 1, discountType: 'percent' }];
        }
      });

      // Clear search and refocus for next item relative to current input
      setSearchQuery('');
      setSelectedResultIndex(-1);
      searchInputRef.current?.focus();
    },
    [
      settings.billingOnly,
      searchInputRef,
      setCart,
      setAlertState,
      setSearchQuery,
      setSelectedResultIndex,
    ]
  );

  // Search products with Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 1) {
        searchProducts({ query: searchQuery, includeInactive: false });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchProducts]);

  // Search customers with Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerQuery.length >= 1) {
        searchCustomers({ query: customerQuery });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerQuery, searchCustomers]);

  // Auto-select first result when results change
  useEffect(() => {
    if (searchResults?.items && searchResults.items.length === 1 && searchQuery.length >= 1) {
      const product = searchResults.items[0];
      const query = searchQuery.toLowerCase();

      // Auto-add if it's an exact SKU/Barcode match OR a very likely name match
      const isExactMatch =
        product.sku?.toLowerCase() === query || product.barcode?.toLowerCase() === query;

      if (isExactMatch) {
        addToCart(product);
      }
    }

    if (searchResults?.items && searchResults.items.length > 0) {
      setSelectedResultIndex(0);
    } else {
      setSelectedResultIndex(-1);
    }
  }, [searchResults, searchQuery, addToCart]);

  // Fetch alternatives when selected index changes
  useEffect(() => {
    const fetchAlternatives = async () => {
      if (
        settings.appMode === 'MEDICAL' &&
        searchResults?.items &&
        selectedResultIndex !== -1 &&
        searchResults.items[selectedResultIndex]
      ) {
        const product = searchResults.items[selectedResultIndex];
        if (product.saltName) {
          const alternatives = await medicalApi.getAlternatives(product.saltName, product.id);

          // Deduplicate: Don't show products that are already in the main search results
          const mainResultIds = new Set(searchResults.items.map((p) => p.id));
          const filteredAlternatives = alternatives.filter((alt) => !mainResultIds.has(alt.id));

          setSaltAlternatives(filteredAlternatives);
        } else {
          setSaltAlternatives([]);
        }
      } else {
        setSaltAlternatives([]);
      }
    };

    fetchAlternatives();
  }, [selectedResultIndex, searchResults, settings.appMode]);

  // Reset Bill State (Next Sale)
  const resetBill = useCallback(() => {
    setCart([]);
    setDiscountAmount(0);
    setDiscountValue('');
    // Do not reset discountType, keep user preference
    setCalculation(null);
    setSelectedCustomer(null);
    setPaymentMode('cash');
    setAmountPaid('');
    setActiveQuotationId(null);
    setSearchQuery('');
    setSelectedResultIndex(-1);

    // Simple focus is enough now since we are not leaving the window context
    // But we keep a tiny delay just to be safe with React state updates
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 50);
  }, [
    searchInputRef,
    setCart,
    setDiscountAmount,
    setDiscountValue,
    setCalculation,
    setSelectedCustomer,
    setPaymentMode,
    setAmountPaid,
    setSearchQuery,
    setSelectedResultIndex,
    setActiveQuotationId,
  ]);

  // Complete transaction
  const handleCheckout = useCallback(async () => {
    if (!calculation || cart.length === 0 || finalizing) {
      return;
    }

    const input: FinalizeBillInput = {
      customerId: selectedCustomer?.id,
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        discountValue: item.discountValue,
        discountType: item.discountType,
      })),
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      paymentMode,
      paymentReceived: effectivePaymentAmount,
    };

    if (isQuotationMode) {
      const result = await createQuotation({
        customerId: selectedCustomer?.id,
        items: input.items,
        billDiscountValue: parseFloat(discountValue) || 0,
        billDiscountType: discountType,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days valid
        notes: 'Generated from Billing Page',
      });

      if (result) {
        setSuccessMessage({
          billNumber: result.quotationNumber,
          total: formatCurrency(calculation.grandTotal),
          customerName: selectedCustomer?.name,
        });
        resetBill();

        setTimeout(() => {
          setSuccessMessage(null);
        }, 5000);
      }
      return;
    }

    const result = await finalizeBill(input);

    if (result) {
      // If we were converting a quotation, mark it as CONVERTED
      if (activeQuotationId) {
        try {
          await updateQuotationStatus({ id: activeQuotationId, status: 'CONVERTED' });
          setActiveQuotationId(null);
        } catch (err) {
          console.error('Failed to update quotation status to CONVERTED', err);
        }
      }

      setSuccessMessage({
        billNumber: result.bill.billNumber,
        total: formatCurrency(calculation.grandTotal),
        received: formatCurrency(effectivePaymentAmount),
        customerName: selectedCustomer?.name,
      });

      resetBill();
      fetchTodaySummary();

      setTimeout(() => {
        setSuccessMessage(null);
      }, 6000);
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
    isQuotationMode,
    discountValue,
    discountType,
    effectivePaymentAmount,
    setSuccessMessage,
    createQuotation,
    activeQuotationId,
    updateQuotationStatus,
    setActiveQuotationId,
  ]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showHistory || showResetConfirmation) {
        if (e.key === 'Escape') {
          setShowHistory(false);
          setShowResetConfirmation(false);
        }
        return;
      }

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
    showResetConfirmation,
    handleCheckout,
    setSelectedCustomer,
    setShowHistory,
    setShowResetConfirmation,
    setSearchQuery,
    setSelectedResultIndex,
  ]);

  // Search Input Navigation
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!searchResults?.items || searchResults.items.length === 0) {
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedResultIndex((prev) => (prev < searchResults.items.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedResultIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();

        // If we have a selected result, add it
        if (
          selectedResultIndex !== -1 &&
          searchResults?.items &&
          searchResults.items[selectedResultIndex]
        ) {
          addToCart(searchResults.items[selectedResultIndex]);
        }
      }
    },
    [searchResults, selectedResultIndex, addToCart, setSelectedResultIndex]
  );

  // Recalculate bill PREVIEW instantly when cart or discount changes
  useEffect(() => {
    if (cart.length > 0) {
      const preview = calculateBillPreview(
        cart,
        discountAmount,
        settings.gstEnabled,
        settings.gstExclusiveMode,
        settings.supplyType
      );
      setCalculation(preview);
    } else {
      setCalculation(null);
    }
  }, [
    cart,
    discountAmount,
    settings.gstEnabled,
    settings.gstExclusiveMode,
    settings.supplyType,
    setCalculation,
  ]);

  return (
    <div className="page billing-page">
      <div className="page-content-wrapper animate-fade-in">
        {/* 1. Header & Actions */}
        <header className="page-header sticky-header">
          <div className="page-title">
            <span>Billing</span>
            {isQuotationMode && <span className="badge-quotation">QUOTATION MODE</span>}
          </div>

          <div className="header-actions">
            {/* Success Message Banner */}
            {successMessage && (
              <div className="success-banner" onClick={() => setSuccessMessage(null)}>
                <div className="success-content">
                  <div className="success-icon">✓</div>
                  <div className="success-details">
                    <strong>
                      {isQuotationMode ? 'Quotation' : 'Bill'} #{successMessage.billNumber} Saved
                    </strong>
                    <span>
                      {successMessage.received
                        ? `Received ${successMessage.received} (Total ${successMessage.total})`
                        : `Total ${successMessage.total}`}{' '}
                      | {successMessage.customerName || 'Cash'}
                    </span>
                  </div>
                </div>
                <button className="close-success">×</button>
              </div>
            )}

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
                {showProductSearch && searchQuery.length >= 1 && (
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
                    ) : searchResults?.items && searchResults.items.length > 0 ? (
                      searchResults.items.map((product, index) => (
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
                            {formatCurrency(product.salePrice)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="no-results" style={{ padding: '1rem', textAlign: 'center' }}>
                        No products found.
                      </div>
                    )}

                    {/* Salt Alternatives Partition */}
                    {settings.appMode === 'MEDICAL' && saltAlternatives.length > 0 && (
                      <div className="salt-alternatives-section">
                        <div className="salt-alternatives-header">
                          💊 Alternatives with same Salt ({saltAlternatives[0].saltName})
                        </div>
                        {saltAlternatives.map((alt) => (
                          <div
                            key={alt.id}
                            className="product-item alt"
                            onClick={() => addToCart(alt)}
                          >
                            <span className="product-name">{alt.name}</span>
                            <span className="product-meta">
                              {alt.sku || alt.barcode || 'Shared Salt'}
                            </span>
                            <div className="product-price">
                              {!settings.billingOnly && alt.trackInventory && (
                                <span
                                  className={`search-stock-status ${
                                    alt.stockQty <= 0
                                      ? 'out'
                                      : alt.stockQty <= (alt.lowStockAlert || 0)
                                        ? 'low'
                                        : 'ok'
                                  }`}
                                >
                                  {alt.stockQty <= 0
                                    ? 'Out'
                                    : alt.stockQty <= (alt.lowStockAlert || 0)
                                      ? `Low (${alt.stockQty})`
                                      : `Stock: ${alt.stockQty}`}
                                </span>
                              )}
                              {formatCurrency(alt.salePrice)}
                            </div>
                          </div>
                        ))}
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
                <div
                  className="customer-search"
                  style={{ position: 'relative' }}
                  ref={customerSearchContainerRef}
                >
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
                  />
                  {/* Customer Search Results Dropdown */}
                  {showCustomerSearch && customerQuery.length >= 1 && customerResults?.items && (
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
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        zIndex: 20,
                        marginTop: '0.25rem',
                        maxHeight: '200px',
                        overflowY: 'auto',
                      }}
                    >
                      {searchingCustomers ? (
                        <div style={{ padding: '0.5rem', color: '#6b7280' }}>Searching...</div>
                      ) : customerResults.items.length > 0 ? (
                        customerResults.items.map((c) => (
                          <div
                            key={c.id}
                            onMouseDown={(e) => {
                              // Use onMouseDown to trigger selection before onBlur (not needed with click-outside but more robust)
                              e.preventDefault(); // Prevent input blur if triggered
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
            <BillItemList
              cart={cart}
              calculatedItems={calculation?.items || []}
              onUpdateQuantity={updateQuantity}
              onUpdateDiscount={updateDiscount}
              onRemove={removeFromCart}
            />
          </div>

          {/* 3. Totals & Actions (Right Column) */}
          <div className="totals-panel">
            <div className="totals-area">
              <div className="summary-row">
                <span>Subtotal</span>
                <span>{calculation ? formatCurrency(calculation.subtotal) : '₹ 0.00'}</span>
              </div>
              {settings.gstEnabled && (
                <div className="summary-row gst-row">
                  <span>GST</span>
                  <span>{calculation ? formatCurrency(calculation.gstTotal) : '₹ 0.00'}</span>
                </div>
              )}

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
              {settings.customersEnabled && selectedCustomer && (
                <div className="amount-paid-section">
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      color: '#64748b',
                      marginBottom: '0.25rem',
                      textAlign: 'left',
                    }}
                  >
                    Amount Received (₹)
                  </label>
                  <input
                    type="number"
                    className="header-input"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder={calculation ? calculation.grandTotal.toString() : '0'}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                  {amountPaid !== '' &&
                    calculation &&
                    parseFloat(amountPaid) < calculation.grandTotal && (
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: '#d97706',
                          marginTop: '0.25rem',
                          textAlign: 'left',
                        }}
                      >
                        Udhaar Added:{' '}
                        {formatCurrency(calculation.grandTotal - parseFloat(amountPaid))}
                      </div>
                    )}
                </div>
              )}

              <PaymentModeSelector
                currentMode={paymentMode}
                onModeChange={setPaymentMode}
                disabled={finalizing}
              />

              {/* Dynamic UPI QR Code */}
              {paymentMode === 'upi' && calculation && calculation.grandTotal > 0 && (
                <div
                  className="upi-qr-container animate-fade-in"
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.5rem 0.75rem',
                    background: 'white',
                    borderRadius: '0.5rem',
                    border: '1px solid #e2e8f0',
                    marginBottom: '0.5rem',
                  }}
                >
                  {settings.upiId ? (
                    <>
                      <div
                        style={{
                          background: 'white',
                          padding: '0.5rem',
                          borderRadius: '0.5rem',
                          border: '1px solid #e2e8f0',
                          marginBottom: '0.5rem',
                        }}
                      >
                        <QRCodeSVG
                          value={`upi://pay?pa=${settings.upiId}&pn=${encodeURIComponent(
                            settings.upiName || settings.shopName || 'Merchant'
                          )}&am=${effectivePaymentAmount}&cu=INR`}
                          size={100}
                          level="M"
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                          Scan to pay <strong>{formatCurrency(effectivePaymentAmount)}</strong>
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                          {settings.upiId}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                      <p style={{ margin: '0 0 0.5rem 0' }}>UPI is not configured.</p>
                      <p style={{ margin: 0 }}>
                        Go to <strong>Settings &gt; Business Rules</strong> to add your Store UPI
                        ID.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {(finalizingError || quotationError) && (
                <div
                  className="error-message"
                  style={{
                    color: '#ef4444',
                    marginBottom: '0.5rem',
                    textAlign: 'right',
                    fontSize: '0.9rem',
                  }}
                >
                  Error: {finalizingError || quotationError}
                </div>
              )}

              <button
                ref={checkoutBtnRef}
                className="btn-pay"
                disabled={finalizing || creatingQuotation || cart.length === 0}
                onClick={handleCheckout}
              >
                {finalizing || creatingQuotation
                  ? 'Processing...'
                  : isQuotationMode
                    ? 'SAVE QUOTATION (F9)'
                    : `PAY (F9)`}
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
                padding: '0 1.5rem 0.75rem',
                background: '#f8fafc',
                borderRadius: '0.5rem',
                fontSize: '0.7rem',
                color: '#64748b',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '0.5rem 1rem',
              }}
            >
              <div>
                <strong style={{ color: '#475569' }}>F2</strong> Search
              </div>
              <div>
                <strong style={{ color: '#475569' }}>Enter</strong> Add
              </div>
              <div>
                <strong style={{ color: '#475569' }}>F9</strong> Pay
              </div>
              <div>
                <strong style={{ color: '#475569' }}>Esc</strong> Reset
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

      {/* Referral Program Modal (Daily popup on login) */}
      <ReferralModal />

      {/* GST Filing Reminder Modal (Daily popup) */}
      <GstReminderModal />
    </div>
  );
}

export default BillingPage;
