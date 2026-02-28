import React, { useState, useEffect } from 'react';
import { useIPC, useIPCMutation } from '../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { formatCurrency, formatDateTime } from '../utils/formatters';
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
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    category: 'Other',
    amount: '',
    description: '',
    paymentMode: 'cash',
    date: new Date().toISOString().split('T')[0],
  });

  const { data, loading, execute: fetchExpenses } = useIPC<Expense[]>(IPC_CHANNELS.EXPENSE_LIST);
  const { execute: createExpense, loading: creating } = useIPCMutation(IPC_CHANNELS.EXPENSE_CREATE);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = (await createExpense({
      ...formData,
      amount: parseFloat(formData.amount),
    })) as any;
    if (result.success) {
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

  const totalExpenses = data?.reduce((sum, e) => sum + e.amount, 0) || 0;

  return (
    <div className="page expenses-page animate-fade-in">
      <header className="page-header">
        <div className="header-info">
          <h1 className="page-title">Expense Management</h1>
          <p className="page-subtitle">Track your shop's daily expenditures</p>
        </div>
        <div className="header-stats">
          <div className="stat-card">
            <span className="stat-label">Total Expenses</span>
            <span className="stat-value">{formatCurrency(totalExpenses)}</span>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Record Expense
          </button>
        </div>
      </header>

      <div className="page-content">
        <div className="data-table-container card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Method</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center">
                    Loading expenses...
                  </td>
                </tr>
              ) : data?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center">
                    No expenses recorded yet.
                  </td>
                </tr>
              ) : (
                data?.map((expense) => (
                  <tr key={expense.id}>
                    <td>{formatDateTime(expense.date)}</td>
                    <td>
                      <span className={`category-badge ${expense.category.toLowerCase()}`}>
                        {expense.category}
                      </span>
                    </td>
                    <td>{expense.description}</td>
                    <td className="text-capitalize">{expense.paymentMode}</td>
                    <td className="text-right font-bold text-danger">
                      -{formatCurrency(expense.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-zoom-in">
            <div className="modal-header">
              <h2>Record New Expense</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Date</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Amount (₹)</label>
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
                    <label>Payment Mode</label>
                    <select
                      value={formData.paymentMode}
                      onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI / Online</option>
                      <option value="bank">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What was this expense for?"
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
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Saving...' : 'Save Expense'}
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
