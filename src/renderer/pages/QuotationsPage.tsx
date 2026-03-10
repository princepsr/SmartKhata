import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useIPC, useIPCMutation } from '../hooks/useIPC';
import { useConfirm } from '../hooks/useConfirm';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import type { Quotation } from '@shared/types/ipc';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import EmptyState from '../components/common/EmptyState';
import './QuotationsPage.css';

function QuotationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { alert, confirm } = useConfirm();
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
      await alert({
        title: t('quotations_page.alerts.print_failed_title'),
        message: t('quotations_page.alerts.print_failed_msg', {
          error: err instanceof Error ? err.message : String(err),
        }),
        type: 'danger',
      });
    }
  };

  const handleCancel = async (id: number) => {
    const ok = await confirm({
      title: t('quotations_page.alerts.cancel_title'),
      message: t('quotations_page.alerts.cancel_msg'),
      type: 'warning',
      confirmLabel: t('quotations_page.alerts.cancel_btn'),
    });

    if (ok) {
      try {
        await updateStatus({ id, status: 'CANCELLED' });
        fetchQuotations();
      } catch (err) {
        await alert({
          title: t('quotations_page.alerts.cancel_failed_title'),
          message: t('quotations_page.alerts.cancel_failed_msg', {
            error: err instanceof Error ? err.message : String(err),
          }),
          type: 'danger',
        });
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
          <h1 className="page-title">{t('quotations_page.title')}</h1>
          <div className="header-actions">
            <div className="filter-group">
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={showPendingOnly}
                  onChange={(e) => setShowPendingOnly(e.target.checked)}
                />
                {t('quotations_page.pending_only')}
              </label>
            </div>
            <input
              type="text"
              className="search-input"
              placeholder={t('quotations_page.search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
            <button className="btn-primary" onClick={() => navigate('/billing?type=quotation')}>
              {t('quotations_page.new_quotation')}
            </button>
          </div>
        </header>

        <div className="quotations-content">
          <div className="data-table-container">
            <div className="data-table-header">
              <div className="col-qtn">{t('quotations_page.table.quote_no')}</div>
              <div className="col-date">{t('quotations_page.table.date')}</div>
              <div className="col-customer">{t('quotations_page.table.customer')}</div>
              <div className="col-amount">{t('quotations_page.table.amount')}</div>
              <div className="col-expiry">{t('quotations_page.table.valid_until')}</div>
              <div className="col-status">{t('quotations_page.table.status')}</div>
              <div className="col-actions">{t('quotations_page.table.actions')}</div>
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
                title={t('quotations_page.empty_title')}
                message={
                  searchTerm
                    ? t('quotations_page.empty_msg_search', { searchTerm })
                    : t('quotations_page.empty_msg')
                }
                icon="📄"
                action={
                  !searchTerm
                    ? {
                        label: t('quotations_page.create_new'),
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
                      typeof quote.createdAt === 'string' || typeof quote.createdAt === 'number'
                        ? quote.createdAt
                        : (quote.createdAt as Date).getTime()
                    )}
                  </div>
                  <div className="col-customer">
                    <div className="customer-name">{quote.customerNameSnapshot}</div>
                    {quote.customerId && (
                      <span className="customer-tag">{t('quotations_page.linked_account')}</span>
                    )}
                  </div>
                  <div className="col-amount quote-amount">{formatCurrency(quote.grandTotal)}</div>
                  <div className="col-expiry">
                    {quote.expiresAt
                      ? new Date(quote.expiresAt).toLocaleDateString()
                      : t('quotations_page.na')}
                  </div>
                  <div className="col-status">
                    <span className={`status-badge ${getStatusColor(quote.status)}`}>
                      {quote.status}
                    </span>
                  </div>
                  <div className="col-actions">
                    <button
                      className="btn-icon-premium"
                      title={t('quotations_page.tooltips.print')}
                      onClick={() => handlePrint(quote.id)}
                      disabled={quote.status === 'CANCELLED'}
                    >
                      <span className="icon">🖨️</span>
                    </button>
                    <button
                      className="btn-icon-premium"
                      title={t('quotations_page.tooltips.convert')}
                      onClick={() => handleConvert(quote.id)}
                      disabled={quote.status === 'CONVERTED' || quote.status === 'CANCELLED'}
                    >
                      <span className="icon">🧾</span>
                    </button>
                    <button
                      className="btn-icon-premium danger"
                      title={t('quotations_page.tooltips.cancel')}
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
