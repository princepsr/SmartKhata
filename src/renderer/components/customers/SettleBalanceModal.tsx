import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useIPCMutation } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { formatCurrency } from '../../utils/formatters';

interface Customer {
  id: number;
  name: string;
  balanceDue: number;
}

interface SettleBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customer: Customer | null;
}

export const SettleBalanceModal: React.FC<SettleBalanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  customer,
}) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [transactionType, setTransactionType] = useState<'GOT' | 'GAVE'>('GOT');
  const [error, setError] = useState('');

  const { execute: addPayment, loading } = useIPCMutation<
    { id: number; amount: number; notes?: string },
    void
  >(IPC_CHANNELS.CUSTOMER_ADD_PAYMENT);

  // Set default transaction type based on balance
  useEffect(() => {
    if (isOpen && customer) {
      if (customer.balanceDue > 0) {
        setTransactionType('GOT');
        setAmount(customer.balanceDue.toString());
      } else if (customer.balanceDue < 0) {
        setTransactionType('GAVE');
        setAmount(Math.abs(customer.balanceDue).toString());
      } else {
        setTransactionType('GOT');
        setAmount('');
      }
      setNotes('');
      setError('');
    }
  }, [isOpen, customer]);

  if (!isOpen || !customer) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError(t('customers.settle.errors.invalid_amount'));
      return;
    }

    try {
      const parsedAmount = Number(amount);
      const submitAmount = transactionType === 'GOT' ? parsedAmount : -parsedAmount;

      await addPayment({
        id: customer.id,
        amount: submitAmount,
        notes:
          notes ||
          (transactionType === 'GOT'
            ? t('customers.settle.pay_received')
            : t('customers.settle.pay_given')),
      });

      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || t('customers.settle.errors.fail'));
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '400px', maxWidth: '90vw' }}>
        <div className="modal-header">
          <h2>{t('customers.settle.title')}</h2>
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
            {t('inventory.category_customer')}
          </div>
          <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{customer.name}</div>
          <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.9rem', color: '#64748b' }}>
              {t('customers.ledger.net_balance')}:
            </span>
            <span
              style={{
                fontWeight: 'bold',
                color:
                  customer.balanceDue > 0
                    ? '#ef4444'
                    : customer.balanceDue < 0
                      ? '#10b981'
                      : '#333',
              }}
            >
              {formatCurrency(customer.balanceDue)}{' '}
              {customer.balanceDue > 0
                ? t('customers.due')
                : customer.balanceDue < 0
                  ? t('customers.adv')
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
              {t('customers.settle.got')}
            </button>
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
              {t('customers.settle.gave')}
            </button>
          </div>

          <div className="form-group" style={{ margin: '0 1.5rem 1rem' }}>
            <label>{t('customers.settle.amount')}</label>
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
            <label>{t('customers.settle.notes')}</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                transactionType === 'GOT'
                  ? t('customers.settle.notes_placeholder_got')
                  : t('customers.settle.notes_placeholder_gave')
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
                background: transactionType === 'GOT' ? '#10b981' : '#ef4444',
                borderColor: transactionType === 'GOT' ? '#10b981' : '#ef4444',
              }}
            >
              {loading ? t('customers.form.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
