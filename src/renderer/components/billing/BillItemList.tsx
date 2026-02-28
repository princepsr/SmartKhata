import React from 'react';
import type { Product } from '@shared/types/ipc';
import { BillItemRow } from './BillItemRow';
import { CalculatedLineItem } from '@shared/utils/billing-math';

interface CartItem {
  product: Product;
  quantity: number;
  discountValue?: number;
  discountType?: 'amount' | 'percent';
}

interface BillItemListProps {
  cart: CartItem[];
  calculatedItems: CalculatedLineItem[];
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onUpdateDiscount: (productId: number, value: number, type: 'amount' | 'percent') => void;
  onRemove: (productId: number) => void;
}

export const BillItemList: React.FC<BillItemListProps> = ({
  cart,
  calculatedItems,
  onUpdateQuantity,
  onUpdateDiscount,
  onRemove,
}) => {
  if (cart.length === 0) {
    return (
      <div
        className="empty-cart"
        style={{
          padding: '3rem',
          textAlign: 'center',
          opacity: 0.6,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🛒</div>
        <h2 style={{ margin: 0 }}>Cart Empty</h2>
        <p>Scan barcode or search (F2) to add items</p>
      </div>
    );
  }

  return (
    <div
      className="cart-items-container"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Header Row */}
      <div
        className="cart-header"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(200px, 3fr) 100px 100px 120px 120px 40px',
          gap: '0.5rem',
          padding: '0.75rem',
          background: '#f3f4f6',
          borderBottom: '1px solid #e5e7eb',
          fontWeight: 'bold',
          fontSize: '1rem',
        }}
      >
        <span>Item</span>
        <span style={{ textAlign: 'center' }}>Qty</span>
        <span style={{ textAlign: 'right' }}>Price</span>
        <span style={{ textAlign: 'center' }}>Disc</span>
        <span style={{ textAlign: 'right' }}>Total</span>
        <span></span>
      </div>

      {/* Scrollable List */}
      <div className="cart-items" style={{ flex: 1, overflowY: 'auto' }}>
        {cart.map((item, index) => (
          <BillItemRow
            key={item.product.id}
            item={item}
            calculatedLine={calculatedItems.find((ci) => ci.productId === item.product.id)}
            index={index}
            onUpdateQuantity={onUpdateQuantity}
            onUpdateDiscount={onUpdateDiscount}
            onRemove={onRemove}
            autoFocus={false}
          />
        ))}
      </div>
    </div>
  );
};
