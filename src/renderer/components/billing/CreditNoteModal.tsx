import React, { useState, useEffect } from 'react';
import { useIPCMutation } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { formatCurrency } from '../../utils/formatters';
import { useConfirm } from '../../hooks/useConfirm';
import './CreditNoteModal.css';

interface BillItem {
  id: number;
  productId: number;
  productNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  lineTotal: number;
  returnedQuantity: number;
}

interface BillDetail {
  bill: {
    id: number;
    billNumber: string;
    subtotal: number;
    gstTotal: number;
    grandTotal: number;
  };
  items: BillItem[];
}

interface CreditNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  billDetail: BillDetail;
  onSuccess: () => void;
}

interface ReturnItem {
  billItemId: number;
  productId: number;
  productName: string;
  originalQty: number;
  returnQty: number;
  unitPrice: number;
  gstPercent: number;
  returnedQuantity: number;
}

interface CreateCreditNoteRequest {
  originalBillId: number;
  reason: string;
  notes?: string;
  items: {
    productId: number;
    quantity: number;
    unitPrice: number;
    gstPercent: number;
  }[];
}

export const CreditNoteModal: React.FC<CreditNoteModalProps> = ({
  isOpen,
  onClose,
  billDetail,
  onSuccess,
}) => {
  const [reason, setReason] = useState('Sales Return');
  const [notes, setNotes] = useState('');
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const {
    execute: createCreditNote,
    loading,
    error,
  } = useIPCMutation<CreateCreditNoteRequest, boolean>(IPC_CHANNELS.CREDIT_NOTE_CREATE);
  const { alert } = useConfirm();

  useEffect(() => {
    if (isOpen) {
      setReturnItems(
        billDetail.items.map((item) => ({
          billItemId: item.id,
          productId: item.productId,
          productName: item.productNameSnapshot,
          originalQty: item.quantity,
          returnQty: 0,
          unitPrice: item.unitPrice,
          gstPercent: item.gstPercent,
          returnedQuantity: item.returnedQuantity,
        }))
      );
    }
  }, [isOpen, billDetail]);

  if (!isOpen) {
    return null;
  }

  const handleReturnQtyChange = (billItemId: number, qty: number) => {
    setReturnItems((items) =>
      items.map((item) =>
        item.billItemId === billItemId
          ? { ...item, returnQty: Math.min(qty, item.originalQty - item.returnedQuantity) }
          : item
      )
    );
  };

  const calculateRefund = () => {
    return returnItems.reduce(
      (acc, item) => {
        const lineTotal = item.returnQty * item.unitPrice;
        const rate = item.gstPercent / 100;
        const taxable = lineTotal / (1 + rate);
        const gst = lineTotal - taxable;
        return {
          taxable: acc.taxable + taxable,
          gst: acc.gst + gst,
          total: acc.total + lineTotal,
        };
      },
      { taxable: 0, gst: 0, total: 0 }
    );
  };

  const handleSubmit = async () => {
    const itemsToReturn = returnItems.filter((i) => i.returnQty > 0);
    if (itemsToReturn.length === 0) {
      await alert({
        title: 'Selection Required',
        message: 'Please select at least one item to return.',
        type: 'warning',
      });
      return;
    }

    try {
      const response = await createCreditNote({
        originalBillId: billDetail.bill.id,
        reason: reason as any,
        notes,
        items: itemsToReturn.map((i) => ({
          productId: i.productId,
          quantity: i.returnQty,
          unitPrice: i.unitPrice,
          gstPercent: i.gstPercent,
        })),
      });

      if (response) {
        onSuccess();
      }
    } catch (err) {
      console.error('Failed to create credit note:', err);
    }
  };

  const refundSummary = calculateRefund();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content credit-note-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Issue Credit Note (Returns)</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div className="credit-note-scroll-area">
            <div className="bill-meta">
              <span>Ref Bill: <strong>{billDetail.bill.billNumber}</strong></span>
              <span>Date: <strong>{new Date().toLocaleDateString('en-IN')}</strong></span>
            </div>

            <table className="items-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-right">Sold Qty</th>
                  <th className="text-right">Returned</th>
                  <th className="text-center">Return Qty</th>
                  <th className="text-right">Refund Amount</th>
                </tr>
              </thead>
              <tbody>
                {returnItems.map((item) => (
                  <tr key={item.billItemId}>
                    <td>{item.productName}</td>
                    <td className="text-right">{item.originalQty}</td>
                    <td className="text-right text-danger">
                      {item.returnedQuantity > 0 ? item.returnedQuantity : '-'}
                    </td>
                    <td className="text-center">
                      <input
                        type="number"
                        min="0"
                        max={item.originalQty - item.returnedQuantity}
                        value={item.returnQty}
                        disabled={item.originalQty - item.returnedQuantity <= 0}
                        onChange={(e) =>
                          handleReturnQtyChange(item.billItemId, Number(e.target.value))
                        }
                        className="qty-input"
                      />
                    </td>
                    <td className="text-right">
                      {formatCurrency(item.returnQty * item.unitPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="cn-form">
              <div className="cn-group">
                <label>Reason for Return</label>
                <select value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="OTHER">Sales Return</option>
                  <option value="DEFECTIVE">Damaged Goods</option>
                  <option value="WRONG_ITEM">Wrong Item</option>
                  <option value="EXCESS">Excess/Other</option>
                </select>
              </div>
              <div className="cn-group">
                <label>Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional remarks..."
                />
              </div>
            </div>

            <div className="refund-summary-box">
              <div className="summary-card">
                <div className="summary-item">
                  <span>Taxable Refund:</span>
                  <span>{formatCurrency(refundSummary.taxable)}</span>
                </div>
                <div className="summary-item">
                  <span>GST to Reverse:</span>
                  <span>{formatCurrency(refundSummary.gst)}</span>
                </div>
                <div className="summary-item total">
                  <span>Total Refund:</span>
                  <span>{formatCurrency(refundSummary.total)}</span>
                </div>
              </div>
            </div>
            {error && <div className="error-message">{error}</div>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-danger-primary"
            onClick={handleSubmit}
            disabled={loading || refundSummary.total <= 0}
          >
            {loading ? 'Processing...' : 'Confirm Return & Issue Credit Note'}
          </button>
        </div>
      </div>
    </div>
  );
};
