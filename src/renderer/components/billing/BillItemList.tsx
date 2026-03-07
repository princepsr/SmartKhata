import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        <h2 style={{ margin: 0 }}>{t('common.items')}</h2>
        <p>{t('billing.search_placeholder')}</p>
      </div>
    );
  }

  return (
    <div
      className="cart-items-container"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Header Row */}
      <div className="cart-header">
        <span className="col-item">{t('common.items').toUpperCase()}</span>
        <span className="col-qty">{t('common.quantity').toUpperCase()}</span>
        <span className="col-price">{t('common.price').toUpperCase()}</span>
        <span className="col-disc">{t('common.discount').toUpperCase()}</span>
        <span className="col-total">{t('common.total').toUpperCase()}</span>
        <span className="col-actions"></span>
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
