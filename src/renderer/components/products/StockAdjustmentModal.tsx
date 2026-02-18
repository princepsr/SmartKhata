import React, { useState, useEffect, useRef } from 'react';
import { useIPCMutation } from '../../hooks/useIPC';
import './StockAdjustmentModal.css';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product: {
    id: number;
    name: string;
    stockQty: number;
    trackInventory: boolean;
  } | null;
}

type AdjustmentType = 'add' | 'remove';
type ReasonType = 'PURCHASE' | 'DAMAGE' | 'THEFT' | 'ADJUSTMENT' | 'RETURN' | '';

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  product,
}) => {
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('add');
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState<ReasonType>('');
  const [notes, setNotes] = useState<string>('');
  const [trackInventory, setTrackInventory] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const qtyInputRef = useRef<HTMLInputElement>(null);

  const { execute: adjustStock, loading: adjusting, error: adjustError } = useIPCMutation('product:adjustStock');
  const { execute: updateProduct, loading: updating, error: updateError } = useIPCMutation('product:update');

  const loading = adjusting || updating;
  const ipcError = adjustError || updateError;

  useEffect(() => {
    if (isOpen) {
      setAdjustmentType('add');
      setQuantity('');
      setReason('');
      setNotes('');
      setTrackInventory(product.trackInventory);
      setError(null);
      setTimeout(() => qtyInputRef.current?.focus(), 50);
    }
  }, [isOpen, product]);

  // Parse server errors
  useEffect(() => {
    if (ipcError) {
      if (ipcError.toLowerCase().includes('not enough stock')) {
        setError(ipcError); // This will show in the banner, which is fine
        // Optionally could set a specific quantity error if we had that state
      } else {
        setError(ipcError);
      }
    }
  }, [ipcError]);

  if (!isOpen || !product) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    // 1. If tracking status changed, update product first
    if (trackInventory !== product.trackInventory) {
      try {
        await updateProduct({
          id: product.id,
          data: { trackInventory },
        });
      } catch (err) {
        console.error('Failed to update tracking status:', err);
        return; // Stop if update fails
      }
    }

    // 2. If tracking is OFF, we don't adjust stock (conceptually)
    // But if the user entered a quantity, maybe they expect it to do something?
    // For now, if tracking is OFF, we just close. Stock adjustment is irrelevant.
    if (!trackInventory) {
      onSuccess();
      onClose();
      return;
    }

    if (!validate()) {
      return;
    }

    const qty = parseInt(quantity, 10);
    const deltaQty = adjustmentType === 'add' ? qty : -qty;

    // Map UI reasons to backend expected values if needed,
    // but for now we'll send the raw string or map to 'MANUAL'/'ADJUSTMENT' as per service definition.
    // The service expects 'MANUAL' | 'ADJUSTMENT' in the strict type,
    // but typically we'd want more granular reasons logged.
    // Looking at ProductHandlers: reason: 'MANUAL' | 'ADJUSTMENT'
    // We will use 'MANUAL' for Purchase/Return and 'ADJUSTMENT' for Correction/Damage for now,
    // and put the specific reason in notes or strictly follow the type.

    // Let's refine: The IPC handler strictly expects 'MANUAL' | 'ADJUSTMENT'.
    // We should probably append the real reason to notes.
    const serviceReason = 'MANUAL';
    const finalNotes = `[${reason}] ${notes}`.trim();

    try {
      await adjustStock({
        productId: product.id,
        deltaQty,
        reason: serviceReason,
        notes: finalNotes,
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Stock adjustment failed:', err);
    }
  };

  const validate = (): boolean => {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setError('Please enter a valid positive quantity');
      return false;
    }

    if (!reason) {
      setError('Please select a reason');
      return false;
    }

    if (adjustmentType === 'remove' && qty > product.stockQty) {
      setError(`Cannot remove more than current stock (${product.stockQty})`);
      return false;
    }

    setError(null);
    return true;
  };

  const newStock = (() => {
    const qty = parseInt(quantity, 10) || 0;
    return adjustmentType === 'add' ? product.stockQty + qty : product.stockQty - qty;
  })();

  return (
    <div className="modal-overlay">
      <div className="modal-content stock-adjustment-modal">
        <div className="modal-header">
          <h2>Adjust Stock</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="product-info-banner">
          <span className="product-name">{product.name}</span>
          <span className="current-stock">
            Current Stock: <strong>{product.stockQty}</strong>
          </span>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Tracking Toggle */}
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input
              type="checkbox"
              id="trackInventory"
              checked={trackInventory}
              onChange={(e) => setTrackInventory(e.target.checked)}
              disabled={loading}
              style={{ width: 'auto', margin: 0 }}
            />
            <label htmlFor="trackInventory" style={{ margin: 0, fontWeight: 500, cursor: 'pointer' }}>
              Track Inventory for this Item
            </label>
          </div>

          {trackInventory ? (
            <>
              <div className="adjustment-type-selector">
            <label className={`type-option ${adjustmentType === 'add' ? 'active add' : ''}`}>
              <input
                type="radio"
                name="type"
                checked={adjustmentType === 'add'}
                onChange={() => setAdjustmentType('add')}
              />
              <span>+ Add Stock</span>
            </label>
            <label className={`type-option ${adjustmentType === 'remove' ? 'active remove' : ''}`}>
              <input
                type="radio"
                name="type"
                checked={adjustmentType === 'remove'}
                onChange={() => setAdjustmentType('remove')}
              />
              <span>- Remove Stock</span>
            </label>
          </div>

          <div className="form-group">
            <label>Quantity *</label>
            <input
              ref={qtyInputRef}
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              min="1"
              disabled={loading}
              className="qty-input"
            />
          </div>

          <div className="form-group">
            <label>Reason *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReasonType)}
              disabled={loading}
              className={!reason ? 'placeholder' : ''}
            >
              <option value="" disabled>
                Select a reason...
              </option>
              {adjustmentType === 'add' ? (
                <>
                  <option value="PURCHASE">New Purchase / Stock In</option>
                  <option value="RETURN">Customer Return</option>
                  <option value="ADJUSTMENT">Inventory Correction (Found)</option>
                </>
              ) : (
                <>
                  <option value="DAMAGE">Damaged / Expired</option>
                  <option value="THEFT">Theft / Lost</option>
                  <option value="ADJUSTMENT">Inventory Correction (Missing)</option>
                  <option value="USE">Internal Use</option>
                </>
              )}
            </select>
          </div>

          <div className="form-group">
            <label>Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add details..."
              rows={2}
              disabled={loading}
            />
          </div>

          <div className="stock-preview">
            <span>New Stock Level:</span>
            <span className={`new-stock-value ${newStock < 0 ? 'negative' : ''}`}>{newStock}</span>
          </div>
          </>
          ) : (
            <div className="info-message" style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '4px', marginBottom: '1rem', color: '#666' }}>
              Inventory tracking is disabled for this item. Stock quantity will not be tracked or updated.
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className={`btn-primary ${adjustmentType === 'remove' ? 'danger' : ''}`}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Confirm Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
