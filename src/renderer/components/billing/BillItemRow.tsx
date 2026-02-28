import React, { useRef, useEffect } from 'react';
import type { Product } from '@shared/types/ipc';
import { formatCurrency } from '../../utils/formatters';
import { CalculatedLineItem } from '@shared/utils/billing-math';

interface BillItemRowProps {
  item: {
    product: Product;
    quantity: number;
    discountValue?: number;
    discountType?: 'amount' | 'percent';
  };
  calculatedLine?: CalculatedLineItem;
  index: number;
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onUpdateDiscount: (productId: number, value: number, type: 'amount' | 'percent') => void;
  onRemove: (productId: number) => void;
  autoFocus?: boolean;
}

const BillItemRowComponent: React.FC<BillItemRowProps> = ({
  item,
  calculatedLine,
  index,
  onUpdateQuantity,
  onUpdateDiscount,
  onRemove,
  autoFocus,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  // Local state for input value to allow empty string manipulation
  const [inputValue, setInputValue] = React.useState(item.quantity.toString());

  // Sync local state when prop changes (e.g. via + / - buttons)
  useEffect(() => {
    setInputValue(item.quantity.toString());
  }, [item.quantity]);

  const [discValueStr, setDiscValueStr] = React.useState(item.discountValue?.toString() || '');
  useEffect(() => {
    setDiscValueStr(item.discountValue?.toString() || '');
  }, [item.discountValue]);

  // High contrast for readability
  const isEven = index % 2 === 0;
  const rowStyle = isEven ? { backgroundColor: '#f9fafb' } : { backgroundColor: '#ffffff' };

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.select();
    }
  }, [autoFocus]);

  const handleBlur = () => {
    const newVal = parseInt(inputValue);
    if (isNaN(newVal) || newVal <= 0) {
      if (inputValue === '0') {
        onRemove(item.product.id);
      } else {
        onUpdateQuantity(item.product.id, 1);
        setInputValue('1');
      }
    } else {
      onUpdateQuantity(item.product.id, newVal);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onUpdateQuantity(item.product.id, item.quantity + 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onUpdateQuantity(item.product.id, Math.max(1, item.quantity - 1));
    } else if (e.key === 'Delete') {
      e.preventDefault();
      onRemove(item.product.id);
    } else if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
  };

  const handleDiscBlur = () => {
    const val = parseFloat(discValueStr) || 0;
    onUpdateDiscount(item.product.id, val, item.discountType || 'amount');
  };

  const toggleDiscType = () => {
    onUpdateDiscount(
      item.product.id,
      parseFloat(discValueStr) || 0,
      item.discountType === 'percent' ? 'amount' : 'percent'
    );
  };

  return (
    <div className="cart-item" style={rowStyle}>
      {/* Product Name (Immutable Snapshot) */}
      <div className="item-name">
        <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{item.product.name}</div>
        <div style={{ fontSize: '0.9rem', color: '#666' }}>{item.product.sku}</div>
      </div>

      {/* Quantity Control (Editable) */}
      <div
        className="quantity-control"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
      >
        <button
          className="btn-icon"
          onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
          tabIndex={-1}
          style={{
            width: '2rem',
            height: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: '#f3f4f6',
            border: '1px solid #d1d5db',
            cursor: 'pointer',
            fontSize: '1.2rem',
            color: '#374151',
          }}
        >
          -
        </button>

        <input
          ref={inputRef}
          className="quantity-input"
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={{
            width: '3rem',
            textAlign: 'center',
            fontWeight: 'bold',
            padding: '0.25rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.25rem',
          }}
        />

        <button
          className="btn-icon"
          onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
          tabIndex={-1}
          style={{
            width: '2rem',
            height: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: '#f3f4f6',
            border: '1px solid #d1d5db',
            cursor: 'pointer',
            fontSize: '1.2rem',
            color: '#374151',
          }}
        >
          +
        </button>
      </div>

      {/* Unit Price */}
      <div style={{ textAlign: 'right' }}>{formatCurrency(item.product.salePrice)}</div>

      {/* Item Discount */}
      <div
        className="item-discount-cell"
        style={{ display: 'flex', gap: '2px', alignItems: 'center' }}
      >
        <input
          type="number"
          value={discValueStr}
          onChange={(e) => setDiscValueStr(e.target.value)}
          onBlur={handleDiscBlur}
          placeholder="0"
          style={{
            width: '3.5rem',
            padding: '2px 4px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '0.9rem',
            textAlign: 'right',
          }}
        />
        <button
          onClick={toggleDiscType}
          style={{
            padding: '2px 4px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '0.75rem',
            background: item.discountType === 'percent' ? 'var(--color-primary)' : '#f3f4f6',
            color: item.discountType === 'percent' ? 'white' : '#374151',
            cursor: 'pointer',
            minWidth: '1.5rem',
          }}
          title="Toggle between ₹ and %"
        >
          {item.discountType === 'percent' ? '%' : '₹'}
        </button>
      </div>

      {/* Line Total (Precise Blueprint Calc) */}
      <div style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-primary)' }}>
        {formatCurrency(
          calculatedLine ? calculatedLine.lineTotal : item.product.salePrice * item.quantity
        )}
      </div>

      {/* Remove Action */}
      <button
        className="btn-icon btn-remove"
        onClick={() => onRemove(item.product.id)}
        aria-label="Remove item"
        tabIndex={0}
      >
        ×
      </button>
    </div>
  );
};

export const BillItemRow = React.memo(BillItemRowComponent);
