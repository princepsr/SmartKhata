import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useIPC, useIPCMutation } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { PurchaseOrder, Product, PurchaseOrderItem as PurchaseOrderItemIPC, IndianMedicine } from '@shared/types/ipc';
import { formatCurrency } from '../../utils/formatters';
import SearchableSelect from '../ui/SearchableSelect';
import { useAppSettingsStore } from '../../store';
import { medicalApi } from '../../services/medical-api';

interface PurchaseItem {
  productId?: number;
  productName: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  lineTotal: number;
  saltName?: string;
}

interface MedicineSuggestion {
  name: string;
  saltName?: string;
  isLocal: boolean;
  id?: number;
  gstPercent?: number;
  purchasePrice?: number;
  hsnCode?: string;
}

interface PurchaseOrderFormModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialPoId?: number;
}

// Supplier type for dropdown
interface SupplierInfo {
  id: number;
  name: string;
  gstin?: string | null;
}
const PurchaseOrderFormModal: React.FC<PurchaseOrderFormModalProps> = ({
  onClose,
  onSuccess,
  initialPoId,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    supplierId: 0,
    supplierNameSnapshot: '',
    supplierGstin: '',
    poNumber: '',
    poDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [items, setItems] = useState<PurchaseItem[]>([
    { productName: '', quantity: 1, unitPrice: 0, gstPercent: 0, lineTotal: 0 },
  ]);

  const [medicineSuggestions, setMedicineSuggestions] = useState<MedicineSuggestion[]>([]);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const { settings } = useAppSettingsStore();

  // Fetch active suppliers for the dropdown
  const { data: suppliersData, execute: fetchSuppliers } = useIPC<{ items: SupplierInfo[] }>(
    IPC_CHANNELS.SUPPLIER_LIST
  );
  const suppliers = suppliersData?.items || [];

  const { data: productsData, execute: fetchProducts } = useIPC<{ items: Product[] }>(
    IPC_CHANNELS.PRODUCT_LIST
  );

  const { data: poDetails, execute: fetchPoDetails } = useIPC<PurchaseOrder>(IPC_CHANNELS.PO_GET);

  useEffect(() => {
    fetchSuppliers({ includeInactive: false });
    fetchProducts({ includeInactive: false, pageSize: 10000 });
    if (initialPoId) {
      fetchPoDetails(initialPoId);
    }
  }, [fetchSuppliers, fetchProducts, fetchPoDetails, initialPoId]);

  useEffect(() => {
    if (poDetails) {
      setFormData({
        supplierId: poDetails.supplierId,
        supplierNameSnapshot: poDetails.supplierName,
        supplierGstin: poDetails.supplierGstin || '',
        poNumber: poDetails.poNumber,
        poDate: poDetails.poDate,
        notes: poDetails.notes || '',
      });
      if (poDetails.items && poDetails.items.length > 0) {
        setItems(
          poDetails.items.map((i: PurchaseOrderItemIPC) => ({
            productId: i.productId,
            productName: i.productName,
            hsnCode: i.hsnCode,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            gstPercent: i.gstPercent,
            lineTotal: i.lineTotal,
            saltName: i.saltName,
          }))
        );
      }
    }
  }, [poDetails]);

  const {
    execute: recordPO,
    loading: creating,
    error: createError,
  } = useIPCMutation<Partial<PurchaseOrder>, PurchaseOrder>(IPC_CHANNELS.PO_CREATE);

  const {
    execute: updatePO,
    loading: updating,
    error: updateError,
  } = useIPCMutation<{ id: number; data: Partial<PurchaseOrder> }, PurchaseOrder>(
    IPC_CHANNELS.PO_UPDATE
  );

  const loading = creating || updating;
  const error = createError || updateError;

  const addItem = () => {
    setItems([
      ...items,
      { productName: '', quantity: 1, unitPrice: 0, gstPercent: 0, lineTotal: 0 },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof PurchaseItem, value: string | number) => {
    const newItems = [...items];
    const item = { ...newItems[index] };

    if (field === 'productName') {
      item.productName = String(value);
    }
    if (field === 'hsnCode') {
      item.hsnCode = String(value);
    }
    if (field === 'saltName') {
      item.saltName = String(value);
    }

    // Recalculate line total for numeric fields
    if (field === 'quantity' || field === 'unitPrice' || field === 'gstPercent') {
      const valNum = Number(value) || 0;
      if (field === 'quantity') {
        item.quantity = valNum;
      }
      if (field === 'unitPrice') {
        item.unitPrice = valNum;
      }
      if (field === 'gstPercent') {
        item.gstPercent = valNum;
      }

      const q = item.quantity;
      const p = item.unitPrice;
      const g = item.gstPercent;
      const taxable = q * p;
      const gstAmount = (taxable * g) / 100;
      item.lineTotal = Math.round((taxable + gstAmount) * 100) / 100;
    }

    if (field === 'productName') {
      const valStr = String(value).trim().toLowerCase();
      setActiveRowIndex(index);

      if (settings.appMode === 'MEDICAL' && valStr.length >= 2) {
        // 1. Get internal inventory matches
        const localMatches = (productsData?.items || [])
          .filter((p) => p.name.toLowerCase().includes(valStr))
          .map((p) => ({ ...p, isLocal: true }))
          .slice(0, 5);

        // 2. Get global medicine database matches
        medicalApi.getMedicineSuggestions(valStr).then((globalMatches) => {
          const localNames = new Set(localMatches.map((p) => p.name.toLowerCase()));
          const uniqueGlobal: MedicineSuggestion[] = globalMatches
            .filter((g: IndianMedicine) => !localNames.has(g.name.toLowerCase()))
            .map((g: IndianMedicine) => ({ 
              name: g.name, 
              saltName: g.saltName, 
              isLocal: false 
            }))
            .slice(0, 10);

          setMedicineSuggestions([...(localMatches as unknown as MedicineSuggestion[]), ...uniqueGlobal]);
        });
      } else {
        setMedicineSuggestions([]);
      }

      const match = productsData?.items?.find((p) => p.name.trim().toLowerCase() === valStr);
      if (match) {
        item.productId = match.id;
        item.hsnCode = match.hsnCode || item.hsnCode;
        if (match.gstPercent) {
          item.gstPercent = match.gstPercent;
        }
        if (match.purchasePrice) {
          item.unitPrice = match.purchasePrice;
        }
        if (match.saltName) {
          item.saltName = match.saltName;
        }

        const q = Number(item.quantity) || 0;
        const p = item.unitPrice;
        const g = item.gstPercent;
        const taxable = q * p;
        const gstAmount = (taxable * g) / 100;
        item.lineTotal = Math.round((taxable + gstAmount) * 100) / 100;
      } else {
        item.productId = undefined;
      }
    }

    newItems[index] = item;
    setItems(newItems);
  };

  const calculateTotals = () => {
    return items.reduce(
      (acc, item) => ({
        taxable: acc.taxable + item.quantity * item.unitPrice,
        gst: acc.gst + (item.lineTotal - item.quantity * item.unitPrice),
        total: acc.total + item.lineTotal,
      }),
      { taxable: 0, gst: 0, total: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplierId) {
      return;
    }
    if (items.some((i) => !i.productName)) {
      return;
    }

    const totals = calculateTotals();
    const poData = {
      ...formData,
      totalTaxable: totals.taxable,
      gstTotal: totals.gst,
      grandTotal: totals.total,
      supplierGstin: formData.supplierGstin,
      status: poDetails?.status || 'PENDING',
      items: items.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        quantity: Number(i.quantity) || 0,
        unitPrice: Number(i.unitPrice) || 0,
        gstPercent: Number(i.gstPercent) || 0,
        hsnCode: i.hsnCode,
        lineTotal: Number(i.lineTotal) || 0,
        saltName: i.saltName,
      })),
    };

    try {
      const response = initialPoId
        ? await updatePO({ id: initialPoId, data: poData })
        : await recordPO(poData);

      if (response) {
        onSuccess();
      }
    } catch {
      // useIPCMutation handles the error state
    }
  };

  const totals = calculateTotals();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content purchase-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {initialPoId
              ? t('procurement.po.form.title_edit', { no: formData.poNumber })
              : t('procurement.po.form.title_new')}
          </h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid header-grid">
              <div className="form-group">
                <label>{t('procurement.form.supplier')}</label>
                <SearchableSelect
                  value={formData.supplierId}
                  options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                  onChange={(val) => {
                    const sId = Number(val);
                    const selected = suppliers.find((s) => s.id === sId);
                    const sName = selected?.name || '';
                    const sGstin = selected?.gstin || '';
                    setFormData({
                      ...formData,
                      supplierId: sId,
                      supplierNameSnapshot: sName,
                      supplierGstin: sGstin,
                    });
                  }}
                  placeholder={t('procurement.form.select_supplier')}
                />
              </div>
              <div className="form-group">
                <label>
                  {t('procurement.po.form.po_no')}{' '}
                  <small>{t('procurement.po.form.po_no_hint')}</small>
                </label>
                <input
                  type="text"
                  value={formData.poNumber}
                  onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                  placeholder="PO-2026-0001"
                />
              </div>
              <div className="form-group">
                <label>{t('procurement.po.form.po_date')}</label>
                <input
                  type="date"
                  value={formData.poDate}
                  onChange={(e) => setFormData({ ...formData, poDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="items-section">
              <h3>{t('procurement.po.form.items')}</h3>
              <div className="items-table-header grid-items">
                <div>{t('procurement.details.product')} *</div>
                <div>{t('procurement.details.hsn')}</div>
                <div className="text-center">{t('procurement.details.qty')}</div>
                <div className="text-center">{t('procurement.details.rate')}</div>
                <div className="text-center">{t('procurement.details.gst_percent')}</div>
                <div className="text-right">{t('common.total')}</div>
                <div></div>
              </div>
              <div className="items-table-body">
                {items.map((item, index) => (
                  <div key={index} className="items-table-row grid-items">
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={item.productName}
                        onChange={(e) => updateItem(index, 'productName', e.target.value)}
                        onBlur={() => {
                          // Tiny delay to allow onClick to fire on suggestions
                          setTimeout(() => {
                            if (activeRowIndex === index) {
                              setMedicineSuggestions([]);
                              setActiveRowIndex(null);
                            }
                          }, 200);
                        }}
                        placeholder={t('procurement.form.item_placeholder')}
                        required
                        autoComplete="off"
                      />
                      {activeRowIndex === index && medicineSuggestions.length > 0 && (
                        <div className="items-suggestions-dropdown">
                          {medicineSuggestions.map((suggestion, sIdx) => (
                            <div
                              key={`${suggestion.name}-${sIdx}`}
                              className="items-suggestion-item"
                              onMouseDown={(e) => {
                                e.preventDefault(); // Prevent input onBlur
                                updateItem(index, 'productName', suggestion.name);
                                updateItem(index, 'saltName', suggestion.saltName);
                                setMedicineSuggestions([]);
                                setActiveRowIndex(null);
                              }}
                            >
                              <div className="brand-name">{suggestion.name}</div>
                              <div className="salt-name">{suggestion.saltName}</div>
                              {suggestion.isLocal ? (
                                <span className="inventory-tag">
                                  {t('billing.stock_prefix')} {t('common.active')}
                                </span>
                              ) : (
                                <span className="global-tag">New Global Medicine</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <input
                        type="text"
                        value={item.hsnCode || ''}
                        onChange={(e) => updateItem(index, 'hsnCode', e.target.value)}
                        placeholder={t('procurement.details.hsn')}
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        className="text-center"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        min="0.01"
                        step="0.01"
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        className="text-right"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                    <div>
                      <select
                        className="text-center"
                        value={item.gstPercent}
                        onChange={(e) => updateItem(index, 'gstPercent', Number(e.target.value))}
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </div>
                    <div className="text-right col-total">{formatCurrency(item.lineTotal)}</div>
                    <div>
                      <button
                        type="button"
                        className="btn-remove"
                        onClick={() => removeItem(index)}
                        title={t('common.delete')}
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="btn-outline" onClick={addItem}>
                <span>+</span> {t('procurement.form.add_item')}
              </button>
            </div>

            <div className="purchase-footer">
              <div className="notes-area">
                <label>{t('procurement.po.form.notes')}</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={t('procurement.settle.notes')}
                />
              </div>
              <div className="totals-area">
                <div className="total-row">
                  <span>{t('procurement.po.form.taxable')}</span>
                  <span>{formatCurrency(totals.taxable)}</span>
                </div>
                <div className="total-row">
                  <span>{t('procurement.po.form.gst')}</span>
                  <span>{formatCurrency(totals.gst)}</span>
                </div>
                <div className="total-row grand-total">
                  <span>{t('procurement.po.form.total')}</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            {error && (
              <div className="error-message" style={{ color: 'red', marginRight: 'auto' }}>
                {error}
              </div>
            )}
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? t('procurement.settle.saving') : t('procurement.po.form.save_draft')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PurchaseOrderFormModal;
