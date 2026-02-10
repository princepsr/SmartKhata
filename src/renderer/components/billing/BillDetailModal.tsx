import React, { useEffect } from 'react';
import { useIPC } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { formatCurrency } from '../../utils/billing-math';
import './BillDetailModal.css';

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
    discountAmount: number;
    grandTotal: number;
    paymentMode: string;
    createdAt: number;
  };
  items: BillItem[];
}

interface BillDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  billNumber: string | null;
}

export const BillDetailModal: React.FC<BillDetailModalProps> = ({
  isOpen,
  onClose,
  billNumber,
}) => {
  const { data, loading, error, execute: fetchBill } = useIPC<BillDetail>(IPC_CHANNELS.BILL_GET);

  useEffect(() => {
    if (isOpen && billNumber) {
      fetchBill(billNumber);
    }
  }, [isOpen, billNumber, fetchBill]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay bill-detail-overlay" onClick={onClose}>
      <div className="modal-content bill-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Bill Details: {billNumber}</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          {loading && <div className="loading">Loading bill details...</div>}
          {error && <div className="error">Error: {error}</div>}

          {data && (
            <div className="bill-info">
              <div className="bill-meta">
                <span>
                  <strong>Date:</strong> {new Date(data.bill.createdAt).toLocaleString('en-IN')}
                </span>
                <span className="payment-badge">{data.bill.paymentMode.toUpperCase()}</span>
              </div>

              <table className="items-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.productNameSnapshot}</td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="text-right">{formatCurrency(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="bill-summary">
                <div className="summary-row">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(data.bill.subtotal)}</span>
                </div>
                <div className="summary-row">
                  <span>GST:</span>
                  <span>{formatCurrency(data.bill.gstTotal)}</span>
                </div>
                {data.bill.discountAmount > 0 && (
                  <div className="summary-row discount">
                    <span>Discount:</span>
                    <span>-{formatCurrency(data.bill.discountAmount)}</span>
                  </div>
                )}
                <div className="summary-row grand-total">
                  <span>Grand Total:</span>
                  <span>{formatCurrency(data.bill.grandTotal)}</span>
                </div>
              </div>
            </div>
          )}
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
