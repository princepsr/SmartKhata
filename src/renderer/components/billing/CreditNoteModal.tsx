import React, { useState, useEffect } from 'react';
import { useIPCMutation } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { formatCurrency } from '../../utils/formatters';
import { useConfirm } from '../../hooks/useConfirm';
import './CreditNoteModal.css';

interface BillItem {
  id: number;
  productNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  lineTotal: number;
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
  productName: string;
  originalQty: number;
  returnQty: number;
  unitPrice: number;
  gstPercent: number;
}

interface CreateCreditNoteRequest {
  billId: number;
  reason: string;
  notes?: string;
  items: {
    billItemId: number;
    quantity: number;
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
          productName: item.productNameSnapshot,
          originalQty: item.quantity,
          returnQty: 0,
          unitPrice: item.unitPrice,
          gstPercent: item.gstPercent,
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
          ? { ...item, returnQty: Math.min(qty, item.originalQty) }
          : item
      )
    );
  };

  const calculateRefund = () => {
    return returnItems.reduce(
      (acc, item) => {
        const taxable = item.returnQty * item.unitPrice;
        const gst = (taxable * item.gstPercent) / 100;
        return {
          taxable: acc.taxable + taxable,
          gst: acc.gst + gst,
          total: acc.total + taxable + gst,
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
        billId: billDetail.bill.id,
        reason,
        notes,
        items: itemsToReturn.map((i) => ({
          billItemId: i.billItemId,
          quantity: i.returnQty,
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
          <div className="bill-ref">
            Ref Bill: <strong>{billDetail.bill.billNumber}</strong>
          </div>

          <div className="return-items-list">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-right">Original Qty</th>
                  <th className="text-center">Return Qty</th>
                  <th className="text-right">Refund Amount</th>
                </tr>
              </thead>
              <tbody>
                {returnItems.map((item) => (
                  <tr key={item.billItemId}>
                    <td>{item.productName}</td>
                    <td className="text-right">{item.originalQty}</td>
                    <td className="text-center">
                      <input
                        type="number"
                        min="0"
                        max={item.originalQty}
                        value={item.returnQty}
                        onChange={(e) =>
                          handleReturnQtyChange(item.billItemId, Number(e.target.value))
                        }
                        className="qty-input"
                      />
                    </td>
                    <td className="text-right">
                      {formatCurrency(
                        item.returnQty * item.unitPrice * (1 + item.gstPercent / 100)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cn-form">
            <div className="form-group">
              <label>Reason for Return</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="Sales Return">Sales Return</option>
                <option value="Damaged Goods">Damaged Goods</option>
                <option value="Wrong Item">Wrong Item</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional remarks..."
              />
            </div>
          </div>

          <div className="refund-summary">
            <div className="summary-row">
              <span>Taxable Refund:</span>
              <span>{formatCurrency(refundSummary.taxable)}</span>
            </div>
            <div className="summary-row">
              <span>GST to Reverse:</span>
              <span>{formatCurrency(refundSummary.gst)}</span>
            </div>
            <div className="summary-row grand-refund">
              <span>Total Refund Amount:</span>
              <span>{formatCurrency(refundSummary.total)}</span>
            </div>
          </div>
          {error && <div className="error-message">{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary btn-danger"
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
