import React, { useState, useEffect, useRef } from 'react';
import { useIPCMutation } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { useAppSettingsStore } from '../../store';
import { APP_CONSTANTS } from '@shared/constants/app-constants';
import './ProductFormModal.css';

interface Product {
  id: number;
  name: string;
  sku?: string;
  barcode?: string;
  hsnCode?: string | null;
  salePrice: number;
  purchasePrice?: number;
  gstPercent?: number;
  stockQty: number;
  lowStockAlert?: number;
  isActive: boolean;
  trackInventory: boolean;
  isGstInclusive: boolean;
}

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Product | null; // Typed instead of any
}

interface FormData {
  name: string;
  sku: string;
  barcode: string;
  hsnCode: string;
  salePrice: string;
  purchasePrice: string;
  gstPercent: string;
  stockQty: string;
  lowStockAlert: string;
  isActive: boolean;
  trackInventory: boolean;
  isGstInclusive: boolean;
}

const INITIAL_STATE: FormData = {
  name: '',
  sku: '',
  barcode: '',
  hsnCode: '',
  salePrice: '',
  purchasePrice: '',
  gstPercent: '0',
  stockQty: '10',
  lowStockAlert: '5',
  isActive: true,
  trackInventory: true,
  isGstInclusive: false,
};

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}) => {
  const [formData, setFormData] = useState<FormData>(INITIAL_STATE);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const firstInputRef = useRef<HTMLInputElement>(null);
  const { settings } = useAppSettingsStore();

  const isEditMode = !!initialData;

  // IPC Mutations
  const {
    execute: createProduct,
    loading: creating,
    error: createError,
  } = useIPCMutation(IPC_CHANNELS.PRODUCT_CREATE);

  const {
    execute: updateProduct,
    loading: updating,
    error: updateError,
  } = useIPCMutation(IPC_CHANNELS.PRODUCT_UPDATE);

  // Parse server errors for field highlighting
  useEffect(() => {
    const serverError = createError || updateError;
    if (serverError) {
      if (serverError.includes('already exists')) {
        if (serverError.toLowerCase().includes('barcode')) {
          setErrors((prev) => ({ ...prev, barcode: serverError }));
        } else if (serverError.toLowerCase().includes('sku')) {
          setErrors((prev) => ({ ...prev, sku: serverError }));
        } else if (serverError.toLowerCase().includes('name')) {
          setErrors((prev) => ({ ...prev, name: serverError }));
        }
      }
    }
  }, [createError, updateError]);

  // Initialize form when opening
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          name: initialData.name,
          sku: initialData.sku || '',
          barcode: initialData.barcode || '',
          hsnCode: initialData.hsnCode || '',
          salePrice: initialData.salePrice.toFixed(2),
          purchasePrice: initialData.purchasePrice ? initialData.purchasePrice.toFixed(2) : '',
          gstPercent: initialData.gstPercent?.toString() || '0',
          stockQty: initialData.stockQty?.toString() || '0',
          lowStockAlert: initialData.lowStockAlert?.toString() || '5',
          isActive: initialData.isActive ?? true,
          isGstInclusive: initialData.isGstInclusive ?? false,
          trackInventory: initialData.trackInventory ?? true,
        });
      } else {
        setFormData({
          ...INITIAL_STATE,
          gstPercent: (settings?.gstPercentage ?? 18).toString(),
          isGstInclusive: settings?.gstExclusiveMode ? false : true,
        });
      }
      setErrors({});
      // Focus name field only if creating, safely wait for render
      if (!initialData) {
        setTimeout(() => firstInputRef.current?.focus(), 50);
      }
    }
  }, [isOpen, initialData, settings]);

  // Keyboard Shortcuts for Modal
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    let finalValue: string | boolean = value;
    if (type === 'checkbox') {
      finalValue = (e.target as HTMLInputElement).checked;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: finalValue,
    }));

    // Clear error for this field
    if (name in errors) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    let isValid = true;

    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required';
      isValid = false;
    }

    const salePrice = parseFloat(formData.salePrice);
    if (isNaN(salePrice) || salePrice <= 0) {
      newErrors.salePrice = 'Valid sale price is required';
      isValid = false;
    }

    if (formData.gstPercent) {
      const gst = parseFloat(formData.gstPercent);
      if (isNaN(gst) || gst < 0 || gst > 100) {
        newErrors.gstPercent = 'GST must be between 0 and 100';
        isValid = false;
      }
    }

    // Purchase price optional but must be valid if entered
    if (formData.purchasePrice) {
      const pp = parseFloat(formData.purchasePrice);
      if (isNaN(pp) || pp < 0) {
        newErrors.purchasePrice = 'Invalid purchase price';
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }

    const payload = {
      name: formData.name,
      sku: formData.sku || undefined,
      barcode: formData.barcode || undefined,
      hsnCode: formData.hsnCode || undefined,
      salePrice: parseFloat(formData.salePrice),
      cost: formData.purchasePrice
        ? parseFloat(formData.purchasePrice)
        : isEditMode
          ? null
          : undefined,
      gstPercent: parseFloat(formData.gstPercent || '0'),
      stockQty: parseFloat(formData.stockQty || '0'),
      lowStockAlert: parseFloat(formData.lowStockAlert || '0'),
      isActive: formData.isActive,
      isGstInclusive: formData.isGstInclusive,
      trackInventory: formData.trackInventory,
    };

    try {
      if (isEditMode) {
        await updateProduct({ id: initialData.id, data: payload });
      } else {
        await createProduct(payload);
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to save product:', err);
    }
  };

  const isLoading = creating || updating;
  const errorMsg = createError || updateError;

  return (
    <div className="modal-overlay">
      <div className="modal-content product-form-modal">
        <div className="modal-header">
          <h2>{isEditMode ? 'Edit Product' : 'Add New Product'}</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <form id="product-form" onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && !Object.values(errors).some(Boolean) && (
              <div className="error-banner">{errorMsg}</div>
            )}

            <div className="form-group">
              <label>Product Name *</label>
              <input
                ref={firstInputRef}
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Product Name"
                className={errors.name ? 'error' : ''}
                disabled={isLoading}
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>SKU (Optional)</label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  placeholder="Unique Code"
                  disabled={isLoading}
                />
              </div>
              <div className="form-group">
                <label>Barcode (Scan)</label>
                <input
                  type="text"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleChange}
                  placeholder="Scan barcode"
                  disabled={isLoading}
                />
              </div>
              {settings.gstEnabled && (
                <div className="form-group">
                  <label>HSN / SAC (Optional)</label>
                  <input
                    type="text"
                    name="hsnCode"
                    value={formData.hsnCode}
                    onChange={handleChange}
                    placeholder="8-digit code"
                    disabled={isLoading}
                    maxLength={8}
                  />
                </div>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Sale Price (₹) *</label>
                <input
                  type="number"
                  name="salePrice"
                  value={formData.salePrice}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  className={errors.salePrice ? 'error' : ''}
                  disabled={isLoading}
                />
                {errors.salePrice && <span className="error-text">{errors.salePrice}</span>}
              </div>
              <div className="form-group">
                <label>Purchase Price (₹)</label>
                <input
                  type="number"
                  name="purchasePrice"
                  value={formData.purchasePrice}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  disabled={isLoading}
                />
                {errors.purchasePrice && <span className="error-text">{errors.purchasePrice}</span>}
              </div>
              {settings.gstEnabled && (
                <div className="form-group gst-group">
                  <label>GST %</label>
                  <div className="gst-select-wrapper">
                    <div className="gst-display-value">{formData.gstPercent}%</div>
                    <select
                      name="gstPercent"
                      value={formData.gstPercent}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="gst-select-overlay"
                    >
                      {APP_CONSTANTS.BUSINESS.GST_RATES.map((rate) => (
                        <option key={rate.value} value={rate.value}>
                          {rate.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.gstPercent && <span className="error-text">{errors.gstPercent}</span>}
                </div>
              )}
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                {!settings.billingOnly && (
                  <label
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontWeight: '500',
                    }}
                  >
                    <input
                      type="checkbox"
                      name="trackInventory"
                      checked={formData.trackInventory}
                      onChange={handleChange}
                      disabled={isLoading}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        transform: 'scale(1.1)',
                        accentColor: 'var(--color-primary)',
                      }}
                    />
                    Track Inventory
                  </label>
                )}

                {settings.gstEnabled && !settings.gstExclusiveMode && (
                  <label
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontWeight: '500',
                    }}
                  >
                    <input
                      type="checkbox"
                      name="isGstInclusive"
                      checked={formData.isGstInclusive}
                      onChange={handleChange}
                      disabled={isLoading}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        transform: 'scale(1.1)',
                        accentColor: 'var(--color-primary)',
                      }}
                    />
                    GST Inclusive (MRP)
                  </label>
                )}
              </div>

              {!settings.billingOnly && !formData.trackInventory && (
                <div
                  className="info-message"
                  style={{
                    padding: '0.75rem',
                    background: '#f3f4f6',
                    borderRadius: '4px',
                    marginTop: '0.5rem',
                    color: '#666',
                    fontSize: '0.85rem',
                    borderLeft: '4px solid #d1d5db',
                  }}
                >
                  Inventory tracking is disabled for this item. Stock quantity will not be tracked
                  or updated.
                </div>
              )}
            </div>

            {!settings.billingOnly && formData.trackInventory && (
              <div className="form-row">
                {!isEditMode && (
                  <div className="form-group">
                    <label>Opening Stock</label>
                    <input
                      type="number"
                      name="stockQty"
                      value={formData.stockQty}
                      onChange={handleChange}
                      placeholder="0"
                      disabled={isLoading}
                    />
                  </div>
                )}
                <div className="form-group">
                  <label>Low Stock Alert Qty</label>
                  <input
                    type="number"
                    name="lowStockAlert"
                    value={formData.lowStockAlert}
                    onChange={handleChange}
                    placeholder="e.g. 5"
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            {isEditMode && (
              <div className="form-row">
                <div className="form-group" style={{ justifyContent: 'center' }}>
                  <label
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={handleChange}
                      disabled={isLoading}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        transform: 'scale(1.1)',
                        accentColor: 'var(--color-primary)',
                      }}
                    />
                    Active Product
                  </label>
                </div>
              </div>
            )}
          </div>
        </form>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button type="submit" form="product-form" className="btn-primary" disabled={isLoading}>
            {isLoading ? 'Saving...' : isEditMode ? 'Update Product' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  );
};
