import React, { useRef, useEffect } from 'react';
import type { Product } from '@shared/types/ipc';
import { formatCurrency } from '../../utils/formatters';
import { CalculatedLineItem } from '@shared/utils/billing-math';
import { useAppSettingsStore } from '../../store';

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
  const { settings } = useAppSettingsStore();

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
    const newVal = parseFloat(inputValue);
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
    const step = item.product.isWeightBased ? 0.1 : 1;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onUpdateQuantity(item.product.id, item.quantity + step);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onUpdateQuantity(item.product.id, Math.max(0, item.quantity - step));
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

  // Medical Mode: Strip -> Tablet logic
  const isMedicalStrip = settings.appMode === 'MEDICAL' && item.product.uom === 'Strip';
  const stripSize = item.product.stripSize || 10;

  const handleTabletInput = (tablets: number) => {
    const totalStrips = tablets / stripSize;
    onUpdateQuantity(item.product.id, totalStrips);
  };

  return (
    <div className="cart-item" style={rowStyle}>
      {/* Product Name (Immutable Snapshot) */}
      <div className="item-name">
        <div
          style={{
            fontWeight: 600,
            fontSize: '1.1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {item.product.name}
          {item.product.batchNumber && (
            <span
              style={{
                fontSize: '0.7rem',
                background: '#eef2ff',
                color: '#4338ca',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              Batch: {item.product.batchNumber}
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#666', display: 'flex', gap: '8px' }}>
          <span>SKU: {item.product.sku || 'N/A'}</span>
          {item.product.expiryDate && (
            <span
              style={{ color: new Date(item.product.expiryDate) < new Date() ? 'red' : '#666' }}
            >
              Exp: {new Date(item.product.expiryDate).toLocaleDateString()}
            </span>
          )}
        </div>
        {settings.appMode === 'MEDICAL' && item.product.saltName && (
          <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontStyle: 'italic' }}>
            {item.product.saltName}
          </div>
        )}
      </div>

      {/* Quantity Control (Editable) */}
      <div
        className="quantity-control-cell"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.25rem',
          }}
        >
          <input
            ref={inputRef}
            className="quantity-input"
            value={inputValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={{
              width: '4rem',
              textAlign: 'center',
              fontWeight: 'bold',
              padding: '0.4rem',
              border: '2px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '1rem',
            }}
          />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', width: '30px' }}>
            {item.product.uom || 'Pcs'}
          </span>
        </div>

        {isMedicalStrip && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              className="btn-tiny"
              onClick={() => handleTabletInput(Math.round(item.quantity * stripSize) + 1)}
              style={{
                fontSize: '0.7rem',
                padding: '2px 4px',
                border: '1px solid #ddd',
                borderRadius: '3px',
                background: 'white',
              }}
            >
              +1 Tab
            </button>
            <button
              className="btn-tiny"
              onClick={() => handleTabletInput(Math.round(item.quantity * stripSize) - 1)}
              style={{
                fontSize: '0.7rem',
                padding: '2px 4px',
                border: '1px solid #ddd',
                borderRadius: '3px',
                background: 'white',
              }}
            >
              -1 Tab
            </button>
          </div>
        )}
      </div>

      {/* Unit Price */}
      <div style={{ textAlign: 'right' }}>
        <div>{formatCurrency(item.product.salePrice)}</div>
        {isMedicalStrip && (
          <div style={{ fontSize: '0.7rem', color: '#666' }}>
            {formatCurrency(item.product.salePrice / stripSize)} / tab
          </div>
        )}
      </div>

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
            padding: '4px',
            border: '2px solid #e5e7eb',
            borderRadius: '6px',
            fontSize: '0.9rem',
            textAlign: 'right',
          }}
        />
        <button
          onClick={toggleDiscType}
          style={{
            padding: '4px 6px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '0.8rem',
            background: item.discountType === 'percent' ? 'var(--color-primary)' : '#f3f4f6',
            color: item.discountType === 'percent' ? 'white' : '#374151',
            cursor: 'pointer',
            fontWeight: 600,
          }}
          title="Toggle between ₹ and %"
        >
          {item.discountType === 'percent' ? '%' : '₹'}
        </button>
      </div>

      {/* Line Total (Precise Blueprint Calc) */}
      <div
        style={{
          textAlign: 'right',
          fontWeight: 'bold',
          color: 'var(--color-primary)',
          fontSize: '1.1rem',
        }}
      >
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
        style={{
          color: '#ef4444',
          fontSize: '1.5rem',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        ×
      </button>
    </div>
  );
};

export const BillItemRow = React.memo(BillItemRowComponent);
