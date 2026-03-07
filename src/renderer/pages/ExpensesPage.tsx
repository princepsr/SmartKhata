import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useIPC, useIPCMutation } from '../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import EmptyState from '../components/common/EmptyState';
import './ExpensesPage.css';

interface Expense {
  id: number;
  category: string;
  amount: number;
  description: string;
  paymentMode: string;
  date: string;
  createdAt: number;
}

const CATEGORIES = [
  'Rent',
  'Salary',
  'Electricity',
  'Water',
  'Maintenance',
  'Marketing',
  'Supplies',
  'Other',
];

function ExpensesPage() {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    category: 'Other',
    amount: '',
    description: '',
    paymentMode: 'cash',
    date: new Date().toISOString().split('T')[0],
  });
  const [searchParams, setSearchParams] = useSearchParams();

  const { data, loading, execute: fetchExpenses } = useIPC<Expense[]>(IPC_CHANNELS.EXPENSE_LIST);
  const { execute: createExpense, loading: creating } = useIPCMutation(IPC_CHANNELS.EXPENSE_CREATE);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Handle action triggers
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'add') {
      setShowModal(true);
      // Remove action from URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Combine date with current time
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const fullDate = `${formData.date} ${timeStr}`;

    const result = await createExpense({
      ...formData,
      amount: parseFloat(formData.amount),
      date: fullDate,
    });

    if (result) {
      setShowModal(false);
      setFormData({
        category: 'Other',
        amount: '',
        description: '',
        paymentMode: 'cash',
        date: new Date().toISOString().split('T')[0],
      });
      fetchExpenses();
    }
  };

  const filteredExpenses = useMemo(() => {
    if (!data) {
      return [];
    }
    const search = searchTerm.trim().toLowerCase();
    if (!search) {
      return data;
    }
    return data.filter((e) => {
      const category = e.category?.toLowerCase() || '';
      const description = e.description?.toLowerCase() || '';
      return category.includes(search) || description.includes(search);
    });
  }, [data, searchTerm]);

  return (
    <div className="page expenses-page">
      <div className="page-content-wrapper animate-fade-in">
        <header className="page-header">
          <h1 className="page-title">{t('expenses.title')}</h1>

          <div className="header-actions">
            <input
              type="text"
              className="search-input"
              placeholder={t('expenses.search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              {t('expenses.record_expense')}
            </button>
          </div>
        </header>

        <div className="expenses-content">
          <div className="data-table-container">
            <div className="data-table-header">
              <div className="col-date">{t('expenses.table.date')}</div>
              <div className="col-category">{t('expenses.table.category')}</div>
              <div className="col-desc">{t('expenses.table.desc')}</div>
              <div className="col-method">{t('expenses.table.method')}</div>
              <div className="col-amount text-right">{t('expenses.table.amount')}</div>
            </div>

            {loading ? (
              Array(5)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="data-table-row skeleton-row">
                    <div className="skeleton-line"></div>
                  </div>
                ))
            ) : filteredExpenses.length === 0 ? (
              <EmptyState
                title={t('expenses.empty_title')}
                message={
                  searchTerm
                    ? t('expenses.empty_msg_search', { searchTerm })
                    : t('expenses.empty_msg')
                }
                icon="💸"
                action={
                  !searchTerm
                    ? {
                        label: t('expenses.record_first'),
                        onClick: () => setShowModal(true),
                      }
                    : undefined
                }
              />
            ) : (
              filteredExpenses.map((expense) => (
                <div key={expense.id} className="data-table-row hover-row">
                  <div className="col-date">{formatDateTime(expense.date)}</div>
                  <div className="col-category">
                    <span className={`category-badge ${expense.category.toLowerCase()}`}>
                      {t(`expenses.categories.${expense.category.toLowerCase()}`, expense.category)}
                    </span>
                  </div>
                  <div className="col-desc truncate">{expense.description || '-'}</div>
                  <div className="col-method text-capitalize">
                    {t(`expenses.payment_modes.${expense.paymentMode}`, expense.paymentMode)}
                  </div>
                  <div className="col-amount text-right expense-amount">
                    -{formatCurrency(expense.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-zoom-in">
            <div className="modal-header">
              <h2>{t('expenses.form.title')}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('expenses.table.date')}</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('expenses.table.category')}</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {t(`expenses.categories.${c.toLowerCase()}`, c)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>{t('expenses.form.amount')}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('expenses.form.payment_mode')}</label>
                    <select
                      value={formData.paymentMode}
                      onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                    >
                      <option value="cash">{t('expenses.payment_modes.cash')}</option>
                      <option value="upi">{t('expenses.payment_modes.upi')}</option>
                      <option value="bank">{t('expenses.payment_modes.bank')}</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>{t('expenses.table.desc')}</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t('expenses.form.desc_placeholder')}
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? t('expenses.form.saving') : t('expenses.form.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpensesPage;
