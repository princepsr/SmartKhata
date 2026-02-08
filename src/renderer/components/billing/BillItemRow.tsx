import React, { useRef, useEffect } from 'react';
import type { Product } from '@shared/types/ipc';
import { formatCurrency } from '../../utils/billing-math';

interface BillItemRowProps {
  item: {
    product: Product;
    quantity: number;
  };
  index: number;
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onRemove: (productId: number) => void;
  autoFocus?: boolean;
}

export const BillItemRow: React.FC<BillItemRowProps> = ({ 
  item, 
  index,
  onUpdateQuantity, 
  onRemove,
  autoFocus
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Local state for input value to allow empty string manipulation
  const [inputValue, setInputValue] = React.useState(item.quantity.toString());

  // Sync local state when prop changes (e.g. via + / - buttons)
  useEffect(() => {
    setInputValue(item.quantity.toString());
  }, [item.quantity]);
  
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
    // If empty or invalid, reset to 1 (or removal? User said "remove only if user puts 0")
    // If 0, remove.
    if (isNaN(newVal) || newVal <= 0) {
        if (inputValue === '0') {
             onRemove(item.product.id);
        } else {
             // Reset to 1 if empty or invalid but not explicitly 0
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
        // Only remove if not editing text (or maybe shift+delete?) 
        // For now, let's keep Delete key removal 
        e.preventDefault();
        onRemove(item.product.id);
    } else if (e.key === 'Enter') {
        inputRef.current?.blur(); // Trigger handleBlur
    }
  };

  return (
    <div className="cart-item" style={rowStyle}>
      {/* Product Name (Immutable Snapshot) */}
      <div className="item-name">
        <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{item.product.name}</div>
        <div style={{ fontSize: '0.9rem', color: '#666' }}>{item.product.sku}</div>
      </div>
      
      {/* Quantity Control (Editable) */}
      <div className="quantity-control" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
        <button 
          className="btn-icon" 
          onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
          tabIndex={-1} // Skip tab index to keep flow fast
          style={{ width: '2rem', height: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: '#f3f4f6', border: '1px solid #d1d5db', cursor: 'pointer', fontSize: '1.2rem', color: '#374151' }}
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
          style={{ width: '3rem', textAlign: 'center', fontWeight: 'bold', padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: '0.25rem' }}
        />
        
        <button 
          className="btn-icon" 
          onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
          tabIndex={-1}
          style={{ width: '2rem', height: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: '#f3f4f6', border: '1px solid #d1d5db', cursor: 'pointer', fontSize: '1.2rem', color: '#374151' }}
        >
          +
        </button>
      </div>
      
      {/* Unit Price */}
      <div style={{ textAlign: 'right' }}>
        ₹{formatCurrency(item.product.salePrice)}
      </div>
      
      {/* Line Total (Instant Calc) */}
      <div style={{ textAlign: 'right', fontWeight: 'bold', color: '#2563eb' }}>
        ₹{formatCurrency(item.product.salePrice * item.quantity)}
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
