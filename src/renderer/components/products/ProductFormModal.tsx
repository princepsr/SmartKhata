import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useIPCMutation } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { useAppSettingsStore } from '../../store';
import { APP_CONSTANTS } from '@shared/constants/app-constants';
import { medicalApi } from '../../services/medical-api';
import type { IndianMedicine } from '@shared/types/ipc';
import type { CreateProductRequest, UpdateProductRequest } from '@shared/validation/schemas';
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
  saltName?: string;
  batchNumber?: string;
  expiryDate?: string;
  uom?: string;
  isWeightBased?: boolean;
  stripSize?: number;
  drugCategory?: string;
  variantGroupId?: string | null;
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
  saltName: string;
  batchNumber: string;
  expiryDate: string;
  uom: string;
  isWeightBased: boolean;
  stripSize: string;
  drugCategory: string;
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
  saltName: '',
  batchNumber: '',
  expiryDate: '',
  uom: 'Pcs',
  isWeightBased: false,
  stripSize: '10',
  drugCategory: '',
};

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<FormData>(INITIAL_STATE);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [saltSuggestions, setSaltSuggestions] = useState<string[]>([]);
  const [medicineSuggestions, setMedicineSuggestions] = useState<IndianMedicine[]>([]);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const { settings } = useAppSettingsStore();

  const isEditMode = !!initialData;

  // IPC Mutations
  const {
    execute: createProduct,
    loading: creating,
    error: createError,
  } = useIPCMutation<CreateProductRequest, Product>(IPC_CHANNELS.PRODUCT_CREATE);

  const {
    execute: updateProduct,
    loading: updating,
    error: updateError,
  } = useIPCMutation<UpdateProductRequest, Product>(IPC_CHANNELS.PRODUCT_UPDATE);

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
          saltName: initialData.saltName || '',
          batchNumber: initialData.batchNumber || '',
          expiryDate: initialData.expiryDate || '',
          uom: initialData.uom || 'Pcs',
          isWeightBased: initialData.isWeightBased || false,
          stripSize: initialData.stripSize?.toString() || '10',
          drugCategory: initialData.drugCategory || '',
        });
      } else {
        const defaultUom = settings.appMode === 'MEDICAL' ? 'Strip' : 'Pcs';
        setFormData({
          ...INITIAL_STATE,
          gstPercent: (settings?.gstPercentage ?? 18).toString(),
          isGstInclusive: settings?.gstExclusiveMode ? false : true,
          uom: defaultUom,
          isWeightBased: false,
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

    setFormData((prev) => {
      const updated = { ...prev, [name]: finalValue };

      // Auto-update logic for "Sold by Weight" based on UOM (Kirana only)
      if (name === 'uom') {
        const weightUnits = ['Kg', 'Ltr'];
        if (settings.appMode === 'KIRANA') {
          updated.isWeightBased = weightUnits.includes(String(finalValue));
        } else {
          updated.isWeightBased = false;
        }
      }

      // Auto-update UOM logic based on checkbox (legacy support - Kirana only)
      if (settings.appMode === 'KIRANA') {
        if (name === 'isWeightBased' && finalValue === true) {
          if (updated.uom !== 'Kg' && updated.uom !== 'Ltr') {
            updated.uom = 'Kg';
          }
        } else if (name === 'isWeightBased' && finalValue === false) {
          if (updated.uom === 'Kg' || updated.uom === 'Ltr') {
            updated.uom = 'Pcs';
          }
        }
      }

      return updated;
    });

    // Clear error for this field
    if (name in errors) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    let isValid = true;

    if (!formData.name.trim()) {
      newErrors.name = t('inventory.form.name_required');
      isValid = false;
    }

    const salePrice = parseFloat(formData.salePrice);
    if (isNaN(salePrice) || salePrice <= 0) {
      newErrors.salePrice = t('inventory.form.errors.sale_price_required');
      isValid = false;
    }

    if (formData.gstPercent) {
      const gst = parseFloat(formData.gstPercent);
      if (isNaN(gst) || gst < 0 || gst > 100) {
        newErrors.gstPercent = t('inventory.form.errors.gst_range');
        isValid = false;
      }
    }

    // Purchase price optional but must be valid if entered
    if (formData.purchasePrice) {
      const pp = parseFloat(formData.purchasePrice);
      if (isNaN(pp) || pp < 0) {
        newErrors.purchasePrice = t('inventory.form.errors.purchase_price_invalid');
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
      saltName: formData.saltName || undefined,
      batchNumber: formData.batchNumber || undefined,
      expiryDate: formData.expiryDate || undefined,
      uom: formData.uom,
      isWeightBased: formData.isWeightBased,
      stripSize: parseInt(formData.stripSize) || 10,
      drugCategory: formData.drugCategory || undefined,
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
          <h2>{isEditMode ? t('inventory.form.edit_title') : t('inventory.form.add_title')}</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <form id="product-form" onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && !Object.values(errors).some(Boolean) && (
              <div className="error-banner">{errorMsg}</div>
            )}

            <div className="form-group salt-suggestions-container">
              <label>{t('inventory.form.name')}</label>
              <input
                ref={firstInputRef}
                type="text"
                name="name"
                value={formData.name}
                onChange={async (e) => {
                  const val = e.target.value;
                  handleChange(e);
                  if (settings.appMode === 'MEDICAL' && val.length >= 2) {
                    const suggestions = await medicalApi.getMedicineSuggestions(val);
                    setMedicineSuggestions(suggestions);
                  } else {
                    setMedicineSuggestions([]);
                  }
                }}
                placeholder={t(`inventory.form.name_placeholder_${settings.appMode}`)}
                className={errors.name ? 'error' : ''}
                autoFocus
                disabled={isLoading}
              />
              {medicineSuggestions.length > 0 && (
                <ul className="salt-suggestions-dropdown">
                  {medicineSuggestions.map((med) => (
                    <li
                      key={med.name}
                      className="salt-suggestion-item"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          name: med.name,
                          saltName: med.saltName,
                        }));
                        setMedicineSuggestions([]);
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{med.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{med.saltName}</div>
                    </li>
                  ))}
                </ul>
              )}
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            {settings.appMode === 'MEDICAL' && (
              <div className="form-group salt-suggestions-container">
                <label>{t('inventory.form.generic_salt')}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    name="saltName"
                    value={formData.saltName}
                    onChange={async (e) => {
                      handleChange(e);
                      const val = e.target.value;
                      if (val.length >= 2) {
                        const suggestions = await medicalApi.getSaltSuggestions(val);
                        setSaltSuggestions(suggestions);
                      } else {
                        setSaltSuggestions([]);
                      }
                    }}
                    placeholder={t('inventory.form.salt_placeholder')}
                    disabled={isLoading}
                    autoComplete="off"
                  />
                  {saltSuggestions.length > 0 && (
                    <ul className="salt-suggestions-dropdown">
                      {saltSuggestions.map((salt) => (
                        <li
                          key={salt}
                          className="salt-suggestion-item"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, saltName: salt }));
                            setSaltSuggestions([]);
                          }}
                        >
                          {salt}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>{t('inventory.form.sku_optional')}</label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  placeholder={t('inventory.form.sku_placeholder')}
                  disabled={isLoading}
                />
              </div>
              <div className="form-group">
                <label>{t('inventory.form.barcode_scan')}</label>
                <input
                  type="text"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleChange}
                  placeholder={t('inventory.form.barcode_scan')}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('inventory.form.uom')}</label>
                <select
                  name="uom"
                  value={formData.uom}
                  onChange={handleChange}
                  disabled={isLoading}
                >
                  {settings.appMode === 'MEDICAL' ? (
                    <>
                      <option value="Strip">{t('inventory.form.uom_options.strip')}</option>
                      <option value="Tablet">{t('inventory.form.uom_options.tablet')}</option>
                      <option value="Capsule">{t('inventory.form.uom_options.capsule')}</option>
                      <option value="Bottle">{t('inventory.form.uom_options.bottle')}</option>
                      <option value="Tube">{t('inventory.form.uom_options.tube')}</option>
                      <option value="Injection">{t('inventory.form.uom_options.injection')}</option>
                      <option value="Sachet">{t('inventory.form.uom_options.sachet')}</option>
                      <option value="Pcs">{t('inventory.form.uom_options.pcs')}</option>
                    </>
                  ) : settings.appMode === 'KIRANA' ? (
                    <>
                      <option value="Pcs">{t('inventory.form.uom_options.pcs')}</option>
                      <option value="Kg">{t('inventory.form.uom_options.kg')}</option>
                      <option value="Ltr">{t('inventory.form.uom_options.ltr')}</option>
                      <option value="Packet">{t('inventory.form.uom_options.packet')}</option>
                      <option value="Box">{t('inventory.form.uom_options.box')}</option>
                      <option value="Bag">{t('inventory.form.uom_options.bag')}</option>
                      <option value="Dozen">{t('inventory.form.uom_options.dozen')}</option>
                    </>
                  ) : (
                    <>
                      <option value="Pcs">{t('inventory.form.uom_options.pcs')}</option>
                      <option value="Unit">{t('inventory.form.uom_options.unit')}</option>
                      <option value="Packet">{t('inventory.form.uom_options.packet')}</option>
                      <option value="Box">{t('inventory.form.uom_options.box')}</option>
                      <option value="Set">{t('inventory.form.uom_options.set')}</option>
                      <option value="Bottle">{t('inventory.form.uom_options.bottle')}</option>
                      <option value="Kg">{t('inventory.form.uom_options.kg')}</option>
                      <option value="Ltr">{t('inventory.form.uom_options.ltr')}</option>
                    </>
                  )}
                </select>
              </div>
              {settings.gstEnabled && (
                <div className="form-group">
                  <label>{t('inventory.form.hsn')}</label>
                  <input
                    type="text"
                    name="hsnCode"
                    value={formData.hsnCode}
                    onChange={handleChange}
                    placeholder={t('inventory.form.hsn_placeholder')}
                    disabled={isLoading}
                    maxLength={12}
                  />
                </div>
              )}
            </div>

            {settings.enableBatchTracking && (
              <div className="form-row">
                <div className="form-group">
                  <label>{t('inventory.form.batch')}</label>
                  <input
                    type="text"
                    name="batchNumber"
                    value={formData.batchNumber}
                    onChange={handleChange}
                    placeholder={t('inventory.form.batch_placeholder')}
                    disabled={isLoading}
                  />
                </div>
                <div className="form-group">
                  <label>{t('inventory.form.expiry')}</label>
                  <input
                    type="date"
                    name="expiryDate"
                    value={formData.expiryDate}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            {settings.appMode === 'MEDICAL' && (
              <div
                className="form-group animate-fade-in"
                style={{
                  marginTop: '1.5rem',
                  padding: '1rem',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <label
                  style={{
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '0.5rem',
                    display: 'block',
                  }}
                >
                  💊 {t('inventory.form.medical_classification')}
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label htmlFor="drugCategory" style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    {t('inventory.form.drug_category')}
                  </label>
                  <select
                    id="drugCategory"
                    name="drugCategory"
                    value={formData.drugCategory}
                    onChange={handleChange}
                    disabled={isLoading}
                  >
                    <option value="">{t('inventory.form.drug_category_options.none')}</option>
                    <option value="H">{t('inventory.form.drug_category_options.h')}</option>
                    <option value="H1">{t('inventory.form.drug_category_options.h1')}</option>
                    <option value="X">{t('inventory.form.drug_category_options.x')}</option>
                    <option value="G">{t('inventory.form.drug_category_options.g')}</option>
                  </select>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                    {t('inventory.form.drug_category_help')}
                  </p>
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>{t('inventory.form.sale_price')}</label>
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
                <label>{t('inventory.form.purchase_price')}</label>
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
                  <label>{t('inventory.form.gst_percent')}</label>
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
                    {t('inventory.form.track_inventory')}
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
                    {t('inventory.form.gst_inclusive_mrp')}
                  </label>
                )}

                {settings.appMode === 'KIRANA' && (
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
                      name="isWeightBased"
                      checked={formData.isWeightBased}
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
                    {t('inventory.form.sold_by_weight')} ({t('inventory.form.weight_description')})
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
                  {t('inventory.form.inventory_disabled_help')}
                </div>
              )}
            </div>

            {!settings.billingOnly && formData.trackInventory && (
              <div className="form-row">
                {!isEditMode && (
                  <div className="form-group">
                    <label>{t('inventory.form.opening_stock')}</label>
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
                  <label>{t('inventory.form.low_stock_threshold')}</label>
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
                    {t('inventory.form.active_product')}
                  </label>
                </div>
              </div>
            )}
          </div>
        </form>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isLoading}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="product-form" className="btn-primary" disabled={isLoading}>
            {isLoading
              ? t('common.processing')
              : isEditMode
                ? t('inventory.form.update')
                : t('inventory.form.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
