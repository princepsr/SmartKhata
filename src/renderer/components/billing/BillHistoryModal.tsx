import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useIPC, useIPCMutation } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { formatCurrency } from '../../utils/formatters';
import { BillDetailModal } from './BillDetailModal';
import { useAppSettingsStore } from '../../store';
import './BillHistoryModal.css';

interface BillSummary {
  id: number;
  billNumber: string;
  customerId: number | null;
  customerName: string | null;
  grandTotal: number; // in paise
  paymentMode: string;
  createdAt: number; // Unix timestamp
}

interface BillHistoryModalProps {
  onClose: () => void;
}

export const BillHistoryModal: React.FC<BillHistoryModalProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { settings } = useAppSettingsStore();
  const printerName = settings.printerName || '';
  // Fetch Today's Bills
  const {
    data: bills,
    loading,
    error,
    execute: refreshBills,
  } = useIPC<BillSummary[]>(IPC_CHANNELS.BILL_TODAY);

  const [selectedBillNumber, setSelectedBillNumber] = React.useState<string | null>(null);

  // Reprint Mutation
  const { execute: reprintBill, loading: reprinting } = useIPCMutation<
    { billId: number; printerName: string },
    boolean
  >(IPC_CHANNELS.BILL_PRINT);

  const [notification, setNotification] = React.useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Initial Load
  useEffect(() => {
    refreshBills();
  }, [refreshBills]);

  // Keyboard Support (Esc to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation(); // Prevent bubbling to BillingPage
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleReprint = async (billId: number) => {
    try {
      const success = await reprintBill({ billId, printerName });
      if (success) {
        showNotification(t('billing.reprint_sent'), 'success');
      } else {
        showNotification(t('billing.reprint_failed'), 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('billing.reprint_failed');
      showNotification(msg, 'error');
      console.error(err);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content bill-history-modal">
        {/* Header */}
        <div className="modal-header">
          <h2>{t('billing.today_sales')}</h2>
          {notification && (
            <div
              className="success-notification"
              style={{
                backgroundColor:
                  notification.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
              }}
            >
              {notification.message}
            </div>
          )}
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          <div className="bill-history-scroll-area">
            {loading && <div className="loading">{t('billing.loading_history')}</div>}

            {error && (
              <div className="error-banner">
                {t('common.error')}: {error}
              </div>
            )}

            {!loading && !error && (!bills || bills.length === 0) && (
              <div className="no-results">{t('billing.no_sales_today')}</div>
            )}

            {!loading && bills && bills.length > 0 && (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>{t('inventory.history.table.date')}</th>
                    <th>{t('billing.bill_no')}</th>
                    <th>{t('common.customers')}</th>
                    <th>{t('common.status')}</th>
                    <th className="text-right">{t('common.amount')}</th>
                    <th className="text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => (
                    <tr key={bill.id}>
                      <td>
                        {(() => {
                          const date = new Date(bill.createdAt);
                          return isNaN(date.getTime())
                            ? 'Invalid Time'
                            : date.toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true,
                                timeZone: 'Asia/Kolkata',
                              });
                        })()}
                      </td>
                      <td>
                        <button
                          className="bill-link-btn"
                          onClick={() => setSelectedBillNumber(bill.billNumber)}
                          title={t('billing.bill_details')}
                        >
                          {bill.billNumber}
                        </button>
                      </td>
                      <td>
                        <span className="customer-name">
                          {bill.customerName || (
                            <span className="text-muted">{t('billing.walk_in')}</span>
                          )}
                        </span>
                      </td>
                      <td>
                        <span className={`mode-badge ${bill.paymentMode}`}>{bill.paymentMode}</span>
                      </td>
                      <td className="text-right font-bold">{formatCurrency(bill.grandTotal)}</td>
                      <td className="text-right">
                        <button
                          className="btn-sm btn-secondary"
                          onClick={() => handleReprint(bill.id)}
                          disabled={reprinting}
                        >
                          {reprinting ? '...' : t('billing.reprint')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">
            {t('common.close')} (Esc)
          </button>
        </div>

        <BillDetailModal
          isOpen={!!selectedBillNumber}
          onClose={() => setSelectedBillNumber(null)}
          billNumber={selectedBillNumber}
        />
      </div>
    </div>
  );
};
