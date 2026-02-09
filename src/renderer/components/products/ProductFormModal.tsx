import React, { useState, useEffect, useRef } from 'react';
import { useIPCMutation } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import './ProductFormModal.css';

interface Product {
  id: number;
  name: string;
  sku?: string;
  barcode?: string;
  salePrice: number;
  purchasePrice?: number;
  gstPercent?: number;
  stockQty: number;
  lowStockAlert?: number;
  isActive: boolean;
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
  salePrice: string;
  purchasePrice: string;
  gstPercent: string;
  stockQty: string;
  lowStockAlert: string;
  isActive: boolean;
}

const INITIAL_STATE: FormData = {
  name: '',
  sku: '',
  barcode: '',
  salePrice: '',
  purchasePrice: '',
  gstPercent: '0',
  stockQty: '0',
  lowStockAlert: '5',
  isActive: true,
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

  const { execute: deleteProduct, loading: deleting } = useIPCMutation(IPC_CHANNELS.PRODUCT_DELETE);

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
          salePrice: (initialData.salePrice / 100).toFixed(2),
          purchasePrice: initialData.purchasePrice
            ? (initialData.purchasePrice / 100).toFixed(2)
            : '',
          gstPercent: initialData.gstPercent?.toString() || '0',
          stockQty: initialData.stockQty?.toString() || '0',
          lowStockAlert: initialData.lowStockAlert?.toString() || '5',
          isActive: initialData.isActive ?? true,
        });
      } else {
        setFormData(INITIAL_STATE);
      }
      setErrors({});
      // Focus name field only if creating, safely wait for render
      if (!initialData) {
        setTimeout(() => firstInputRef.current?.focus(), 50);
      }
    }
  }, [isOpen, initialData]);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
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
      salePrice: Math.round(parseFloat(formData.salePrice) * 100),
      cost: formData.purchasePrice
        ? Math.round(parseFloat(formData.purchasePrice) * 100)
        : undefined, // Maps to 'cost' in handlers
      gstPercent: parseFloat(formData.gstPercent || '0'),
      stockQty: parseFloat(formData.stockQty || '0'),
      lowStockAlert: parseFloat(formData.lowStockAlert || '0'),
      isActive: formData.isActive,
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

  const handleDelete = async () => {
    if (!initialData || !window.confirm(`Are you sure you want to delete "${initialData.name}"?`)) {
      return;
    }

    try {
      await deleteProduct(initialData.id);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to deactivate product:', err);
      alert('Failed to delete product. Please try again.');
    }
  };

  const isLoading = creating || updating || deleting;
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

        {errorMsg && !Object.values(errors).some(Boolean) && (
          <div className="error-banner">{errorMsg}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Product Name {isEditMode ? '(Immutable)' : '*'}</label>
            <input
              ref={firstInputRef}
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Maggi Masala Noodles"
              className={errors.name ? 'error' : ''}
              disabled={isLoading || isEditMode}
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
            <div className="form-group sm">
              <label>GST %</label>
              <input
                type="number"
                name="gstPercent"
                value={formData.gstPercent}
                onChange={handleChange}
                placeholder="0"
                disabled={isLoading}
              />
              {errors.gstPercent && <span className="error-text">{errors.gstPercent}</span>}
            </div>
          </div>

          {!isEditMode && (
            <div className="form-row">
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
            </div>
          )}

          <div className="form-row">
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

            {isEditMode && (
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
                    style={{ width: 'auto' }}
                  />
                  Active Product
                </label>
              </div>
            )}
          </div>

          <div className="modal-actions">
            {isEditMode && (
              <button
                type="button"
                className="btn-danger"
                onClick={handleDelete}
                disabled={isLoading}
                style={{ marginRight: 'auto' }}
              >
                {deleting ? 'Deleting...' : 'Delete Product'}
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Saving...' : isEditMode ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
