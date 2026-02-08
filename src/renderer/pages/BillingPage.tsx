import { useState, useEffect } from 'react';
import { useIPC, useIPCMutation } from '../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import type { Product } from '@shared/types/ipc';
import './BillingPage.css';

/**
 * Billing Page
 * 
 * Main POS billing interface with:
 * - Product search and selection
 * - Cart management
 * - Real-time bill calculation
 * - Transaction completion
 * 
 * Keyboard shortcut: F2
 */

// Types matching billing-service.ts
interface BillItemInput {
  productId: number;
  quantity: number;
}

interface CalculatedLineItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  lineSubtotal: number;
  lineGst: number;
  lineTotal: number;
}

interface BillCalculation {
  items: CalculatedLineItem[];
  subtotal: number;
  gstTotal: number;
  discountAmount: number;
  grandTotal: number;
}

interface FinalizeBillInput {
  billNumber: string;
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

function BillingPage() {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'mixed'>('cash');
  const [calculation, setCalculation] = useState<BillCalculation | null>(null);

  // IPC Hooks
  const { 
    data: searchResults, 
    loading: searching, 
    execute: searchProducts 
  } = useIPC<Product[]>(IPC_CHANNELS.PRODUCT_SEARCH);

  const {
    loading: calculating,
    execute: calculateBill
  } = useIPCMutation<{ items: BillItemInput[]; discountAmount: number }, BillCalculation>(
    IPC_CHANNELS.BILL_CALCULATE
  );

  const {
    loading: finalizing,
    execute: finalizeBill
  } = useIPCMutation<FinalizeBillInput, any>(IPC_CHANNELS.BILL_CREATE);

  const {
    execute: generateBillNumber
  } = useIPC<string>(IPC_CHANNELS.BILL_GENERATE_NUMBER);

  // Search products
  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchProducts(searchQuery);
    }
  }, [searchQuery, searchProducts]);

  // Recalculate bill when cart or discount changes
  useEffect(() => {
    if (cart.length > 0) {
      const items: BillItemInput[] = cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity
      }));

      calculateBill({ items, discountAmount }).then(result => {
        if (result) {
          setCalculation(result);
        }
      });
    } else {
      setCalculation(null);
    }
  }, [cart, discountAmount, calculateBill]);

  // Add product to cart
  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.product.id === product.id);
    
    if (existingItem) {
      // Increment quantity
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      // Add new item
      setCart([...cart, { product, quantity: 1 }]);
    }
    
    // Clear search
    setSearchQuery('');
  };

  // Update cart item quantity
  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      setCart(cart.map(item =>
        item.product.id === productId
          ? { ...item, quantity }
          : item
      ));
    }
  };

  // Remove item from cart
  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  // Complete transaction
  const handleCheckout = async () => {
    if (!calculation || cart.length === 0) return;

    // Generate bill number
    const billNumberResult = await generateBillNumber();
    if (!billNumberResult) {
      alert('Failed to generate bill number');
      return;
    }

    const billNumber = billNumberResult as unknown as string;

    const input: FinalizeBillInput = {
      billNumber,
      items: cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity
      })),
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      paymentMode
    };

    const result = await finalizeBill(input);
    
    if (result) {
      alert(`Bill created successfully!\nBill Number: ${billNumber}\nTotal: ₹${(calculation.grandTotal / 100).toFixed(2)}`);
      
      // Clear cart
      setCart([]);
      setDiscountAmount(0);
      setCalculation(null);
    } else {
      alert('Failed to create bill');
    }
  };

  return (
    <div className="page billing-page">
      <header className="page-header">
        <h1 className="page-title">Billing</h1>
        <p className="page-subtitle">Create new sale</p>
      </header>

      <div className="page-content billing-content">
        {/* Left Panel: Product Search */}
        <div className="billing-panel search-panel">
          <h2>Products</h2>
          
          <input
            type="text"
            className="search-input"
            placeholder="Search products (name, SKU, barcode)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />

          {searching && <div className="loading">Searching...</div>}

          {searchResults && searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map(product => (
                <div
                  key={product.id}
                  className="product-item"
                  onClick={() => addToCart(product)}
                >
                  <div className="product-info">
                    <h3>{product.name}</h3>
                    {product.sku && <p className="product-sku">SKU: {product.sku}</p>}
                  </div>
                  <div className="product-price">
                    ₹{(product.salePrice / 100).toFixed(2)}
                  </div>
                  <div className="product-stock">
                    Stock: {product.stockQty}
                  </div>
                </div>
              ))}
            </div>
          )}

          {searchQuery.length >= 2 && !searching && (!searchResults || searchResults.length === 0) && (
            <div className="no-results">No products found</div>
          )}
        </div>

        {/* Right Panel: Cart & Checkout */}
        <div className="billing-panel cart-panel">
          <h2>Cart ({cart.length} items)</h2>

          {cart.length === 0 ? (
            <div className="empty-cart">
              <div className="placeholder-icon">🛒</div>
              <p>Cart is empty</p>
              <p className="hint">Search and add products to start billing</p>
            </div>
          ) : (
            <>
              {/* Cart Items */}
              <div className="cart-items">
                {cart.map(item => (
                  <div key={item.product.id} className="cart-item">
                    <div className="cart-item-info">
                      <h3>{item.product.name}</h3>
                      <p className="cart-item-price">
                        ₹{(item.product.salePrice / 100).toFixed(2)} × {item.quantity}
                      </p>
                    </div>
                    
                    <div className="cart-item-controls">
                      <button
                        className="btn btn-sm"
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        className="quantity-input"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 0)}
                        min="1"
                      />
                      <button
                        className="btn btn-sm"
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      >
                        +
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => removeFromCart(item.product.id)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bill Summary */}
              {calculation && (
                <div className="bill-summary">
                  <div className="summary-row">
                    <span>Subtotal:</span>
                    <span>₹{(calculation.subtotal / 100).toFixed(2)}</span>
                  </div>
                  <div className="summary-row">
                    <span>GST:</span>
                    <span>₹{(calculation.gstTotal / 100).toFixed(2)}</span>
                  </div>
                  
                  <div className="summary-row discount-row">
                    <span>Discount:</span>
                    <input
                      type="number"
                      className="discount-input"
                      value={discountAmount / 100}
                      onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0) * 100)}
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>

                  <div className="summary-row total-row">
                    <span>Grand Total:</span>
                    <span className="total-amount">₹{(calculation.grandTotal / 100).toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Payment Mode */}
              <div className="payment-mode">
                <label>Payment Mode:</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as 'cash' | 'upi' | 'mixed')}
                  className="payment-select"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>

              {/* Checkout Button */}
              <button
                className="btn btn-primary btn-checkout"
                onClick={handleCheckout}
                disabled={finalizing || calculating || !calculation}
              >
                {finalizing ? 'Processing...' : `Complete Sale - ₹${calculation ? (calculation.grandTotal / 100).toFixed(2) : '0.00'}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default BillingPage;
