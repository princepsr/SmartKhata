import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIPC, useIPCMutation } from '../hooks/useIPC';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import type { Quotation } from '@shared/types/ipc';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import EmptyState from '../components/common/EmptyState';
import './QuotationsPage.css';

function QuotationsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [showPendingOnly, setShowPendingOnly] = useLocalStorage('quotations_show_pending', false);

  const {
    data: quotations,
    loading,
    execute: fetchQuotations,
  } = useIPC<Quotation[]>(IPC_CHANNELS.QUOTATION_LIST);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  const { execute: updateStatus } = useIPCMutation(IPC_CHANNELS.QUOTATION_UPDATE_STATUS);
  const { execute: printQuotation } = useIPCMutation(IPC_CHANNELS.QUOTATION_PRINT);

  const handlePrint = async (id: number) => {
    try {
      await printQuotation({ quotationId: id });
    } catch (err) {
      alert('Failed to print quotation: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleCancel = async (id: number) => {
    if (window.confirm('Are you sure you want to cancel this quotation?')) {
      try {
        await updateStatus({ id, status: 'CANCELLED' });
        fetchQuotations();
      } catch (err) {
        alert('Failed to cancel quotation: ' + (err instanceof Error ? err.message : String(err)));
      }
    }
  };

  const handleConvert = (id: number) => {
    navigate(`/billing?quotationId=${id}`);
  };

  const filteredQuotations = useMemo(() => {
    if (!quotations) {
      return [];
    }
    return quotations.filter((q) => {
      const matchesSearch =
        q.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.customerNameSnapshot.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = showPendingOnly ? q.status === 'PENDING' : true;
      return matchesSearch && matchesFilter;
    });
  }, [quotations, searchTerm, showPendingOnly]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'status-pending';
      case 'CONVERTED':
        return 'status-converted';
      case 'EXPIRED':
        return 'status-expired';
      case 'CANCELLED':
        return 'status-cancelled';
      default:
        return '';
    }
  };

  return (
    <div className="page quotations-page">
      <div className="page-content-wrapper animate-fade-in">
        <header className="page-header">
          <h1 className="page-title">Quotations & Estimates</h1>
          <div className="header-actions">
            <div className="filter-group">
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={showPendingOnly}
                  onChange={(e) => setShowPendingOnly(e.target.checked)}
                />
                Pending Only
              </label>
            </div>
            <input
              type="text"
              className="search-input"
              placeholder="Search by quote # or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
            <button className="btn-primary" onClick={() => navigate('/billing?type=quotation')}>
              + New Quotation
            </button>
          </div>
        </header>

        <div className="quotations-content">
          <div className="data-table-container">
            <div className="data-table-header">
              <div className="col-qtn">Quote #</div>
              <div className="col-date">Date</div>
              <div className="col-customer">Customer</div>
              <div className="col-amount">Amount</div>
              <div className="col-expiry">Valid Until</div>
              <div className="col-status">Status</div>
              <div className="col-actions">Actions</div>
            </div>

            {loading ? (
              Array(5)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="data-table-row skeleton-row">
                    <div className="skeleton-line"></div>
                  </div>
                ))
            ) : filteredQuotations.length === 0 ? (
              <EmptyState
                title="No Quotations Found"
                message={
                  searchTerm
                    ? `We couldn't find any quotations matching "${searchTerm}".`
                    : 'Start by creating a new quotation for your customers.'
                }
                icon="📄"
                action={
                  !searchTerm
                    ? {
                        label: 'Create New Quotation',
                        onClick: () => navigate('/billing?type=quotation'),
                      }
                    : undefined
                }
              />
            ) : (
              filteredQuotations.map((quote) => (
                <div key={quote.id} className="data-table-row hover-row">
                  <div className="col-qtn quote-number">{quote.quotationNumber}</div>
                  <div className="col-date">
                    {formatDateTime(
                      typeof quote.createdAt === 'string'
                        ? quote.createdAt
                        : quote.createdAt.getTime()
                    )}
                  </div>
                  <div className="col-customer">
                    <div className="customer-name">{quote.customerNameSnapshot}</div>
                    {quote.customerId && <span className="customer-tag">Linked Account</span>}
                  </div>
                  <div className="col-amount quote-amount">{formatCurrency(quote.grandTotal)}</div>
                  <div className="col-expiry">
                    {quote.expiresAt ? new Date(quote.expiresAt).toLocaleDateString() : 'N/A'}
                  </div>
                  <div className="col-status">
                    <span className={`status-badge ${getStatusColor(quote.status)}`}>
                      {quote.status}
                    </span>
                  </div>
                  <div className="col-actions">
                    <button
                      className="btn-icon-premium"
                      title="Print Quote"
                      onClick={() => handlePrint(quote.id)}
                      disabled={quote.status === 'CANCELLED'}
                    >
                      <span className="icon">🖨️</span>
                    </button>
                    <button
                      className="btn-icon-premium"
                      title="Convert to Bill"
                      onClick={() => handleConvert(quote.id)}
                      disabled={quote.status === 'CONVERTED' || quote.status === 'CANCELLED'}
                    >
                      <span className="icon">🧾</span>
                    </button>
                    <button
                      className="btn-icon-premium danger"
                      title="Cancel Quote"
                      onClick={() => handleCancel(quote.id)}
                      disabled={quote.status === 'CONVERTED' || quote.status === 'CANCELLED'}
                    >
                      <span className="icon">✖</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuotationsPage;
