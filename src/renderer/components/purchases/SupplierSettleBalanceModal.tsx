import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useIPCMutation } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { formatCurrency } from '../../utils/formatters';
import { Supplier } from '@shared/types/ipc';

interface SupplierSettleBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  supplier: Supplier | null;
}

export const SupplierSettleBalanceModal: React.FC<SupplierSettleBalanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  supplier,
}) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [transactionType, setTransactionType] = useState<'GOT' | 'GAVE'>('GAVE');
  const [error, setError] = useState('');

  const { execute: addPayment, loading } = useIPCMutation<
    { id: number; amount: number; notes?: string },
    void
  >(IPC_CHANNELS.SUPPLIER_ADD_PAYMENT);

  // Set default transaction type based on balance
  // For suppliers: balanceDue > 0 means WE OWE THEM. So we GAVE them money to settle.
  // balanceDue < 0 means THEY OWE US (advance). So we GOT money to settle.
  useEffect(() => {
    if (isOpen && supplier) {
      if (supplier.balanceDue > 0) {
        setTransactionType('GAVE');
        setAmount(supplier.balanceDue.toString());
      } else if (supplier.balanceDue < 0) {
        setTransactionType('GOT');
        setAmount(Math.abs(supplier.balanceDue).toString());
      } else {
        setTransactionType('GAVE');
        setAmount('');
      }
      setNotes('');
      setError('');
    }
  }, [isOpen, supplier]);

  if (!isOpen || !supplier) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError(t('procurement.settle.error_amount'));
      return;
    }

    try {
      const parsedAmount = Number(amount);
      // GOT (Positive PAYMENT_IN), GAVE (Negative PAYMENT_OUT)
      const submitAmount = transactionType === 'GOT' ? parsedAmount : -parsedAmount;

      await addPayment({
        id: supplier.id,
        amount: submitAmount,
        notes:
          notes ||
          (transactionType === 'GOT'
            ? t('procurement.ledger.types.pay_in')
            : t('procurement.ledger.types.pay_out')),
      });

      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || t('procurement.settle.error_fail'));
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '400px', maxWidth: '90vw' }}>
        <div className="modal-header">
          <h2>{t('procurement.settle.title')}</h2>
          <button className="icon-btn" onClick={onClose} title={t('common.close')}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div
          style={{
            padding: '1rem',
            background: '#f8fafc',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            margin: '0 1.5rem',
          }}
        >
          <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
            {t('procurement.purchases.table.supplier')}
          </div>
          <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{supplier.name}</div>
          <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.9rem', color: '#64748b' }}>
              {t('procurement.settle.balance')}
            </span>
            <span
              style={{
                fontWeight: 'bold',
                color:
                  supplier.balanceDue > 0
                    ? '#ef4444' // We owe them
                    : supplier.balanceDue < 0
                      ? '#10b981' // They owe us
                      : '#333',
              }}
            >
              {formatCurrency(Math.abs(supplier.balanceDue))}{' '}
              {supplier.balanceDue > 0
                ? t('procurement.settle.payable')
                : supplier.balanceDue < 0
                  ? t('procurement.settle.adv')
                  : ''}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && (
            <div
              className="error-message"
              style={{
                margin: '0 1.5rem 1rem',
                padding: '0.75rem',
                background: '#fef2f2',
                color: '#ef4444',
                borderRadius: '0.25rem',
                fontSize: '0.9rem',
              }}
            >
              {error}
            </div>
          )}

          <div
            className="form-group"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem',
              margin: '0 1.5rem 1rem',
            }}
          >
            <button
              type="button"
              onClick={() => setTransactionType('GAVE')}
              style={{
                padding: '0.75rem',
                border: `2px solid ${transactionType === 'GAVE' ? '#ef4444' : '#e2e8f0'}`,
                background: transactionType === 'GAVE' ? '#fef2f2' : 'white',
                color: transactionType === 'GAVE' ? '#b91c1c' : '#64748b',
                borderRadius: '0.5rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {t('procurement.settle.you_gave')}
            </button>
            <button
              type="button"
              onClick={() => setTransactionType('GOT')}
              style={{
                padding: '0.75rem',
                border: `2px solid ${transactionType === 'GOT' ? '#10b981' : '#e2e8f0'}`,
                background: transactionType === 'GOT' ? '#ecfdf5' : 'white',
                color: transactionType === 'GOT' ? '#047857' : '#64748b',
                borderRadius: '0.5rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {t('procurement.settle.you_got')}
            </button>
          </div>

          <div className="form-group" style={{ margin: '0 1.5rem 1rem' }}>
            <label>{t('procurement.settle.amount')}</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              min="0.1"
              step="any"
              autoFocus
            />
          </div>

          <div className="form-group" style={{ margin: '0 1.5rem 1rem' }}>
            <label>{t('procurement.settle.notes')}</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                transactionType === 'GOT'
                  ? t('procurement.settle.notes_got')
                  : t('procurement.settle.notes_gave')
              }
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{
                background: transactionType === 'GAVE' ? '#ef4444' : '#10b981',
                borderColor: transactionType === 'GAVE' ? '#ef4444' : '#10b981',
              }}
            >
              {loading ? t('procurement.settle.saving') : t('procurement.settle.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
