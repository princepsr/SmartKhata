import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useIPC } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { BillDetailModal } from '../billing/BillDetailModal';
import './ProductHistoryModal.css';

interface ProductHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: { id: number; name: string } | null;
}

interface HistoryLog {
  id: number;
  date: string;
  changeQty: number;
  reason: string;
  reference: string;
  notes: string;
}

export const ProductHistoryModal: React.FC<ProductHistoryModalProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  const { t } = useTranslation();
  const {
    data: history,
    loading,
    error,
    execute: fetchHistory,
  } = useIPC<HistoryLog[]>(IPC_CHANNELS.PRODUCT_HISTORY);

  const [selectedBillNumber, setSelectedBillNumber] = React.useState<string | null>(null);

  useEffect(() => {
    if (isOpen && product) {
      fetchHistory(product.id);
    }
  }, [isOpen, product, fetchHistory]);

  if (!isOpen || !product) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {t('inventory.history.title')}: {product.name}
          </h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          {loading && <div className="loading">{t('common.loading')}</div>}
          {error && (
            <div className="error">
              {t('common.error')}: {error}
            </div>
          )}

          {!loading && !error && history && history.length === 0 && (
            <div className="no-data">{t('inventory.history.no_history')}</div>
          )}

          {!loading && !error && history && history.length > 0 && (
            <div className="history-scroll-area">
              <div className="history-table-container">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>{t('inventory.history.table.date')}</th>
                      <th>{t('inventory.history.table.delta')}</th>
                      <th>{t('inventory.history.table.reason')}</th>
                      <th>{t('inventory.history.table.reference')}</th>
                      <th>{t('inventory.history.table.notes')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((log) => (
                      <tr key={log.id}>
                        <td className="col-date">
                          {new Date(log.date).toLocaleString(t('common.locale') || 'en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className={`col-qty ${log.changeQty >= 0 ? 'positive' : 'negative'}`}>
                          {log.changeQty > 0 ? '+' : ''}
                          {log.changeQty}
                        </td>
                        <td className="col-reason">{log.reason}</td>
                        <td className="col-ref">
                          {log.reason === 'SALE' ? (
                            <button
                              className="bill-link-btn"
                              onClick={() => setSelectedBillNumber(log.reference)}
                              title={t('billing.view_bill_details')}
                            >
                              {log.reference}
                            </button>
                          ) : (
                            log.reference
                          )}
                        </td>
                        <td className="col-notes">{log.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            {t('common.close')}
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
