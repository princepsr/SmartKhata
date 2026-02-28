import React, { useState, useEffect } from 'react';
import { useIPC, useIPCMutation } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { PurchaseOrder } from '@shared/types/ipc';
import { formatCurrency } from '../../utils/formatters';

interface PurchaseItem {
  productId?: number;
  productName: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  lineTotal: number;
}

interface PurchaseOrderFormModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

// Supplier type for dropdown
interface SupplierInfo {
  id: number;
  name: string;
}

const PurchaseOrderFormModal: React.FC<PurchaseOrderFormModalProps> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    supplierId: 0,
    supplierNameSnapshot: '',
    poNumber: '',
    poDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [items, setItems] = useState<PurchaseItem[]>([
    { productName: '', quantity: 1, unitPrice: 0, gstPercent: 0, lineTotal: 0 },
  ]);

  // Fetch active suppliers for the dropdown
  const { data: suppliersData, execute: fetchSuppliers } = useIPC<{ items: SupplierInfo[] }>(
    IPC_CHANNELS.SUPPLIER_LIST
  );
  const suppliers = suppliersData?.items || [];

  useEffect(() => {
    fetchSuppliers({ includeInactive: false });
  }, [fetchSuppliers]);

  const {
    execute: recordPO,
    loading,
    error,
  } = useIPCMutation<Partial<PurchaseOrder>, PurchaseOrder>(IPC_CHANNELS.PO_CREATE);

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
    if (!formData.supplierId) {
      alert('Please select a Supplier');
      return;
    }
    if (items.some((i) => !i.productName)) {
      alert('Product name is required for all items');
      return;
    }

    const totals = calculateTotals();

    try {
      const response = await recordPO({
        ...formData,
        totalTaxable: totals.taxable,
        gstTotal: totals.gst,
        grandTotal: totals.total,
        status: 'PENDING',
        items: items.map((i) => ({
          productName: i.productName,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          gstPercent: Number(i.gstPercent),
          hsnCode: i.hsnCode,
          lineTotal: i.lineTotal,
        })),
      });

      if (response) {
        onSuccess();
      }
    } catch (err) {
      console.error('Record PO failed:', err);
      alert('An unexpected error occurred');
    }
  };

  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = Number(e.target.value);
    const sName = suppliers.find((s) => s.id === sId)?.name || '';
    setFormData({ ...formData, supplierId: sId, supplierNameSnapshot: sName });
  };

  const totals = calculateTotals();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content purchase-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Purchase Order (Draft)</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label>Supplier *</label>
                <select
                  value={formData.supplierId}
                  onChange={handleSupplierChange}
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                  }}
                >
                  <option value={0} disabled>
                    Select a Supplier...
                  </option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>PO Number (Auto if blank)</label>
                <input
                  type="text"
                  value={formData.poNumber}
                  onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                  placeholder="e.g. PO-2026-0001"
                />
              </div>
              <div className="form-group">
                <label>PO Date *</label>
                <input
                  type="date"
                  value={formData.poDate}
                  onChange={(e) => setFormData({ ...formData, poDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="items-section">
              <h3>Requested Items</h3>
              <table className="items-entry-table">
                <thead>
                  <tr>
                    <th>Product Name *</th>
                    <th>HSN</th>
                    <th style={{ width: '80px' }}>Qty</th>
                    <th style={{ width: '120px' }}>Est. Unit Price</th>
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
                <label>Notes (e.g., Shipping instructions)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional details..."
                />
              </div>
              <div className="totals-area">
                <div className="total-row">
                  <span>Est. Taxable Amount:</span>
                  <span>{formatCurrency(totals.taxable)}</span>
                </div>
                <div className="total-row">
                  <span>Est. GST Amount:</span>
                  <span>{formatCurrency(totals.gst)}</span>
                </div>
                <div className="total-row grand-total">
                  <span>Est. Grand Total:</span>
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
              {loading ? 'Saving...' : 'Draft Purchase Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PurchaseOrderFormModal;
