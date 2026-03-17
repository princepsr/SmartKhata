import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useIPC } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { formatCurrency } from '../../utils/formatters';
import { useAppSettingsStore } from '../../store';
import { CreditNoteModal } from './CreditNoteModal';
import './BillDetailModal.css';

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
    discountAmount: number;
    grandTotal: number;
    customerId: number | null;
    customerName: string | null;
    paymentMode: string;
    createdAt: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    isPrinted?: boolean;
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
  const { t } = useTranslation();
  const [isCreditNoteModalOpen, setIsCreditNoteModalOpen] = React.useState(false);
  const { settings } = useAppSettingsStore();
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
          <h2>
            {t('billing.bill_details')}: {billNumber}
          </h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          <div className="bill-detail-scroll-area">
            {loading && <div className="loading">{t('billing.loading_details')}</div>}
            {error && (
              <div className="error">
                {t('common.error')}: {error}
              </div>
            )}

            {data && (
              <div className="bill-info">
                <div className="bill-meta">
                  <strong>{t('inventory.history.table.date')}:</strong>{' '}
                  {new Date(data.bill.createdAt).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'Asia/Kolkata',
                  })}
                  <span className={`mode-badge ${data.bill.paymentMode.toLowerCase()}`}>
                    {data.bill.paymentMode.toUpperCase()}
                  </span>
                  {data.bill.isPrinted && (
                    <span className="lock-badge-ui">🔒 {t('billing.locked')}</span>
                  )}
                </div>

                <div
                  className="bill-meta"
                  style={{ marginTop: '8px', borderTop: '1px dashed #eee', paddingTop: '8px' }}
                >
                  <strong>{t('common.customers')}:</strong>{' '}
                  {data.bill.customerName ? (
                    <span className="customer-name-tag">{data.bill.customerName}</span>
                  ) : (
                    <span className="text-muted">{t('billing.walk_in_customer')}</span>
                  )}
                </div>

                <table className="items-table">
                  <thead>
                    <tr>
                      <th>{t('common.items')}</th>
                      <th className="text-right">{t('procurement.details.qty')}</th>
                      <th className="text-right">{t('common.price')}</th>
                      <th className="text-right">{t('common.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.productNameSnapshot}
                          {item.returnedQuantity > 0 && (
                            <span className="returned-badge">
                              ({t('common.returned')}: {item.returnedQuantity})
                            </span>
                          )}
                        </td>
                        <td className="text-right">{item.quantity}</td>
                        <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="text-right">{formatCurrency(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="bill-summary">
                  <div className="summary-row">
                    <span>{t('common.subtotal')}:</span>
                    <span>{formatCurrency(data.bill.subtotal)}</span>
                  </div>

                  {settings.gstEnabled && (
                    <>
                      {data.bill.igstAmount !== undefined && data.bill.igstAmount > 0 ? (
                        <div className="summary-row">
                          <span>IGST:</span>
                          <span>{formatCurrency(data.bill.igstAmount)}</span>
                        </div>
                      ) : (
                        <>
                          {data.bill.cgstAmount !== undefined && data.bill.cgstAmount > 0 && (
                            <div className="summary-row">
                              <span>CGST:</span>
                              <span>{formatCurrency(data.bill.cgstAmount)}</span>
                            </div>
                          )}
                          {data.bill.sgstAmount !== undefined && data.bill.sgstAmount > 0 && (
                            <div className="summary-row">
                              <span>SGST:</span>
                              <span>{formatCurrency(data.bill.sgstAmount)}</span>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {!data.bill.cgstAmount && !data.bill.igstAmount && data.bill.gstTotal > 0 && (
                    <div className="summary-row">
                      <span>GST:</span>
                      <span>{formatCurrency(data.bill.gstTotal)}</span>
                    </div>
                  )}

                  {data.bill.discountAmount > 0 && (
                    <div className="summary-row discount">
                      <span>{t('common.discount')}:</span>
                      <span>-{formatCurrency(data.bill.discountAmount)}</span>
                    </div>
                  )}
                  <div className="summary-row grand-total">
                    <span>{t('procurement.form.grand_total')}</span>
                    <span>{formatCurrency(data.bill.grandTotal)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          {settings.gstEnabled && (
            <button
              className="btn-outline-danger"
              onClick={() => setIsCreditNoteModalOpen(true)}
              disabled={!data || data.items.every((i) => i.returnedQuantity >= i.quantity)}
            >
              {t('billing.issue_credit_note')}
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>

      {isCreditNoteModalOpen && data && (
        <CreditNoteModal
          isOpen={isCreditNoteModalOpen}
          onClose={() => setIsCreditNoteModalOpen(false)}
          billDetail={data}
          onSuccess={() => {
            setIsCreditNoteModalOpen(false);
            onClose();
          }}
        />
      )}
    </div>
  );
};
