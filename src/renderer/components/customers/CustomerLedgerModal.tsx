import React, { useEffect } from 'react';
import { useIPC } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { formatCurrency } from '../../utils/formatters';
import { BillDetailModal } from '../billing/BillDetailModal';
import './CustomerLedgerModal.css';

interface Customer {
  id: number;
  name: string;
  phone: string;
}

interface CustomerLedgerEntry {
  id: number;
  customerId: number;
  amount: number;
  type: 'SALE' | 'PAYMENT_IN' | 'PAYMENT_OUT' | 'OPENING_BALANCE';
  referenceId?: number;
  referenceNumber?: string;
  notes?: string;
  createdAt: Date | string | number;
}

interface CustomerHistoryData {
  customer: {
    id: number;
    name: string;
    balanceDue: number;
  };
  ledger: CustomerLedgerEntry[];
}

interface CustomerLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
}

export const CustomerLedgerModal: React.FC<CustomerLedgerModalProps> = ({
  isOpen,
  onClose,
  customer,
}) => {
  const [selectedBillId, setSelectedBillId] = React.useState<string | null>(null);

  const {
    execute: fetchHistory,
    data: history,
    loading,
    error,
  } = useIPC<CustomerHistoryData>(IPC_CHANNELS.CUSTOMER_HISTORY);

  const loadHistory = React.useCallback(async () => {
    if (!customer) {
      return;
    }
    await fetchHistory(customer.id);
  }, [customer, fetchHistory]);

  useEffect(() => {
    if (isOpen && customer) {
      loadHistory();
    }
  }, [isOpen, customer, loadHistory]);

  if (!isOpen || !customer) {
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
          <h2>Ledger: {customer.name}</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          {/* Header Summary */}
          {history && (
            <div className="ledger-header-summary">
              <div>
                <div className="net-balance-label">Net Balance</div>
                <div
                  className={`net-balance-value ${
                    history.customer.balanceDue > 0
                      ? 'due'
                      : history.customer.balanceDue < 0
                        ? 'advance'
                        : 'settled'
                  }`}
                >
                  {formatCurrency(Math.abs(history.customer.balanceDue))}
                  <span className="net-balance-text">
                    {history.customer.balanceDue > 0
                      ? 'Due To You'
                      : history.customer.balanceDue < 0
                        ? 'Advance'
                        : 'Settled'}
                  </span>
                </div>
              </div>
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
                Refresh
              </button>
            </div>
          )}

          {loading && !history ? (
            <div className="loading">Loading ledger...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : history && history.ledger.length > 0 ? (
            <div className="ledger-scroll-area">
              <div className="ledger-table-container">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Reference</th>
                      <th style={{ textAlign: 'right' }}>You Gave</th>
                      <th style={{ textAlign: 'right' }}>You Got</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.ledger.map((entry) => {
                      const isGave = entry.type === 'SALE' || entry.type === 'PAYMENT_OUT';
                      const isGot = entry.type === 'PAYMENT_IN';

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
                              {entry.type === 'SALE' && 'Bill Sale'}
                              {entry.type === 'PAYMENT_IN' && 'Payment (Got)'}
                              {entry.type === 'PAYMENT_OUT' && 'Payment (Gave)'}
                              {entry.type === 'OPENING_BALANCE' && 'Opening Balance'}
                              {!['SALE', 'PAYMENT_IN', 'PAYMENT_OUT', 'OPENING_BALANCE'].includes(
                                entry.type
                              ) && entry.type}
                            </div>
                            {entry.notes && <div className="col-notes">{entry.notes}</div>}
                          </td>
                          <td className="col-ref">
                            {entry.referenceNumber ? (
                              <button
                                className="bill-link-btn"
                                onClick={() => setSelectedBillId(entry.referenceNumber!)}
                                title="View Bill Details"
                              >
                                {entry.referenceNumber}
                              </button>
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
              <p>No transaction history found for this customer.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <BillDetailModal
        isOpen={selectedBillId !== null}
        onClose={() => setSelectedBillId(null)}
        billNumber={selectedBillId}
      />
    </div>
  );
};
