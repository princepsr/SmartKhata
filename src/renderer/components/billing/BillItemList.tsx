import React from 'react';
import { BillItemRow } from './BillItemRow';
import type { Product } from '@shared/types/ipc';

interface CartItem {
  product: Product;
  quantity: number;
}

interface BillItemListProps {
  cart: CartItem[];
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onRemove: (productId: number) => void;
}

export const BillItemList: React.FC<BillItemListProps> = ({ 
  cart, 
  onUpdateQuantity, 
  onRemove 
}) => {
  if (cart.length === 0) {
    return (
      <div className="empty-cart" style={{ 
        padding: '3rem', 
        textAlign: 'center', 
        opacity: 0.6,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🛒</div>
        <h2 style={{ margin: 0 }}>Cart Empty</h2>
        <p>Scan barcode or search (F2) to add items</p>
      </div>
    );
  }

  return (
    <div className="cart-items-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header Row */}
      <div className="cart-header" style={{ 
        display: 'grid', 
        gridTemplateColumns: '3fr 1fr 1fr 1fr auto', 
        gap: '0.5rem',
        padding: '0.75rem',
        background: '#f3f4f6',
        borderBottom: '1px solid #e5e7eb',
        fontWeight: 'bold',
        fontSize: '1rem'
      }}>
        <span>Item</span>
        <span style={{ textAlign: 'center' }}>Qty</span>
        <span style={{ textAlign: 'right' }}>Price</span>
        <span style={{ textAlign: 'right' }}>Total</span>
        <span></span>
      </div>
      
      {/* Scrollable List */}
      <div className="cart-items" style={{ flex: 1, overflowY: 'auto' }}>
        {cart.map((item, index) => (
          <BillItemRow
            key={item.product.id}
            item={item}
            index={index}
            onUpdateQuantity={onUpdateQuantity}
            onRemove={onRemove}
            // Logic: Auto-focus the quantity input of the LAST added item?
            // Actually, per "search rapid entry" design, focus should return to SEARCH.
            // So autoFocus={false} unless explicitly editing.
            autoFocus={false} 
          />
        ))}
      </div>
    </div>
  );
};
