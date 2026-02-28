import React, { useState, useEffect } from 'react';
import { useIPC, useIPCMutation } from '../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { Purchase } from '@shared/types/ipc';
import { formatCurrency } from '../utils/formatters';
import { useAppSettingsStore } from '../store';
import EmptyState from '../components/common/EmptyState';
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
}

const PurchasesPage: React.FC = () => {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [viewingPurchaseId, setViewingPurchaseId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const {
    data: purchases,
    loading,
    execute: fetchPurchases,
  } = useIPC<{ data: Purchase[]; total: number }>(IPC_CHANNELS.PURCHASE_LIST);

  const { settings } = useAppSettingsStore();

  useEffect(() => {
    if (settings.gstEnabled) {
      fetchPurchases(dateRange);
    }
  }, [dateRange, fetchPurchases, settings.gstEnabled]);

  if (!settings.gstEnabled) {
    return (
      <div className="page purchases-page">
        <EmptyState
          title="GST Feature Disabled"
          message="Purchases and ITC tracking require GST to be enabled. You can enable it in the Settings page."
          icon="📦"
        />
      </div>
    );
  }

  return (
    <div className="page purchases-page">
      <div className="page-content-wrapper animate-fade-in">
        <header className="page-header">
          <h1 className="page-title">Purchases & ITC</h1>
          <div className="header-actions">
            <div className="filters">
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              />
              <span>to</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              />
            </div>
            <button className="btn-primary" onClick={() => setIsAddingNew(true)}>
              + Record Purchase
            </button>
          </div>
        </header>

        <div className="purchases-content">
          {loading ? (
            <div className="loading-state">Loading purchases...</div>
          ) : !purchases || purchases.data.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <h3>No purchases found</h3>
              <p>Start recording your supplier invoices to track Input Tax Credit (ITC).</p>
              <button className="btn-secondary" onClick={() => setIsAddingNew(true)}>
                Record Your First Purchase
              </button>
            </div>
          ) : (
            <div className="data-table-container">
              <div className="data-table-header">
                <div className="col-date">Date</div>
                <div className="col-purchase-no">Purchase #</div>
                <div className="col-supplier">Supplier</div>
                <div className="col-inv">Inv #</div>
                <div className="col-total text-right">GST Total</div>
                <div className="col-grand-total text-right">Grand Total</div>
                <div className="col-actions text-center">Actions</div>
              </div>

              {purchases.data.map((p) => (
                <div className="data-table-row" key={p.id}>
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
                  <div className="col-total text-right text-muted">
                    {formatCurrency(p.gstTotal)}
                  </div>
                  <div className="col-grand-total text-right font-bold">
                    {formatCurrency(p.grandTotal)}
                  </div>
                  <div className="col-actions" style={{ justifyContent: 'center' }}>
                    <button
                      className="action-icon-btn"
                      title="View Details"
                      onClick={() => setViewingPurchaseId(p.id)}
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
          )}
        </div>
      </div>

      {isAddingNew && (
        <PurchaseFormModal
          onClose={() => setIsAddingNew(false)}
          onSuccess={() => {
            setIsAddingNew(false);
            fetchPurchases(dateRange);
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
}

const PurchaseFormModal: React.FC<PurchaseFormModalProps> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    supplierName: '',
    supplierGstin: '',
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [items, setItems] = useState<PurchaseItem[]>([
    { productName: '', quantity: 1, unitPrice: 0, gstPercent: 0, lineTotal: 0 },
  ]);

  const {
    execute: recordPurchase,
    loading,
    error,
  } = useIPCMutation<any, Purchase>(IPC_CHANNELS.PURCHASE_RECORD);

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
    const item = { ...newItems[index], [field]: value };

    // Recalculate line total
    if (field === 'quantity' || field === 'unitPrice' || field === 'gstPercent') {
      const q = Number(item.quantity) || 0;
      const p = Number(item.unitPrice) || 0;
      const g = Number(item.gstPercent) || 0;
      const taxable = q * p;
      const gstAmount = (taxable * g) / 100;
      item.lineTotal = Math.round((taxable + gstAmount) * 100) / 100;
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
    if (!formData.supplierName) {
      alert('Supplier name is required');
      return;
    }
    if (items.some((i) => !i.productName)) {
      alert('Product name is required for all items');
      return;
    }

    try {
      const response = await recordPurchase({
        ...formData,
        items: items.map((i) => ({
          productName: i.productName,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          gstPercent: Number(i.gstPercent),
          hsnCode: i.hsnCode,
        })),
      });

      if (response) {
        onSuccess();
      }
    } catch (err) {
      console.error('Record purchase failed:', err);
      alert('An unexpected error occurred');
    }
  };

  const totals = calculateTotals();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content purchase-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Record New Purchase</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label>Supplier Name *</label>
                <input
                  type="text"
                  value={formData.supplierName}
                  onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                  placeholder="e.g. ABC Distributors"
                  required
                />
              </div>
              <div className="form-group">
                <label>Supplier GSTIN</label>
                <input
                  type="text"
                  value={formData.supplierGstin}
                  onChange={(e) => setFormData({ ...formData, supplierGstin: e.target.value })}
                  placeholder="e.g. 27ABCDE1234F1Z5"
                />
              </div>
              <div className="form-group">
                <label>Invoice Number</label>
                <input
                  type="text"
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                  placeholder="e.g. INV-001"
                />
              </div>
              <div className="form-group">
                <label>Invoice Date *</label>
                <input
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="items-section">
              <h3>Items</h3>
              <table className="items-entry-table">
                <thead>
                  <tr>
                    <th>Product Name *</th>
                    <th>HSN</th>
                    <th style={{ width: '80px' }}>Qty</th>
                    <th style={{ width: '120px' }}>Unit Price</th>
                    <th style={{ width: '100px' }}>GST %</th>
                    <th style={{ width: '120px' }} className="text-right">
                      Total
                    </th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          type="text"
                          value={item.productName}
                          onChange={(e) => updateItem(index, 'productName', e.target.value)}
                          placeholder="Item name"
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
                          value={item.unitPrice}
                          onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                          min="0"
                          step="0.01"
                          required
                        />
                      </td>
                      <td>
                        <select
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
                      <td className="text-right">{formatCurrency(item.lineTotal)}</td>
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
              <button type="button" className="btn-outline" onClick={addItem}>
                + Add Item
              </button>
            </div>

            <div className="purchase-footer">
              <div className="notes-area">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional details..."
                />
              </div>
              <div className="totals-area">
                <div className="total-row">
                  <span>Taxable Amount:</span>
                  <span>{formatCurrency(totals.taxable)}</span>
                </div>
                <div className="total-row">
                  <span>GST Amount:</span>
                  <span>{formatCurrency(totals.gst)}</span>
                </div>
                <div className="total-row grand-total">
                  <span>Grand Total:</span>
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
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Recording...' : 'Save Purchase'}
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

const PurchaseDetailsModal: React.FC<PurchaseDetailsModalProps> = ({ purchaseId, onClose }) => {
  const {
    data: purchase,
    loading,
    execute: fetchPurchase,
  } = useIPC<any>(IPC_CHANNELS.PURCHASE_GET_BY_ID);

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
          Loading details...
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content purchase-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Purchase Details - {purchase.purchaseNumber}</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          <div
            className="form-grid"
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
                Supplier
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
                Date
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
                Invoice No
              </div>
              <div style={{ fontWeight: 600 }}>{purchase.invoiceNumber || '-'}</div>
            </div>
          </div>

          <table className="items-entry-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>HSN</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Rate</th>
                <th className="text-right">GST %</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items?.map((item: any, idx: number) => (
                <tr key={idx}>
                  <td>{item.productName}</td>
                  <td>{item.hsnCode || '-'}</td>
                  <td className="text-right">{item.quantity}</td>
                  <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="text-right">{item.gstPercent}%</td>
                  <td className="text-right">{formatCurrency(item.lineTotal)}</td>
                </tr>
              ))}
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
                    Notes
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
                <span>Taxable Amount:</span>
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
                <span>Grand Total:</span>
                <span>{formatCurrency(purchase.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
