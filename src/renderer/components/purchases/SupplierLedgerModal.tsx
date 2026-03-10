import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIPC } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { formatCurrency } from '../../utils/formatters';
import { Supplier } from '@shared/types/ipc';
import { SupplierSettleBalanceModal } from './SupplierSettleBalanceModal';
import './SupplierLedgerModal.css';


interface SupplierLedgerEntry {
  id: number;
  supplierId: number;
  amount: number;
  type: 'PURCHASE' | 'PAYMENT_OUT' | 'PAYMENT_IN' | 'OPENING_BALANCE';
  referenceId?: number;
  referenceNumber?: string; // invoice_number from purchases
  notes?: string;
  createdAt: Date | string | number;
}

interface SupplierHistoryData {
  supplier: {
    id: number;
    name: string;
    balanceDue: number;
  };
  ledger: SupplierLedgerEntry[];
}

interface SupplierLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
}

export const SupplierLedgerModal: React.FC<SupplierLedgerModalProps> = ({
  isOpen,
  onClose,
  supplier,
}) => {
  const { t } = useTranslation();
  const {
    execute: fetchHistory,
    data: history,
    loading,
    error,
  } = useIPC<SupplierHistoryData>(IPC_CHANNELS.SUPPLIER_HISTORY);

  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);

  const loadHistory = React.useCallback(async () => {
    if (!supplier) {
      return;
    }
    await fetchHistory(supplier.id);
  }, [supplier, fetchHistory]);

  useEffect(() => {
    if (isOpen && supplier) {
      loadHistory();
    }
  }, [isOpen, supplier, loadHistory]);

  if (!isOpen || !supplier) {
    return null;
  }

  const formatDate = (dateValue: string | Date | number) => {
    return new Date(dateValue).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ledger-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('procurement.ledger.title', { name: supplier.name })}</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          {/* Header Summary */}
          {history && (
            <div className="ledger-header-summary">
              <div>
                <div className="net-balance-label">{t('procurement.ledger.net_balance')}</div>
                <div
                  className={`net-balance-value ${
                    history.supplier.balanceDue > 0
                      ? 'due'
                      : history.supplier.balanceDue < 0
                        ? 'advance'
                        : 'settled'
                  }`}
                >
                  {formatCurrency(Math.abs(history.supplier.balanceDue))}
                  <span className="net-balance-text">
                    {history.supplier.balanceDue > 0
                      ? t('procurement.ledger.you_owe')
                      : history.supplier.balanceDue < 0
                        ? t('procurement.ledger.advance_paid')
                        : t('procurement.ledger.settled')}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setIsSettleModalOpen(true)}
                  className="btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 1v22" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  Settle Balance
                </button>
                <button
                  onClick={loadHistory}
                  className="btn-secondary btn-sm"
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  {t('procurement.ledger.refresh')}
                </button>
              </div>
            </div>
          )}

          {loading && !history ? (
            <div className="loading">{t('procurement.ledger.loading')}</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : history && history.ledger.length > 0 ? (
            <div className="ledger-scroll-area">
              <div className="ledger-table-container">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>{t('procurement.ledger.table.date')}</th>
                      <th>{t('procurement.ledger.table.desc')}</th>
                      <th>{t('procurement.ledger.table.ref')}</th>
                      <th style={{ textAlign: 'right' }}>{t('procurement.ledger.table.gave')}</th>
                      <th style={{ textAlign: 'right' }}>{t('procurement.ledger.table.got')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.ledger.map((entry) => {
                      const isGave = entry.type === 'PAYMENT_OUT';
                      const isGot =
                        entry.type === 'PURCHASE' ||
                        entry.type === 'OPENING_BALANCE' ||
                        entry.type === 'PAYMENT_IN';

                      return (
                        <tr key={entry.id}>
                          <td className="col-date">
                            <div>{formatDate(entry.createdAt).split(',')[0]}</div>
                            <div style={{ fontSize: '0.8rem' }}>
                              {formatDate(entry.createdAt).split(',')[1]}
                            </div>
                          </td>
                          <td className="col-desc">
                            <div>
                              {entry.type === 'PURCHASE' && t('procurement.ledger.types.purchase')}
                              {entry.type === 'PAYMENT_OUT' &&
                                t('procurement.ledger.types.pay_out')}
                              {entry.type === 'PAYMENT_IN' && t('procurement.ledger.types.pay_in')}
                              {entry.type === 'OPENING_BALANCE' &&
                                t('procurement.ledger.types.opening')}
                              {![
                                'PURCHASE',
                                'PAYMENT_OUT',
                                'PAYMENT_IN',
                                'OPENING_BALANCE',
                              ].includes(entry.type) && entry.type}
                            </div>
                            {entry.notes && <div className="col-notes">{entry.notes}</div>}
                          </td>
                          <td className="col-ref">
                            {entry.referenceNumber ? (
                              <span className="ref-badge">{entry.referenceNumber}</span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>-</span>
                            )}
                          </td>
                          <td
                            className={`col-amount ${isGave ? 'col-gave' : ''}`}
                            style={{ textAlign: 'right' }}
                          >
                            {isGave ? formatCurrency(entry.amount) : '-'}
                          </td>
                          <td
                            className={`col-amount ${isGot ? 'col-got' : ''}`}
                            style={{ textAlign: 'right' }}
                          >
                            {isGot ? formatCurrency(entry.amount) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="no-data">
              <p>{t('procurement.ledger.no_history')}</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>

      <SupplierSettleBalanceModal
        isOpen={isSettleModalOpen}
        onClose={() => setIsSettleModalOpen(false)}
        onSuccess={() => {
          setIsSettleModalOpen(false);
          loadHistory();
        }}
        supplier={
          history?.supplier
            ? ({
                id: history.supplier.id,
                name: history.supplier.name,
                balanceDue: history.supplier.balanceDue,
                phone: supplier.phone,
                isActive: true, // Placeholder for required field
              } as Supplier)
            : (supplier as Supplier)
        }
      />
    </div>
  );
};
