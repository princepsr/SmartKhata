import { useEffect } from 'react';
import { useIPC } from '../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import './QuotationsPage.css';

interface Quotation {
  id: number;
  quotationNumber: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  validUntil: string;
  createdAt: string;
}

function QuotationsPage() {
  const {
    data,
    loading,
    execute: fetchQuotations,
  } = useIPC<Quotation[]>(IPC_CHANNELS.QUOTATION_LIST);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  return (
    <div className="page quotations-page animate-fade-in">
      <header className="page-header">
        <div className="header-info">
          <h1 className="page-title">Quotations / Estimates</h1>
          <p className="page-subtitle">Create non-binding estimates for customers</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => (window.location.href = '/billing?type=quotation')}
        >
          + New Quotation
        </button>
      </header>

      <div className="page-content">
        <div className="data-table-container card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Valid Until</th>
                <th className="text-right">Total Amount</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center">
                    Loading quotations...
                  </td>
                </tr>
              ) : data?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center">
                    No quotations created yet.
                  </td>
                </tr>
              ) : (
                data?.map((quote) => (
                  <tr key={quote.id}>
                    <td className="font-mono font-bold">{quote.quotationNumber}</td>
                    <td>{formatDateTime(quote.createdAt)}</td>
                    <td>
                      <div className="font-bold">{quote.customerName}</div>
                      <div className="text-xs text-gray-500">{quote.customerPhone}</div>
                    </td>
                    <td>{new Date(quote.validUntil).toLocaleDateString()}</td>
                    <td className="text-right font-bold">{formatCurrency(quote.totalAmount)}</td>
                    <td className="text-center">
                      <button className="btn-icon-alt" title="Print Quote">
                        🖨️
                      </button>
                      <button className="btn-icon-alt" title="Convert to Bill">
                        🧾
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default QuotationsPage;
