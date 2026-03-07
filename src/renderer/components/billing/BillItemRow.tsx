import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { settings } = useAppSettingsStore();

  // Local state for input value to allow empty string manipulation
  const [inputValue, setInputValue] = React.useState(
    item.product.isWeightBased
      ? item.quantity.toFixed(3).replace(/\.?0+$/, '')
      : item.quantity.toString()
  );

  // Sync local state when prop changes
  useEffect(() => {
    setInputValue(
      item.product.isWeightBased
        ? item.quantity.toFixed(3).replace(/\.?0+$/, '')
        : item.quantity.toString()
    );
  }, [item.quantity, item.product.isWeightBased]);

  const [discValueStr, setDiscValueStr] = React.useState(item.discountValue?.toString() || '');
  useEffect(() => {
    setDiscValueStr(item.discountValue?.toString() || '');
  }, [item.discountValue]);

  // High contrast for readability
  const isEven = index % 2 === 0;

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.select();
    }
  }, [autoFocus]);

  const handleBlur = () => {
    let newVal = parseFloat(inputValue);
    if (isNaN(newVal) || newVal <= 0) {
      if (inputValue === '0') {
        onRemove(item.product.id);
      } else {
        const defaultVal = 1;
        onUpdateQuantity(item.product.id, defaultVal);
        setInputValue(defaultVal.toString());
      }
    } else {
      if (item.product.isWeightBased) {
        newVal = Math.round(newVal * 1000) / 1000;
        setInputValue(newVal.toString());
      }
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
    onUpdateDiscount(item.product.id, val, item.discountType || 'percent');
  };

  // Medical Mode: Strip -> Tablet logic
  const isMedicalStrip = settings.appMode === 'MEDICAL' && item.product.uom === 'Strip';
  const stripSize = item.product.stripSize || 10;

  const handleTabletInput = (tablets: number) => {
    const totalStrips = tablets / stripSize;
    onUpdateQuantity(item.product.id, totalStrips);
  };

  return (
    <div className={`cart-item ${isEven ? 'even' : 'odd'}`}>
      <div className="item-name-cell">
        <div className="product-info">
          <span className="product-title">{item.product.name}</span>
          {item.product.batchNumber && (
            <span className="batch-badge">
              {t('inventory.table.batch')}: {item.product.batchNumber}
            </span>
          )}
        </div>
        <div className="product-meta-sub">
          <span>
            {t('common.barcode')}: {item.product.sku || 'N/A'}
          </span>
          {item.product.expiryDate && (
            <span className={new Date(item.product.expiryDate) < new Date() ? 'expired' : ''}>
              {t('inventory.table.expiry')}:{' '}
              {new Date(item.product.expiryDate).toLocaleDateString()}
            </span>
          )}
        </div>
        {settings.appMode === 'MEDICAL' && item.product.saltName && (
          <div className="salt-name">{item.product.saltName}</div>
        )}
      </div>

      <div className="quantity-control-cell">
        {item.product.isWeightBased ? (
          <div className="weight-controls">
            <div className="weight-input-wrapper">
              <input
                ref={inputRef}
                className="quantity-input-field"
                value={inputValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder="0.000"
              />
              <span className="weight-label-tag">{t('inventory.form.uom_options.kg')}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="qty-input-group">
              <button
                className="qty-btn minus"
                onClick={() => onUpdateQuantity(item.product.id, Math.max(0, item.quantity - 1))}
                disabled={item.quantity <= 0}
              >
                −
              </button>
              <input
                ref={inputRef}
                className="quantity-input-field"
                value={inputValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
              />
              <button
                className="qty-btn plus"
                onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
              >
                +
              </button>
            </div>
            <span className="uom-label">
              {item.product.uom === 'Strip'
                ? t('inventory.form.uom_options.strip')
                : item.product.uom === 'Pcs'
                  ? t('inventory.form.uom_options.pcs')
                  : item.product.uom || t('inventory.form.uom_options.pcs')}
            </span>
          </>
        )}

        {isMedicalStrip && (
          <div className="tab-controls">
            <button
              className="btn-tab-adjust"
              onClick={() => handleTabletInput(Math.round(item.quantity * stripSize) + 1)}
            >
              {t('billing.add_tab')}
            </button>
            <button
              className="btn-tab-adjust"
              onClick={() => handleTabletInput(Math.round(item.quantity * stripSize) - 1)}
            >
              {t('billing.remove_tab')}
            </button>
          </div>
        )}
      </div>

      <div className="price-cell">
        <div className="main-price">{formatCurrency(item.product.salePrice)}</div>
        {isMedicalStrip && (
          <div className="sub-price">
            {formatCurrency(item.product.salePrice / stripSize)} {t('billing.per_tab')}
          </div>
        )}
      </div>

      <div className="item-discount-cell">
        <div className="disc-input-group">
          <input
            type="number"
            className="disc-input-field"
            value={discValueStr}
            onChange={(e) => setDiscValueStr(e.target.value)}
            onBlur={handleDiscBlur}
            placeholder="0"
          />
          <div className="disc-toggle-group-mini">
            <button
              className={`disc-toggle-btn-mini ${item.discountType !== 'percent' ? 'active' : ''}`}
              onClick={() =>
                onUpdateDiscount(item.product.id, parseFloat(discValueStr) || 0, 'amount')
              }
            >
              ₹
            </button>
            <button
              className={`disc-toggle-btn-mini ${item.discountType === 'percent' ? 'active' : ''}`}
              onClick={() =>
                onUpdateDiscount(item.product.id, parseFloat(discValueStr) || 0, 'percent')
              }
            >
              %
            </button>
          </div>
        </div>
      </div>

      <div className="line-total-cell">
        {formatCurrency(
          calculatedLine ? calculatedLine.lineTotal : item.product.salePrice * item.quantity
        )}
      </div>

      <button
        className="btn-item-remove"
        onClick={() => onRemove(item.product.id)}
        aria-label={t('common.delete')}
        tabIndex={0}
      >
        ×
      </button>
    </div>
  );
};

export const BillItemRow = React.memo(BillItemRowComponent);
