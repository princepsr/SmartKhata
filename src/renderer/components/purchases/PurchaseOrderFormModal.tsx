import React, { useState, useEffect } from 'react';
import { useIPC, useIPCMutation } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { PurchaseOrder, Product } from '@shared/types/ipc';
import { formatCurrency } from '../../utils/formatters';
import SearchableSelect from '../ui/SearchableSelect';

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
          poDetails.items.map((i: any) => ({
            productId: i.productId,
            productName: i.productName,
            hsnCode: i.hsnCode,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            gstPercent: i.gstPercent,
            lineTotal: i.lineTotal,
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
              ? `Edit Purchase Order - ${formData.poNumber}`
              : 'Create Purchase Order (Draft)'}
          </h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid header-grid">
              <div className="form-group">
                <label>Supplier *</label>
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
                  placeholder="Select a Supplier..."
                />
              </div>
              <div className="form-group">
                <label>
                  PO Number <small>(Auto-generated if empty)</small>
                </label>
                <input
                  type="text"
                  value={formData.poNumber}
                  onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                  placeholder="PO-2026-0001"
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
              <div className="items-table-header grid-items">
                <div>Product Name *</div>
                <div>HSN</div>
                <div className="text-center">Qty</div>
                <div className="text-center">Unit Price</div>
                <div className="text-center">GST %</div>
                <div className="text-right">Total</div>
                <div></div>
              </div>
              <div className="items-table-body">
                {items.map((item, index) => (
                  <div key={index} className="items-table-row grid-items">
                    <div>
                      <input
                        type="text"
                        list="po-products-datalist"
                        value={item.productName}
                        onChange={(e) => updateItem(index, 'productName', e.target.value)}
                        placeholder="Item name"
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={item.hsnCode || ''}
                        onChange={(e) => updateItem(index, 'hsnCode', e.target.value)}
                        placeholder="HSN"
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
                        title="Remove Item"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <datalist id="po-products-datalist">
                {productsData?.items?.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
              <button type="button" className="btn-outline" onClick={addItem}>
                <span>+</span> Add Item
              </button>
            </div>

            <div className="purchase-footer">
              <div className="notes-area">
                <label>Notes (Shipping instructions)</label>
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
