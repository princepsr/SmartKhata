import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useIPC, useIPCMutation } from '../hooks/useIPC';
import { useConfirm } from '../hooks/useConfirm';
import { useSearchParams } from 'react-router-dom';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { 
  Purchase, 
  Supplier, 
  PurchaseOrder, 
  Product, 
  RecordPurchaseInput, 
  PurchaseWithItems 
} from '@shared/types/ipc';
import { formatCurrency } from '../utils/formatters';
import { useAppSettingsStore } from '../store';
import EmptyState from '../components/common/EmptyState';
import SuppliersPage, { SuppliersPageHandle } from './SuppliersPage';
import PurchaseOrdersTab from '../components/purchases/PurchaseOrdersTab';
import PurchaseOrderFormModal from '../components/purchases/PurchaseOrderFormModal';
import SearchableSelect from '../components/ui/SearchableSelect';
import './PurchasesPage.css';

// Local item type for the form
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

const PurchasesPage: React.FC = () => {
  const { t } = useTranslation();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [poDataForPurchase, setPoDataForPurchase] = useState<PurchaseOrder | null>(null);
  const [viewingPurchaseId, setViewingPurchaseId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'purchases' | 'suppliers' | 'orders'>('purchases');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [refreshOrderKey, setRefreshOrderKey] = useState(0);
  const suppliersPageRef = React.useRef<SuppliersPageHandle>(null);

  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [showInactiveSuppliers, setShowInactiveSuppliers] = useLocalStorage(
    'suppliers_show_inactive',
    false
  );
  const [showDuesOnlySuppliers, setShowDuesOnlySuppliers] = useLocalStorage(
    'suppliers_show_dues_only',
    false
  );

  const {
    data: purchases,
    loading,
    execute: fetchPurchases,
  } = useIPC<{ data: Purchase[]; total: number }>(IPC_CHANNELS.PURCHASE_LIST);

  const { settings } = useAppSettingsStore();
  const { execute: fetchPoDetails } = useIPCMutation<number, PurchaseOrder>(IPC_CHANNELS.PO_GET);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (settings.gstEnabled) {
      fetchPurchases(dateRange);
    }
  }, [dateRange, fetchPurchases, settings.gstEnabled]);

  // Handle action triggers
  useEffect(() => {
    const action = searchParams.get('action');
    const tab = searchParams.get('tab');

    if (
      tab &&
      (tab === 'purchases' || tab === 'suppliers' || tab === 'orders') &&
      tab !== activeTab
    ) {
      setActiveTab(tab as 'purchases' | 'suppliers' | 'orders');
    }

    if (action === 'purchase') {
      setActiveTab('purchases');
      setIsAddingNew(true);
      // Remove action from URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
    } else if (action === 'order') {
      setActiveTab('orders');
      setIsAddingNew(true);
      // Remove action from URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams, activeTab]);

  if (!settings.gstEnabled) {
    return (
      <div className="page purchases-page">
        <EmptyState
          title={t('procurement.purchases.gst_disabled_title')}
          message={t('procurement.purchases.gst_disabled_msg')}
          icon="📦"
        />
      </div>
    );
  }

  return (
    <div className="page purchases-page">
      <div className="page-content-wrapper animate-fade-in">
        <header className="page-header">
          <div>
            <h1 className="page-title">{t('procurement.title')}</h1>
          </div>
          <div className="header-actions">
            {(activeTab === 'purchases' || activeTab === 'orders') && (
              <>
                <div className="filters">
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                  />
                  <span>{t('procurement.filters.to')}</span>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  />
                </div>
                {activeTab === 'purchases' ? (
                  <button className="btn-primary" onClick={() => setIsAddingNew(true)}>
                    + {t('procurement.actions.record_purchase')}
                  </button>
                ) : (
                  <button className="btn-primary" onClick={() => setIsAddingNew(true)}>
                    + {t('procurement.actions.create_order')}
                  </button>
                )}
              </>
            )}
            {activeTab === 'suppliers' && (
              <>
                <div className="filter-group">
                  <label className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={showInactiveSuppliers}
                      onChange={(e) => setShowInactiveSuppliers(e.target.checked)}
                    />
                    {t('procurement.filters.show_inactive')}
                  </label>
                  <label className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={showDuesOnlySuppliers}
                      onChange={(e) => setShowDuesOnlySuppliers(e.target.checked)}
                    />
                    {t('procurement.filters.show_dues')}
                  </label>
                </div>
                <div className="search-bar">
                  <input
                    type="text"
                    className="search-input"
                    placeholder={t('procurement.filters.search_placeholder')}
                    value={supplierSearchQuery}
                    onChange={(e) => setSupplierSearchQuery(e.target.value)}
                  />
                </div>
                <button
                  className="btn-primary"
                  onClick={() => suppliersPageRef.current?.handleCreateNew()}
                >
                  + {t('procurement.actions.add_supplier')}
                </button>
              </>
            )}
          </div>
        </header>

        <div className="tabs" style={{ margin: '0 1.5rem 1.5rem' }}>
          <button
            className={activeTab === 'purchases' ? 'active' : ''}
            onClick={() => setActiveTab('purchases')}
          >
            {t('procurement.tabs.purchases')}
          </button>
          <button
            className={activeTab === 'orders' ? 'active' : ''}
            onClick={() => setActiveTab('orders')}
          >
            {t('procurement.tabs.orders')}
          </button>
          <button
            className={activeTab === 'suppliers' ? 'active' : ''}
            onClick={() => setActiveTab('suppliers')}
          >
            {t('procurement.tabs.suppliers')}
          </button>
        </div>

        <div className="purchases-content">
          {activeTab === 'purchases' ? (
            <>
              {loading ? (
                <div className="loading-state">{t('procurement.purchases.loading')}</div>
              ) : !purchases || purchases.data.length === 0 ? (
                <EmptyState
                  title={t('procurement.purchases.no_found')}
                  message={t('procurement.purchases.empty_msg')}
                  icon="📦"
                  action={{
                    label: t('procurement.actions.record_first'),
                    onClick: () => setIsAddingNew(true),
                  }}
                />
              ) : (
                <div className="data-table-container">
                  <div className="data-table-header grid-purchases">
                    <div className="col-date">{t('procurement.purchases.table.date')}</div>
                    <div className="col-purchase-no">{t('procurement.purchases.table.p_no')}</div>
                    <div className="col-supplier">{t('procurement.purchases.table.supplier')}</div>
                    <div className="col-inv">{t('procurement.purchases.table.inv_no')}</div>
                    <div className="col-gst">{t('procurement.purchases.table.gst')}</div>
                    <div>{t('procurement.purchases.table.total')}</div>
                    <div className="col-actions">{t('procurement.purchases.table.actions')}</div>
                  </div>
                  <div className="data-table-body">
                    {purchases.data.map((p) => (
                      <div
                        className="data-table-row grid-purchases"
                        key={p.id}
                        onClick={() => setViewingPurchaseId(p.id)}
                      >
                        <div className="col-date">
                          {new Date(p.invoiceDate).toLocaleDateString('en-IN')}
                        </div>
                        <div className="col-purchase-no font-mono">{p.purchaseNumber}</div>
                        <div className="col-supplier">
                          <div className="supplier-info">
                            <span className="name">{p.supplierName}</span>
                            {p.supplierGstin && <span className="gstin">{p.supplierGstin}</span>}
                          </div>
                        </div>
                        <div className="col-inv">{p.invoiceNumber || '-'}</div>
                        <div className="col-gst">{formatCurrency(p.gstTotal)}</div>
                        <div>{formatCurrency(p.grandTotal)}</div>
                        <div className="col-actions">
                          <button
                            className="action-icon-btn"
                            title={t('common.view_details')}
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingPurchaseId(p.id);
                            }}
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : activeTab === 'orders' ? (
            <PurchaseOrdersTab
              dateRange={dateRange}
              refreshKey={refreshOrderKey}
              onCreateClick={() => {
                setPoDataForPurchase(null);
                setIsAddingNew(true);
              }}
              onReceive={async (po) => {
                const fullPo = await fetchPoDetails(po.id);
                setPoDataForPurchase(fullPo);
                setIsAddingNew(true);
                setActiveTab('purchases');
              }}
            />
          ) : (
            <SuppliersPage
              ref={suppliersPageRef}
              showHeader={false}
              searchQuery={supplierSearchQuery}
              showInactive={showInactiveSuppliers}
              showDuesOnly={showDuesOnlySuppliers}
            />
          )}
        </div>
      </div>
      {isAddingNew && activeTab === 'purchases' && (
        <PurchaseFormModal
          initialPoData={poDataForPurchase || undefined}
          onClose={() => {
            setIsAddingNew(false);
            setPoDataForPurchase(null);
          }}
          onSuccess={() => {
            setIsAddingNew(false);
            setPoDataForPurchase(null);
            fetchPurchases(dateRange);
            setRefreshOrderKey((prev) => prev + 1);
          }}
        />
      )}

      {isAddingNew && activeTab === 'orders' && (
        <PurchaseOrderFormModal
          onClose={() => setIsAddingNew(false)}
          onSuccess={() => {
            setIsAddingNew(false);
            setRefreshOrderKey((prev) => prev + 1);
          }}
        />
      )}

      {viewingPurchaseId && (
        <PurchaseDetailsModal
          purchaseId={viewingPurchaseId}
          onClose={() => setViewingPurchaseId(null)}
        />
      )}
    </div>
  );
};

interface PurchaseFormModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialPoData?: PurchaseOrder;
}

const PurchaseFormModal: React.FC<PurchaseFormModalProps> = ({
  onClose,
  onSuccess,
  initialPoData,
}) => {
  const { t } = useTranslation();
  const { alert } = useConfirm();
  const [formData, setFormData] = useState({
    supplierId: initialPoData?.supplierId || (undefined as number | undefined),
    supplierName: initialPoData?.supplierName || '',
    supplierGstin: initialPoData?.supplierGstin || '', // Pre-fill from PO data
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    notes: initialPoData ? `Converted from PO: ${initialPoData.poNumber}` : '',
    paymentStatus: 'PAID' as 'PAID' | 'PENDING',
    amountPaid: 0,
  });

  const [items, setItems] = useState<PurchaseItem[]>(
    initialPoData?.items?.map((item) => ({
      productId: item.productId || undefined,
      productName: item.productName,
      hsnCode: item.hsnCode || undefined,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      gstPercent: item.gstPercent,
      lineTotal: item.lineTotal,
      saltName: item.saltName,
    })) || [{ productName: '', quantity: 1, unitPrice: 0, gstPercent: 0, lineTotal: 0 }]
  );

  const { data: suppliersData, execute: fetchSuppliers } = useIPC<{ items: Supplier[] }>(
    IPC_CHANNELS.SUPPLIER_LIST
  );

  const { data: productsData, execute: fetchProducts } = useIPC<{ items: Product[] }>(
    IPC_CHANNELS.PRODUCT_LIST
  );

  useEffect(() => {
    fetchSuppliers({ includeInactive: false });
    fetchProducts({ includeInactive: false, pageSize: 10000 });
  }, [fetchSuppliers, fetchProducts]);

  const { execute: convertPo } = useIPCMutation<number, boolean>(IPC_CHANNELS.PO_CONVERT);

  const {
    execute: recordPurchase,
    loading: modalLoading,
    error: modalError,
  } = useIPCMutation<RecordPurchaseInput, PurchaseWithItems>(IPC_CHANNELS.PURCHASE_RECORD);

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

    // Set the basic value
    if (field === 'productName') {
      item.productName = String(value);
    }
    if (field === 'hsnCode') {
      item.hsnCode = String(value);
    }

    // Ensure numbers for numeric fields
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

      const qt = item.quantity;
      const p = item.unitPrice;
      const g = item.gstPercent;

      const taxable = qt * p;
      const gstAmount = (taxable * g) / 100;
      item.lineTotal = Math.round((taxable + gstAmount) * 100) / 100;
    }

    if (field === 'productName') {
      const valStr = String(value).trim().toLowerCase();
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

        // Recalculate totals
        const qt = Number(item.quantity) || 0;
        const p = item.unitPrice;
        const g = item.gstPercent;
        const taxable = qt * p;
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
      (acc, item) => {
        const lineTaxable = item.quantity * item.unitPrice;
        const lineGst = (lineTaxable * item.gstPercent) / 100;
        return {
          taxable: acc.taxable + lineTaxable,
          gst: acc.gst + lineGst,
          total: acc.total + item.lineTotal,
        };
      },
      { taxable: 0, gst: 0, total: 0 }
    );
  };

  const totals = calculateTotals();

  // Sync amountPaid if status is PAID
  useEffect(() => {
    if (formData.paymentStatus === 'PAID') {
      setFormData((prev) => ({ ...prev, amountPaid: totals.total }));
    }
  }, [formData.paymentStatus, totals.total]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplierName) {
      await alert({
        title: t('procurement.form.errors.missing_info'),
        message: t('procurement.form.errors.supplier_req'),
        type: 'warning',
      });
      return;
    }
    if (items.some((i) => !i.productName)) {
      await alert({
        title: t('procurement.form.errors.missing_info'),
        message: t('procurement.form.errors.product_req'),
        type: 'warning',
      });
      return;
    }

    try {
      const response = await recordPurchase({
        supplierName: formData.supplierName,
        supplierGstin: formData.supplierGstin,
        invoiceNumber: formData.invoiceNumber,
        invoiceDate: formData.invoiceDate,
        notes: formData.notes,
        supplierId: formData.supplierId,
        paymentStatus: formData.paymentStatus,
        amountPaid: formData.amountPaid,
        items: items.map((i) => ({
          productName: i.productName,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          gstPercent: Number(i.gstPercent),
          hsnCode: i.hsnCode,
          productId: i.productId,
          saltName: i.saltName,
        })),
      });

      if (response) {
        // If this was from a PO, mark PO as received
        if (initialPoData?.id) {
          await convertPo(initialPoData.id);
        }
        onSuccess();
      }
    } catch (err) {
      console.error('Record purchase failed:', err);
      await alert({
        title: t('common.error'),
        message: t('procurement.form.errors.record_fail'),
        type: 'danger',
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content purchase-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('procurement.form.title_new')}</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label>{t('procurement.form.supplier')}</label>
                <SearchableSelect
                  value={formData.supplierId || ''}
                  options={
                    suppliersData?.items?.map((s) => ({
                      value: s.id || 0,
                      label: s.name,
                    })) || []
                  }
                  onChange={(val) => {
                    const supplier = suppliersData?.items?.find((s) => s.id === Number(val));
                    if (supplier) {
                      setFormData({
                        ...formData,
                        supplierId: supplier.id,
                        supplierName: supplier.name,
                        supplierGstin: supplier.gstin || '',
                      });
                    }
                  }}
                  placeholder={t('procurement.form.select_supplier')}
                />
              </div>
              <div className="form-group">
                <label>{t('procurement.form.payment_status')}</label>
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="paymentStatus"
                      checked={formData.paymentStatus === 'PAID'}
                      onChange={() => setFormData({ ...formData, paymentStatus: 'PAID' })}
                    />
                    {t('procurement.form.paid')}
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="paymentStatus"
                      checked={formData.paymentStatus === 'PENDING'}
                      onChange={() => setFormData({ ...formData, paymentStatus: 'PENDING' })}
                    />
                    {t('procurement.form.credit')}
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label>{t('procurement.form.amount_paid')}</label>
                <input
                  type="number"
                  value={formData.amountPaid}
                  onChange={(e) => setFormData({ ...formData, amountPaid: Number(e.target.value) })}
                  disabled={formData.paymentStatus === 'PAID'}
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label>{t('procurement.form.inv_no')}</label>
                <input
                  type="text"
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                  placeholder="e.g. INV-001"
                />
              </div>
              <div className="form-group">
                <label>{t('procurement.form.inv_date')}</label>
                <input
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="items-section">
              <h3>{t('procurement.form.items')}</h3>
              <table className="items-entry-table">
                <thead>
                  <tr>
                    <th>{t('procurement.form.item_name_label')}</th>
                    <th style={{ width: '100px' }}>{t('procurement.form.hsn_label')}</th>
                    <th style={{ width: '90px' }} className="text-center">
                      {t('procurement.form.qty_label')}
                    </th>
                    <th style={{ width: '140px' }} className="text-center">
                      {t('procurement.form.unit_price_label')}
                    </th>
                    <th style={{ width: '110px' }} className="text-center">
                      {t('procurement.form.gst_label')} %
                    </th>
                    <th style={{ width: '150px' }} className="text-right">
                      {t('procurement.form.total_label')}
                    </th>
                    <th style={{ width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          type="text"
                          list="purchase-products-datalist"
                          value={item.productName}
                          onChange={(e) => updateItem(index, 'productName', e.target.value)}
                          placeholder={t('procurement.form.item_placeholder')}
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.hsnCode || ''}
                          onChange={(e) => updateItem(index, 'hsnCode', e.target.value)}
                          placeholder="HSN"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="text-center"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                          min="0.01"
                          step="0.01"
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="text-right"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                          min="0"
                          step="0.01"
                          required
                        />
                      </td>
                      <td>
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
                      </td>
                      <td className="text-right font-mono" style={{ fontWeight: 600 }}>
                        {formatCurrency(item.lineTotal)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-remove"
                          onClick={() => removeItem(index)}
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="purchase-products-datalist">
                {productsData?.items?.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
              <button type="button" className="btn-outline" onClick={addItem}>
                + Add Item
              </button>
            </div>

            <div className="purchase-footer">
              <div className="notes-area">
                <label>{t('procurement.form.notes')}</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={t('procurement.form.notes_placeholder')}
                />
              </div>
              <div className="totals-area">
                <div className="total-row">
                  <span>{t('procurement.form.taxable_amt')}</span>
                  <span>{formatCurrency(totals.taxable)}</span>
                </div>
                <div className="total-row">
                  <span>{t('procurement.form.gst_amt')}</span>
                  <span>{formatCurrency(totals.gst)}</span>
                </div>
                <div className="total-row grand-total">
                  <span>{t('procurement.form.grand_total')}</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            {modalError && (
              <div className="error-message" style={{ color: 'red', marginRight: 'auto' }}>
                {modalError}
              </div>
            )}
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={modalLoading}>
              {modalLoading ? t('procurement.form.saving') : t('procurement.form.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PurchasesPage;

interface PurchaseDetailsModalProps {
  purchaseId: number;
  onClose: () => void;
}

interface DetailedPurchase extends Purchase {
  items?: {
    productName: string;
    quantity: number;
    unitPrice: number;
    gstPercent: number;
    lineTotal: number;
    hsnCode?: string;
  }[];
  totalTaxable: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
}

const PurchaseDetailsModal: React.FC<PurchaseDetailsModalProps> = ({ purchaseId, onClose }) => {
  const { t } = useTranslation();
  const {
    data: purchase,
    loading,
    execute: fetchPurchase,
  } = useIPC<DetailedPurchase>(IPC_CHANNELS.PURCHASE_GET_BY_ID);

  useEffect(() => {
    fetchPurchase(purchaseId);
  }, [purchaseId, fetchPurchase]);

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (loading || !purchase) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content"
          onClick={(e) => e.stopPropagation()}
          style={{ width: '600px', padding: '2rem', textAlign: 'center' }}
        >
          {t('procurement.form.loading_details')}
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content purchase-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('procurement.form.title_details', { no: purchase.purchaseNumber })}</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          <div
            className="form-grid header-grid"
            style={{
              marginBottom: '1.5rem',
              background: '#f8f9fa',
              padding: '1rem',
              borderRadius: '8px',
            }}
          >
            <div>
              <div
                className="text-muted"
                style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}
              >
                {t('procurement.purchases.table.supplier')}
              </div>
              <div style={{ fontWeight: 600 }}>{purchase.supplierName}</div>
              {purchase.supplierGstin && (
                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                  GSTIN: {purchase.supplierGstin}
                </div>
              )}
            </div>
            <div>
              <div
                className="text-muted"
                style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}
              >
                {t('procurement.purchases.table.date')}
              </div>
              <div style={{ fontWeight: 600 }}>
                {new Date(purchase.invoiceDate).toLocaleDateString('en-IN')}
              </div>
            </div>
            <div>
              <div
                className="text-muted"
                style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}
              >
                {t('procurement.details.inv_no_label')}
              </div>
              <div style={{ fontWeight: 600 }}>{purchase.invoiceNumber || '-'}</div>
            </div>
          </div>

          <table className="items-entry-table">
            <thead>
              <tr>
                <th>{t('procurement.details.product')}</th>
                <th>{t('procurement.form.hsn_label')}</th>
                <th className="text-right">{t('procurement.details.qty')}</th>
                <th className="text-right">{t('procurement.details.rate')}</th>
                <th className="text-right">{t('procurement.form.gst_label')} %</th>
                <th className="text-right">{t('procurement.form.total_label')}</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items?.map(
                (
                  item: {
                    productName: string;
                    quantity: number;
                    unitPrice: number;
                    gstPercent: number;
                    lineTotal: number;
                    hsnCode?: string;
                  },
                  idx: number
                ) => (
                  <tr key={idx}>
                    <td>{item.productName}</td>
                    <td>{item.hsnCode || '-'}</td>
                    <td className="text-right">{item.quantity}</td>
                    <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="text-right">{item.gstPercent}%</td>
                    <td className="text-right">{formatCurrency(item.lineTotal)}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>

          <div className="purchase-footer" style={{ marginTop: '2rem' }}>
            <div className="notes-area">
              {purchase.notes && (
                <>
                  <label
                    className="text-muted"
                    style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}
                  >
                    {t('procurement.form.notes')}
                  </label>
                  <div
                    style={{
                      padding: '0.8rem',
                      background: '#f8f9fa',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                    }}
                  >
                    {purchase.notes}
                  </div>
                </>
              )}
            </div>
            <div
              className="totals-area"
              style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px' }}
            >
              <div className="total-row">
                <span>{t('procurement.form.taxable_amt')}</span>
                <span>{formatCurrency(purchase.totalTaxable)}</span>
              </div>
              <div className="total-row">
                <span>CGST:</span>
                <span>{formatCurrency(purchase.cgstAmount)}</span>
              </div>
              <div className="total-row">
                <span>SGST:</span>
                <span>{formatCurrency(purchase.sgstAmount)}</span>
              </div>
              <div className="total-row">
                <span>IGST:</span>
                <span>{formatCurrency(purchase.igstAmount)}</span>
              </div>
              <div
                className="total-row grand-total"
                style={{
                  borderTop: '2px solid #dee2e6',
                  marginTop: '0.5rem',
                  paddingTop: '0.5rem',
                }}
              >
                <span>{t('procurement.form.grand_total')}</span>
                <span>{formatCurrency(purchase.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
