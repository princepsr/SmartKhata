import React, { useState, useEffect, useRef } from 'react';
import { useIPCMutation } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
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
    batchNumber?: string;
    expiryDate?: string;
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
  const [batchNumber, setBatchNumber] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const qtyInputRef = useRef<HTMLInputElement>(null);

  const {
    execute: adjustStock,
    loading: adjusting,
    error: adjustError,
  } = useIPCMutation(IPC_CHANNELS.PRODUCT_ADJUST_STOCK);
  const {
    execute: updateProduct,
    loading: updating,
    error: updateError,
  } = useIPCMutation(IPC_CHANNELS.PRODUCT_UPDATE);

  const loading = adjusting || updating;
  const ipcError = adjustError || updateError;

  useEffect(() => {
    if (isOpen && product) {
      setAdjustmentType('add');
      setQuantity('');
      setReason('');
      setNotes('');
      setTrackInventory(product.trackInventory);
      setBatchNumber(product.batchNumber || '');
      setExpiryDate(product.expiryDate || '');
      setError(null);
      setTimeout(() => qtyInputRef.current?.focus(), 50);
    }
  }, [isOpen, product]);

  // Parse server errors
  useEffect(() => {
    if (ipcError) {
      setError(ipcError);
    }
  }, [ipcError]);

  if (!isOpen || !product) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) {
      return;
    }

    const hasTrackingChanged = trackInventory !== product.trackInventory;
    const hasBatchChanged = batchNumber !== (product.batchNumber || '');
    const hasExpiryChanged = expiryDate !== (product.expiryDate || '');
    const hasAdjustment = quantity && parseInt(quantity, 10) > 0;

    // Update product info if changed
    if (hasTrackingChanged || hasBatchChanged || hasExpiryChanged) {
      try {
        await updateProduct({
          id: product.id,
          data: {
            trackInventory,
            batchNumber: batchNumber || undefined,
            expiryDate: expiryDate || undefined,
          },
        });

        // If only info changed and no adjustment, close
        if (!hasAdjustment) {
          onSuccess();
          onClose();
          return;
        }
      } catch (err) {
        console.error('Failed to update product info:', err);
        return;
      }
    }

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

        <form id="stock-adjustment-form" onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-banner">{error}</div>}

            <div className="form-row" style={{ alignItems: 'flex-end', gap: '1.5rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Quantity *</label>
                <input
                  ref={qtyInputRef}
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  min="1"
                  disabled={loading || !trackInventory}
                  className="qty-input"
                />
              </div>

              <div
                className="form-group"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: '0.5rem',
                  paddingBottom: '0.6rem',
                  flex: '0 0 auto',
                }}
              >
                <input
                  type="checkbox"
                  id="trackInventory"
                  checked={trackInventory}
                  onChange={(e) => setTrackInventory(e.target.checked)}
                  disabled={loading}
                  style={{
                    width: '18px',
                    height: '18px',
                    margin: 0,
                    cursor: 'pointer',
                    transform: 'scale(1.1)',
                  }}
                />
                <label
                  htmlFor="trackInventory"
                  style={{ margin: 0, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Track Inventory
                </label>
              </div>
            </div>

            <div className="form-row" style={{ gap: '1rem', marginTop: '1rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Batch Number</label>
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="Enter batch #"
                  disabled={loading}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Expiry Date</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  disabled={loading}
                />
              </div>
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
                  <label
                    className={`type-option ${adjustmentType === 'remove' ? 'active remove' : ''}`}
                  >
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
                  <span className={`new-stock-value ${newStock < 0 ? 'negative' : ''}`}>
                    {newStock}
                  </span>
                </div>
              </>
            ) : (
              <div
                className="info-message"
                style={{
                  padding: '1rem',
                  background: '#f3f4f6',
                  borderRadius: '4px',
                  marginBottom: '1rem',
                  color: '#666',
                }}
              >
                Inventory tracking is disabled for this item. Stock quantity will not be tracked or
                updated.
              </div>
            )}
          </div>
        </form>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="submit"
            form="stock-adjustment-form"
            className={`btn-primary ${adjustmentType === 'remove' && trackInventory ? 'danger' : ''}`}
            disabled={loading}
          >
            {loading
              ? 'Saving...'
              : trackInventory !== product?.trackInventory && (!quantity || parseInt(quantity) <= 0)
                ? 'Save Changes'
                : 'Confirm Adjustment'}
          </button>
        </div>
      </div>
    </div>
  );
};
