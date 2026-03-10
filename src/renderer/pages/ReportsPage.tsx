import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import './ReportsPage.css';
import EmptyState from '../components/common/EmptyState';
import { reportApi } from '@renderer/services/report-api';
import {
  DailySalesSummary,
  PaymentModeSummary,
  GstReport,
  StockSummary,
  StockItem,
  StockAgingItem,
  BillSummary,
  TrendAnalytics,
  AnalyticsPeriod,
} from '@shared/types/report.types';
import { formatCurrency, toLocalDateISO, formatDate } from '@renderer/utils/formatters';
import { BillDetailModal } from '../components/billing/BillDetailModal';
import { ipcClient } from '../utils/ipc';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { RichSelect } from '../components/ui/RichSelect';
import { useAppSettingsStore } from '../store';

type Tab = 'sales' | 'gst' | 'stock' | 'analytics';


interface ITCTransaction {
  id: number;
  date: string;
  billNo: string;
  vendorName: string;
  taxableValue: number;
  gstAmount: number;
  itcClaimable: number;
}

const RichTooltip: React.FC<{
  title: string;
  children: React.ReactNode;
  meta?: string;
  className?: string;
}> = ({ title, children, meta, className }) => {
  return (
    <div className={`rich-tooltip-trigger ${className || ''}`}>
      {children}
      <div className="rich-tooltip">
        <h4>
          <span>✨</span> {title}
        </h4>
        <div className="tooltip-divider" />
        <p>{meta}</p>
        <div className="tooltip-meta">SmartKhata Analytics</div>
      </div>
    </div>
  );
};

const TrendChip: React.FC<{ value: string; trend: 'up' | 'down' | 'neutral' }> = ({
  value,
  trend,
}) => {
  const color = trend === 'up' ? 'trend-up' : trend === 'down' ? 'trend-down' : 'trend-neutral';
  const icon = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—';

  return (
    <span className={`trend-chip ${color} px-2 py-1 rounded-full text-xs font-medium`}>
      {icon} {value}
    </span>
  );
};

const SkeletonLoader: React.FC<{ type: 'sales' | 'gst' | 'stock' }> = ({ type }) => (
  <div className="tab-content-wrapper skeleton-view animate-fade-in">
    {type === 'sales' && (
      <>
        <div className="summary-cards">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
        <div className="payment-summary" style={{ marginBottom: '2rem' }}>
          {[1, 2].map((i) => (
            <div key={i} className="skeleton skeleton-badge" />
          ))}
        </div>
        <div className="table-section">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton skeleton-row" />
          ))}
        </div>
      </>
    )}
    {type === 'gst' && (
      <>
        <div className="summary-cards">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
        <div className="table-section">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton skeleton-row" />
          ))}
        </div>
      </>
    )}
    {type === 'stock' && (
      <>
        <div className="summary-cards">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
        <div className="table-section">
          {[1, 2, 3, 4, 10].map((i) => (
            <div key={i} className="skeleton skeleton-row" />
          ))}
        </div>
      </>
    )}
  </div>
);

const AnalyticsView: React.FC<{ data: TrendAnalytics | null }> = ({ data }) => {
  const { t } = useTranslation();
  const { settings } = useAppSettingsStore();
  const [chartField, setChartField] = useState<keyof AnalyticsPeriod>('netSales');

  if (!data) {
    return <SkeletonLoader type="sales" />;
  }

  const maxVal = Math.max(...data.periods.map((p) => Math.abs(Number(p[chartField]) || 0)), 1);

  const fieldOptions = [
    { id: 'totalSales', label: t('reports.analytics.total_sales') },
    { id: 'netSales', label: t('reports.analytics.revenue') },
    ...(settings.expensesEnabled
      ? [
          { id: 'totalProfit', label: t('reports.analytics.gross_profit') },
          { id: 'totalExpenses', label: t('reports.analytics.expenses') },
        ]
      : []),
    { id: 'trueNetProfit', label: t('reports.analytics.net_profit') },
  ];

  return (
    <div className="report-view analytics-view animate-fade-in">
      {/* Annual Summary Cards */}
      <div className="summary-cards">
        <RichTooltip
          title={t('reports.analytics.total_sales')}
          meta={t('reports.analytics.total_sales_meta')}
        >
          <div className="card card-gross">
            <div className="card-header-row">
              <h3>{t('reports.analytics.total_sales')}</h3>
              <div className="icon-box icon-gross">📈</div>
            </div>
            <p className="value">₹{data.totalSales.toLocaleString('en-IN')}</p>
          </div>
        </RichTooltip>

        <RichTooltip
          title={t('reports.analytics.revenue')}
          meta={t('reports.analytics.revenue_meta')}
        >
          <div className="card card-net">
            <div className="card-header-row">
              <h3>{t('reports.analytics.revenue')}</h3>
              <div className="icon-box icon-net">💰</div>
            </div>
            <div className="value highlight">₹{data.totalNet.toLocaleString('en-IN')}</div>
          </div>
        </RichTooltip>

        <RichTooltip
          title={t('reports.analytics.discount')}
          meta={t('reports.analytics.discount_meta')}
        >
          <div className="card card-discount">
            <div className="card-header-row">
              <h3>{t('reports.analytics.discount')}</h3>
              <div className="icon-box icon-discount">✂️</div>
            </div>
            <div className="value">
              ₹
              {data.periods
                .reduce((acc, p) => acc + (p.totalSales - p.netSales), 0)
                .toLocaleString('en-IN')}
            </div>
          </div>
        </RichTooltip>

        {settings.expensesEnabled && (
          <RichTooltip
            title={t('reports.analytics.expenses')}
            meta={t('reports.analytics.expenses_meta')}
          >
            <div className="card card-discount">
              <div className="card-header-row">
                <h3>{t('reports.analytics.expenses')}</h3>
                <div className="icon-box icon-discount">📉</div>
              </div>
              <div className="value">
                ₹
                {data.periods
                  .reduce((acc, p) => acc + (p.totalExpenses || 0), 0)
                  .toLocaleString('en-IN')}
              </div>
            </div>
          </RichTooltip>
        )}

        <RichTooltip
          title={
            settings.expensesEnabled
              ? t('reports.analytics.net_profit')
              : t('reports.analytics.gross_profit')
          }
          meta={
            settings.expensesEnabled
              ? t('reports.analytics.profit_meta_net')
              : t('reports.analytics.profit_meta_gross')
          }
        >
          <div className="card card-profit">
            <div className="card-header-row">
              <h3>
                {settings.expensesEnabled
                  ? t('reports.analytics.net_profit')
                  : t('reports.analytics.gross_profit')}
              </h3>
              <div className="icon-box icon-profit">💰</div>
            </div>
            <div className="value highlight">
              ₹
              {data.periods
                .reduce((acc, p) => acc + (p.trueNetProfit || 0), 0)
                .toLocaleString('en-IN')}
            </div>
          </div>
        </RichTooltip>
      </div>

      {data.totalNet > 0 && (
        <div className="reports-info-row animate-fade-in">
          <span className="info-icon">ℹ️</span>
          <span className="info-text">
            {t('reports.analytics.info_profit', {
              percent: Math.round(
                (data.periods.reduce((acc, p) => acc + (p.salesWithCost || 0), 0) /
                  (data.periods.reduce((acc, p) => acc + (p.totalItemSales || 0), 0) || 1)) *
                  100
              ),
            })}
          </span>
        </div>
      )}

      {/* Visual Timeline Chart */}
      <div className="chart-container">
        <div className="chart-header">
          <h3>{t('reports.analytics.trend_analysis')}</h3>
          <div className="chart-selector">
            {fieldOptions.map((opt) => (
              <button
                key={opt.id}
                className={`btn-chart-opt ${chartField === opt.id ? 'active' : ''}`}
                onClick={() => setChartField(opt.id as keyof AnalyticsPeriod)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bar-chart">
          {data.periods.map((period) => {
            const val = Number(period[chartField]) || 0;
            const isNegative = val < 0;
            const heightParam = (Math.abs(val) / maxVal) * 100;

            return (
              <div key={period.period} className="bar-group">
                <div className="bar-tooltip">
                  <div className="bar-value">
                    ₹{val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                  <div
                    className={`bar ${isNegative ? 'negative' : ''}`}
                    style={{ height: `${heightParam}%` }}
                  ></div>
                </div>
                <span className="bar-label">{period.period}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Table */}
      <div className="table-container">
        <h3>{t('reports.analytics.detailed_breakdown')}</h3>
        <table className="report-table">
          <thead>
            <tr>
              <th>{t('reports.analytics.period')}</th>
              <th className="text-right">{t('reports.analytics.bills')}</th>
              <th className="text-right">
                {t('reports.analytics.table.gross_sales', 'Gross Sales')}
              </th>
              <th className="text-right">{t('reports.analytics.revenue')}</th>
              {settings.expensesEnabled && (
                <th className="text-right">{t('reports.analytics.gross_profit')}</th>
              )}
              {settings.expensesEnabled && (
                <th className="text-right">{t('reports.analytics.expenses')}</th>
              )}
              <th className="text-right">{t('reports.analytics.margin')}</th>
              <th className="text-right">{t('reports.analytics.coverage')}</th>
              <th className="text-right">
                {settings.expensesEnabled
                  ? t('reports.analytics.net_profit')
                  : t('reports.analytics.profit')}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.periods.map((row) => (
              <tr key={row.period}>
                <td>{row.period}</td>
                <td className="text-right">{row.billCount}</td>
                <td className="text-right">
                  ₹{row.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="text-right">
                  ₹{row.netSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                {settings.expensesEnabled && (
                  <td className="text-right">
                    ₹{(row.totalProfit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                )}
                {settings.expensesEnabled && (
                  <td className="text-right">
                    ₹
                    {(row.totalExpenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                )}
                <td className="text-right">
                  {row.marginPercent && row.marginPercent > 0 ? (
                    <span className="margin-badge">{row.marginPercent}%</span>
                  ) : (
                    <span className="text-muted">N/A</span>
                  )}
                </td>
                <td className="text-right">
                  {row.salesWithCost !== undefined &&
                    row.totalItemSales !== undefined &&
                    row.totalItemSales > 0 && (
                      <span
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color:
                            row.salesWithCost < row.totalItemSales
                              ? 'var(--color-warning)'
                              : 'inherit',
                        }}
                      >
                        {Math.round((row.salesWithCost / row.totalItemSales) * 100)}%
                      </span>
                    )}
                </td>
                <td
                  className="text-right font-bold"
                  style={{
                    color:
                      (row.trueNetProfit || 0) < 0 ? 'var(--color-danger)' : 'var(--color-success)',
                  }}
                >
                  ₹{(row.trueNetProfit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StockAgingView: React.FC<{ data: StockAgingItem[] | null; loading: boolean }> = ({
  data,
  loading,
}) => {
  const { t } = useTranslation();
  if (loading) {
    return <SkeletonLoader type="stock" />;
  }
  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={t('reports.stock.aging.empty_title')}
        message={t('reports.stock.aging.empty_msg')}
        icon="✨"
      />
    );
  }

  return (
    <div className="report-view aging-view animate-fade-in">
      <div className="reports-info-row mb-4">
        <span className="info-icon">🕒</span>
        <span className="info-text">{t('reports.stock.aging.info')}</span>
      </div>
      <div className="table-container">
        <table className="report-table">
          <thead>
            <tr>
              <th>{t('reports.stock.table.product')}</th>
              <th>{t('reports.stock.table.sku')}</th>
              <th className="text-right">{t('reports.stock.table.qty')}</th>
              <th className="text-right">{t('reports.stock.table.last_sold')}</th>
              <th className="text-right">{t('reports.stock.table.idle_days')}</th>
              <th className="text-right">{t('reports.stock.table.stock_value')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id} className={item.idleDays > 60 ? 'critical-aging' : ''}>
                <td>{item.name}</td>
                <td>{item.sku || '-'}</td>
                <td className="text-right">{item.stockQty}</td>
                <td className="text-right">{formatDate(item.lastActionDate)}</td>
                <td className="text-right">
                  <span
                    className={`badge ${item.idleDays > 60 ? 'badge-danger' : 'badge-warning'}`}
                  >
                    {item.idleDays}
                  </span>
                </td>
                <td className="text-right">₹{item.stockValue.toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StockNearExpiryView: React.FC<{
  data: StockItem[] | null;
  loading: boolean;
  days: number;
  onDaysChange: (days: number) => void;
}> = ({ data, loading, days, onDaysChange }) => {
  const { t } = useTranslation();
  if (loading) {
    return <SkeletonLoader type="stock" />;
  }
  return (
    <div className="report-view near-expiry-view animate-fade-in">
      <div
        className="reports-info-row mb-4"
        style={{
          display: 'flex',
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'center',
          margin: '0 0 1rem 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="info-icon">⚠️</span>
          <span className="info-text">{t('reports.stock.near_expiry.info', { days })}</span>
        </div>
        <div
          className="near-expiry-filter-group"
          style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}
        >
          <label
            style={{
              fontWeight: 600,
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
              color: 'inherit',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {t('reports.stock.near_expiry.window')}
          </label>
          <select
            className="select-sm"
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(0,0,0,0.1)',
              fontSize: '0.75rem',
              background: 'white',
              width: 'auto',
              minWidth: '100px',
              cursor: 'pointer',
            }}
            value={days}
            onChange={(e) => onDaysChange(Number(e.target.value))}
          >
            <option value={30}>30 Days</option>
            <option value={60}>60 Days</option>
            <option value={90}>90 Days</option>
            <option value={180}>180 Days</option>
          </select>
        </div>
      </div>

      {!data || data.length === 0 ? (
        <EmptyState
          title={t('reports.stock.near_expiry.empty_title')}
          message={t('reports.stock.near_expiry.empty_msg')}
          icon="✅"
        />
      ) : (
        <div className="table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th>{t('reports.stock.table.product')}</th>
                <th>{t('reports.stock.table.batch')}</th>
                <th>{t('reports.stock.table.expiry')}</th>
                <th className="text-right">{t('reports.stock.table.qty')}</th>
                <th className="text-right">{t('reports.stock.table.status')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id} className="near-expiry-row">
                  <td>{item.name}</td>
                  <td>{item.batchNumber || '-'}</td>
                  <td>
                    <span className="expiry-badge">
                      {item.expiryDate ? formatDate(item.expiryDate) : '-'}
                    </span>
                  </td>
                  <td className="text-right">{item.stockQty}</td>
                  <td className="text-right">
                    <span className="status-badge status-warning">
                      {t('reports.stock.table.alert', 'EXPIRING')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const ReportsPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('sales');
  const [dateRange, setDateRange] = useState({
    startDate: toLocalDateISO(),
    endDate: toLocalDateISO(),
  });

  const [loading, setLoading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>(
    'daily'
  );
  const [dailySummary, setDailySummary] = useState<DailySalesSummary | null>(null);
  const [paymentModes, setPaymentModes] = useState<PaymentModeSummary[]>([]);
  const [billList, setBillList] = useState<BillSummary[]>([]);
  const [gstReport, setGstReport] = useState<GstReport | null>(null);
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);
  const [stockFilter, setStockFilter] = useState<'all' | 'low_stock'>('all');
  const [trendGranularity, setTrendGranularity] = useState<'day' | 'week' | 'month'>('day');
  const [trendLookback, setTrendLookback] = useState<string>('last_7_days');
  const [analyticsData, setAnalyticsData] = useState<TrendAnalytics | null>(null);
  const [itcSummary, setItcSummary] = useState<{
    totalItc: number;
    breakdown: ITCTransaction[];
  } | null>(null);
  const [stockAgingData, setStockAgingData] = useState<StockAgingItem[] | null>(null);
  const [nearExpiryData, setNearExpiryData] = useState<StockItem[] | null>(null);
  const [expiryDays, setExpiryDays] = useState(60);
  const [activeStockTab, setActiveStockTab] = useState<'current' | 'aging' | 'nearExpiry'>(
    'current'
  );
  const [sharingWhatsApp, setSharingWhatsApp] = useState(false);
  const [searchParams] = useSearchParams();

  // Handle global tab switching
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['sales', 'gst', 'stock', 'analytics'].includes(tab)) {
      setActiveTab(tab as Tab);
    }
  }, [searchParams]);

  // Helper to get dates for trend lookback
  const getTrendDates = (lookback: string) => {
    const end = new Date();
    const start = new Date();

    switch (lookback) {
      case 'last_7_days':
        start.setDate(end.getDate() - 6);
        break;
      case 'last_30_days':
        start.setDate(end.getDate() - 29);
        break;
      case 'this_month':
        start.setDate(1);
        break;
      case 'last_month': {
        start.setMonth(start.getMonth() - 1);
        start.setDate(1);
        const lastMonthEnd = new Date(end.getFullYear(), end.getMonth(), 0);
        end.setTime(lastMonthEnd.getTime());
        break;
      }
      case 'last_3_months':
        start.setMonth(start.getMonth() - 3);
        break;
      case 'this_year':
        start.setMonth(0, 1);
        break;
      default:
        start.setDate(end.getDate() - 6);
    }
    return {
      startDate: toLocalDateISO(start),
      endDate: toLocalDateISO(end),
    };
  };

  const loadReportData = React.useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'sales') {
        const summary = await reportApi.getDailySalesSummary(dateRange);
        const modes = await reportApi.getPaymentModeSummary(dateRange);
        const billsResult = await reportApi.getBillwiseSales(dateRange);
        setDailySummary(summary);
        setPaymentModes(modes || []);
        setBillList(billsResult?.data || []);
      } else if (activeTab === 'gst') {
        const gst = await reportApi.getGstSummary(dateRange);
        setGstReport(gst);

        // Fetch ITC
        try {
          const itc: {
            success: boolean;
            data: { totalItc: number; breakdown: ITCTransaction[] };
          } = await ipcClient.call(IPC_CHANNELS.PURCHASE_ITC_SUMMARY, dateRange);
          if (itc.success && itc.data) {
            setItcSummary(itc.data);
          }
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          console.error('Failed to fetch ITC data:', message);
        }
      } else if (activeTab === 'stock') {
        const stock = await reportApi.getStockSummary(stockFilter);
        setStockSummary(stock);
      } else if (activeTab === 'analytics') {
        const trendDates = getTrendDates(trendLookback);
        const data = await reportApi.getTrendAnalytics(
          trendDates.startDate,
          trendDates.endDate,
          trendGranularity
        );
        setAnalyticsData(data);
      }

      // Independent fetch for stock aging if on stock tab
      if (activeTab === 'stock') {
        if (activeStockTab === 'aging') {
          const aging = await reportApi.getStockAgingReport(30);
          setStockAgingData(aging);
        } else if (activeStockTab === 'nearExpiry') {
          const nearExpiry = await reportApi.getNearExpiryReport(expiryDays);
          setNearExpiryData(nearExpiry);
        }
      }
    } catch (error) {
      console.error('Failed to load report data:', error);
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    dateRange,
    stockFilter,
    trendGranularity,
    trendLookback,
    activeStockTab,
    expiryDays,
  ]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  // Handle GST and Billing feature toggle synchronization
  const { settings } = useAppSettingsStore();
  useEffect(() => {
    if (!settings.gstEnabled && activeTab === 'gst') {
      setActiveTab('sales');
    }
    if (settings.billingOnly && activeTab === 'stock') {
      setActiveTab('sales');
    }
  }, [settings.gstEnabled, settings.billingOnly, activeTab]);

  const [selectedBillNo, setSelectedBillNo] = useState<string | null>(null);

  const handleViewBill = (billNo: string) => {
    setSelectedBillNo(billNo);
  };

  const handleReprintBill = async (billId: number) => {
    try {
      await ipcClient.call(IPC_CHANNELS.BILL_PRINT, billId);
    } catch (error) {
      console.error('Failed to reprint bill:', error);
    }
  };

  const applyPreset = (preset: 'daily' | 'weekly' | 'monthly') => {
    setSelectedPreset(preset);
    const now = new Date();
    const today = toLocalDateISO(now);
    let start = today;

    if (preset === 'weekly') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.getFullYear(), now.getMonth(), diff);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      start = toLocalDateISO(monday);
      setDateRange({ startDate: start, endDate: toLocalDateISO(sunday) });
      return;
    } else if (preset === 'monthly') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      start = toLocalDateISO(firstDay);
      setDateRange({ startDate: start, endDate: toLocalDateISO(lastDay) });
      return;
    }

    setDateRange({ startDate: start, endDate: today });
  };

  const navigateInterval = (direction: 'prev' | 'next') => {
    const [sY, sM, sD] = dateRange.startDate.split('-').map(Number);
    const [eY, eM, eD] = dateRange.endDate.split('-').map(Number);

    const MS_PER_DAY = 86400000;
    const start = new Date(sY, sM - 1, sD);
    const end = new Date(eY, eM - 1, eD);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let nextStart: Date;
    let nextEnd: Date;

    if (selectedPreset === 'monthly') {
      const offset = direction === 'prev' ? -1 : 1;
      nextStart = new Date(sY, sM - 1 + offset, 1);
      nextEnd = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 0);
    } else {
      let jumpDays: number;
      if (selectedPreset === 'weekly') {
        jumpDays = 7;
      } else {
        jumpDays = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
      }

      const offset = direction === 'prev' ? -jumpDays : jumpDays;
      nextStart = new Date(start.getTime() + offset * MS_PER_DAY);
      nextEnd = new Date(end.getTime() + offset * MS_PER_DAY);
    }

    if (direction === 'next' && nextEnd > today) {
      if (nextStart > today) {
        return;
      }
      nextEnd = today;
    }

    setDateRange({
      startDate: toLocalDateISO(nextStart),
      endDate: toLocalDateISO(nextEnd),
    });
  };

  const isNextDisabled = () => {
    if (activeTab === 'stock' || activeTab === 'analytics') {
      return true;
    }

    const [sY, sM, sD] = dateRange.startDate.split('-').map(Number);
    const start = new Date(sY, sM - 1, sD);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let jumpDays: number;
    if (selectedPreset === 'monthly') {
      if (
        start.getFullYear() > today.getFullYear() ||
        (start.getFullYear() === today.getFullYear() && start.getMonth() >= today.getMonth())
      ) {
        return true;
      }
      return false;
    } else if (selectedPreset === 'weekly') {
      jumpDays = 7;
    } else {
      const [eY, eM, eD] = dateRange.endDate.split('-').map(Number);
      const end = new Date(eY, eM - 1, eD);
      jumpDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    }

    const nextStart = new Date(start.getTime() + jumpDays * 86400000);
    if (nextStart > today) {
      return true;
    }
    return false;
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    setSelectedPreset('custom');
    if (type === 'start') {
      setDateRange({ ...dateRange, startDate: value });
    } else {
      setDateRange({ ...dateRange, endDate: value });
    }
  };

  const handlePrint = async () => {
    try {
      setLoading(true);
      const formattedDateRange = `${new Date(dateRange.startDate).toLocaleDateString()} - ${new Date(dateRange.endDate).toLocaleDateString()}`;

      if (activeTab === 'sales' && dailySummary) {
        await reportApi.printReport(
          'sales',
          { summary: dailySummary, modes: paymentModes },
          formattedDateRange
        );
      } else if (activeTab === 'gst' && gstReport) {
        await reportApi.printReport('gst', gstReport, formattedDateRange);
      } else if (activeTab === 'stock' && stockSummary) {
        await reportApi.printReport(
          'stock',
          stockSummary,
          `Filter: ${stockFilter === 'all' ? 'All Items' : 'Low Stock Only'}`
        );
      } else if (activeTab === 'analytics' && analyticsData) {
        await reportApi.printReport(
          'analytics',
          analyticsData,
          `Lookback: ${trendLookback.replace(/_/g, ' ')}, Granularity: ${trendGranularity}`
        );
      }
    } catch (err: unknown) {
      console.error('Print failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      setLoading(true);
      const formattedDateRange = `${new Date(dateRange.startDate).toLocaleDateString()} - ${new Date(dateRange.endDate).toLocaleDateString()}`;

      if (activeTab === 'sales' && dailySummary) {
        await reportApi.exportPdf(
          'sales',
          { summary: dailySummary, modes: paymentModes },
          formattedDateRange
        );
      } else if (activeTab === 'gst' && gstReport) {
        await reportApi.exportPdf('gst', gstReport, formattedDateRange);
      } else if (activeTab === 'stock' && stockSummary) {
        await reportApi.exportPdf(
          'stock',
          stockSummary,
          `Filter: ${stockFilter === 'all' ? 'All Items' : 'Low Stock Only'}`
        );
      } else if (activeTab === 'analytics' && analyticsData) {
        await reportApi.exportPdf(
          'analytics',
          analyticsData,
          `Lookback: ${trendLookback.replace(/_/g, ' ')}, Granularity: ${trendGranularity}`
        );
      }
    } catch (err: unknown) {
      console.error('PDF Export failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setLoading(true);
      const formattedDateRange = `${new Date(dateRange.startDate).toLocaleDateString()} - ${new Date(dateRange.endDate).toLocaleDateString()}`;

      if (activeTab === 'sales' && dailySummary) {
        await reportApi.exportExcel(
          'sales',
          { summary: dailySummary, modes: paymentModes },
          formattedDateRange
        );
      } else if (activeTab === 'gst' && gstReport) {
        // Renaming to GSTR-1 Export for GST tab
        await reportApi.exportExcel('gst', gstReport, formattedDateRange);
      } else if (activeTab === 'stock' && stockSummary) {
        await reportApi.exportExcel(
          'stock',
          stockSummary,
          `Filter: ${stockFilter === 'all' ? 'All Items' : 'Low Stock Only'}`
        );
      } else if (activeTab === 'analytics' && analyticsData) {
        await reportApi.exportExcel(
          'analytics',
          analyticsData,
          `Lookback: ${trendLookback.replace(/_/g, ' ')}, Granularity: ${trendGranularity}`
        );
      }
    } catch (err: unknown) {
      console.error('Excel Export failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppShare = async () => {
    try {
      setSharingWhatsApp(true);
      const text = await reportApi.getWhatsAppSummary(dateRange);
      if (text) {
        const encodedText = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
      }
    } catch (err) {
      console.error('WhatsApp share failed:', err);
    } finally {
      setSharingWhatsApp(false);
    }
  };

  return (
    <div className="page reports-page">
      <div className="page-content-wrapper animate-fade-in">
        <header className="page-header">
          <h1 className="page-title">{t('reports.title')}</h1>
          <div className="header-actions">
            <button
              className="btn-secondary btn-excel"
              onClick={handleExportExcel}
              disabled={loading}
            >
              {activeTab === 'gst'
                ? t('reports.actions.export_gstr1')
                : t('reports.actions.export_excel')}
            </button>
            <button className="btn-secondary btn-pdf" onClick={handleExportPdf} disabled={loading}>
              {t('reports.actions.save_pdf')}
            </button>
            <button className="btn-primary" onClick={handlePrint} disabled={loading}>
              {t('reports.actions.print')}
            </button>
            {activeTab === 'sales' && (
              <button
                className="btn-whatsapp"
                onClick={handleWhatsAppShare}
                disabled={loading || sharingWhatsApp}
              >
                {sharingWhatsApp
                  ? t('reports.actions.generating')
                  : t('reports.actions.share_whatsapp')}
              </button>
            )}
          </div>
        </header>

        <div className="reports-toolbar">
          {activeTab === 'analytics' ? (
            <div
              className="analytics-toolbar"
              style={{ display: 'flex', gap: '8px', marginRight: 'auto' }}
            >
              <div className="preset-group">
                <button
                  className={`btn-preset ${trendGranularity === 'day' ? 'active' : ''}`}
                  onClick={() => setTrendGranularity('day')}
                >
                  Daily
                </button>
                <button
                  className={`btn-preset ${trendGranularity === 'week' ? 'active' : ''}`}
                  onClick={() => setTrendGranularity('week')}
                >
                  Weekly
                </button>
                <button
                  className={`btn-preset ${trendGranularity === 'month' ? 'active' : ''}`}
                  onClick={() => setTrendGranularity('month')}
                >
                  Monthly
                </button>
              </div>

              <RichSelect
                value={trendLookback}
                onChange={setTrendLookback}
                options={[
                  { value: 'last_7_days', label: 'Last 7 Days' },
                  { value: 'last_30_days', label: 'Last 30 Days' },
                  { value: 'this_month', label: 'This Month' },
                  { value: 'last_month', label: 'Last Month' },
                  { value: 'last_3_months', label: 'Last 3 Months' },
                  { value: 'this_year', label: 'This Year' },
                ]}
                className="trend-interval-select"
              />
            </div>
          ) : (
            <div className="date-filters">
              <div className="preset-group">
                <button
                  className="btn-nav"
                  onClick={() => navigateInterval('prev')}
                  title={t('reports.toolbar.prev')}
                  disabled={activeTab === 'stock'}
                >
                  ‹
                </button>
                <button
                  className={`btn-preset ${selectedPreset === 'daily' ? 'active' : ''}`}
                  onClick={() => applyPreset('daily')}
                  disabled={activeTab === 'stock'}
                >
                  {t('reports.toolbar.daily')}
                </button>
                <button
                  className={`btn-preset ${selectedPreset === 'weekly' ? 'active' : ''}`}
                  onClick={() => applyPreset('weekly')}
                  disabled={activeTab === 'stock'}
                >
                  {t('reports.toolbar.weekly')}
                </button>
                <button
                  className={`btn-preset ${selectedPreset === 'monthly' ? 'active' : ''}`}
                  onClick={() => applyPreset('monthly')}
                  disabled={activeTab === 'stock'}
                >
                  {t('reports.toolbar.monthly')}
                </button>
                <button
                  className="btn-nav"
                  onClick={() => navigateInterval('next')}
                  title={t('reports.toolbar.next')}
                  disabled={isNextDisabled()}
                >
                  ›
                </button>
              </div>

              <div className="date-inputs">
                <label>
                  {t('reports.toolbar.start')}
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => handleDateChange('start', e.target.value)}
                    disabled={activeTab === 'stock'}
                  />
                </label>
                <label>
                  {t('reports.toolbar.end')}
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => handleDateChange('end', e.target.value)}
                    disabled={activeTab === 'stock'}
                  />
                </label>
                <button
                  className="btn-secondary btn-today"
                  onClick={() => applyPreset('daily')}
                  disabled={activeTab === 'stock'}
                >
                  {t('reports.toolbar.today')}
                </button>
              </div>
            </div>
          )}

          <div className="tabs">
            <button
              className={activeTab === 'sales' ? 'active' : ''}
              onClick={() => setActiveTab('sales')}
            >
              {t('reports.tabs.sales')}
            </button>
            {settings.gstEnabled && (
              <button
                className={activeTab === 'gst' ? 'active' : ''}
                onClick={() => setActiveTab('gst')}
              >
                {t('reports.tabs.gst')}
              </button>
            )}
            {!settings.billingOnly && (
              <button
                className={activeTab === 'stock' ? 'active' : ''}
                onClick={() => setActiveTab('stock')}
              >
                {t('reports.tabs.stock')}
              </button>
            )}
            <button
              className={activeTab === 'analytics' ? 'active' : ''}
              onClick={() => setActiveTab('analytics')}
            >
              {t('reports.tabs.analytics')}
            </button>
          </div>
        </div>

        <div className="reports-content">
          {loading &&
          ((activeTab === 'sales' && !dailySummary) ||
            (activeTab === 'gst' && !gstReport) ||
            (activeTab === 'stock' && !stockSummary) ||
            (activeTab === 'analytics' && !analyticsData)) ? (
            <SkeletonLoader type={activeTab === 'analytics' ? 'sales' : activeTab} />
          ) : (
            <div className="tab-content-wrapper animate-fade-in" key={activeTab}>
              {activeTab === 'gst' &&
                (!gstReport || gstReport.slabs.length === 0 ? (
                  <EmptyState
                    title={t('reports.gst.empty_title')}
                    message={t('reports.gst.empty_msg')}
                    icon="🧾"
                  />
                ) : (
                  <div className="report-view gst-view animate-fade-in">
                    {/* Supply Type Banner */}
                    <div
                      className="reports-info-row animate-fade-in"
                      style={{ marginBottom: '1rem' }}
                    >
                      <span className="info-icon">🏷️</span>
                      <span className="info-text">
                        <strong>
                          {gstReport.supplyType === 'interstate'
                            ? t('reports.gst.interstate')
                            : t('reports.gst.intrastate')}
                        </strong>
                        {' — '}
                        {t('reports.gst.banner_info')}
                      </span>
                    </div>

                    <div
                      className="itc-summary-panel animate-fade-in"
                      style={{
                        background: 'white',
                        padding: '1.5rem',
                        borderRadius: '12px',
                        marginBottom: '2rem',
                        display: 'flex',
                        gap: '2rem',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      }}
                    >
                      <div className="itc-col" style={{ flex: 1 }}>
                        <h4 style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          {t('reports.gst.output')}
                        </h4>
                        <h2 style={{ fontSize: '1.8rem', color: '#dc3545' }}>
                          ₹{gstReport.totalGst.toLocaleString('en-IN')}
                        </h2>
                      </div>
                      <div className="itc-divider" style={{ width: '1px', background: '#eee' }} />
                      <div className="itc-col" style={{ flex: 1 }}>
                        <h4 style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          {t('reports.gst.input')}
                        </h4>
                        <h2 style={{ fontSize: '1.8rem', color: '#28a745' }}>
                          ₹{(itcSummary?.totalItc || 0).toLocaleString('en-IN')}
                        </h2>
                      </div>
                      <div className="itc-divider" style={{ width: '1px', background: '#eee' }} />
                      <div className="itc-col" style={{ flex: 1 }}>
                        <h4 style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          {t('reports.gst.net')}
                        </h4>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>
                          {formatCurrency(gstReport.netGstPayable)}
                        </h2>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {t('reports.gst.output_minus_itc', {
                            cn: formatCurrency(gstReport.totalCreditNoteGst),
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="summary-cards">
                      <div className="card card-gross">
                        <div className="card-header-row">
                          <h3>{t('reports.gst.taxable_total')}</h3>
                          <div className="icon-box icon-gross">📈</div>
                        </div>
                        <div className="value">{formatCurrency(gstReport.totalTaxable)}</div>
                      </div>

                      <div className="card card-net">
                        <div className="card-header-row">
                          <h3>{t('reports.gst.gst_total')}</h3>
                          <div className="icon-box icon-net">💰</div>
                        </div>
                        <div className="value highlight">{formatCurrency(gstReport.totalGst)}</div>
                      </div>

                      <div className="card card-profit">
                        <div className="card-header-row">
                          <h3>{t('reports.gst.grand_total')}</h3>
                          <div className="icon-box icon-profit">💸</div>
                        </div>
                        <div className="value">{formatCurrency(gstReport.totalAmount)}</div>
                      </div>
                    </div>

                    <div className="table-section">
                      <div className="reports-section-header">
                        <div className="reports-section-title">
                          {t('reports.gst.slab_summary', {
                            type: gstReport.supplyType.toUpperCase(),
                          })}
                        </div>
                      </div>
                      <div className="data-table-container">
                        <div className="data-table-header grid-gst">
                          <div>{t('reports.gst.table.slab')}</div>
                          <div className="text-right">{t('reports.gst.table.taxable')}</div>
                          <div className="text-right">{t('reports.gst.table.cgst')}</div>
                          <div className="text-right">{t('reports.gst.table.sgst')}</div>
                          <div className="text-right">{t('reports.gst.table.igst')}</div>
                          <div className="text-right">{t('reports.gst.table.total')}</div>
                        </div>
                        {gstReport.slabs.map((slab) => (
                          <div key={slab.gstPercent} className="data-table-row grid-gst">
                            <div>{slab.gstPercent}%</div>
                            <div className="text-right">{formatCurrency(slab.taxableAmount)}</div>
                            <div className="text-right">{formatCurrency(slab.cgstAmount)}</div>
                            <div className="text-right">{formatCurrency(slab.sgstAmount)}</div>
                            <div className="text-right">{formatCurrency(slab.igstAmount)}</div>
                            <div className="text-right">{formatCurrency(slab.gstAmount)}</div>
                          </div>
                        ))}
                        <div className="data-table-row grid-gst data-table-footer">
                          <div>{t('common.total')}</div>
                          <div className="text-right">{formatCurrency(gstReport.totalTaxable)}</div>
                          <div className="text-right">{formatCurrency(gstReport.totalCgst)}</div>
                          <div className="text-right">{formatCurrency(gstReport.totalSgst)}</div>
                          <div className="text-right">{formatCurrency(gstReport.totalIgst)}</div>
                          <div className="text-right">{formatCurrency(gstReport.totalGst)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

              {activeTab === 'sales' &&
                (!dailySummary || dailySummary.billCount === 0 ? (
                  <EmptyState
                    title={t('reports.sales.empty_title')}
                    message={t('reports.sales.empty_msg')}
                    icon="📭"
                  />
                ) : (
                  <div className="report-view sales-view">
                    <div className="summary-cards">
                      <RichTooltip
                        title={t('reports.sales.gross_sales')}
                        meta={t('reports.sales.gross_sales_meta')}
                      >
                        <div className="card card-gross">
                          <div className="card-header-row">
                            <h3>{t('reports.sales.gross_sales')}</h3>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {dailySummary.comparison?.totalSales && (
                                <TrendChip
                                  value={`${dailySummary.comparison.totalSales.change}%`}
                                  trend={dailySummary.comparison.totalSales.trend}
                                />
                              )}
                              <div className="icon-box icon-gross">📈</div>
                            </div>
                          </div>
                          <div className="value">{formatCurrency(dailySummary.totalSales)}</div>
                        </div>
                      </RichTooltip>

                      <RichTooltip
                        title={t('reports.sales.revenue')}
                        meta={t('reports.sales.revenue_meta')}
                      >
                        <div className="card card-net">
                          <div className="card-header-row">
                            <h3>{t('reports.sales.revenue')}</h3>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {dailySummary.comparison?.netSales && (
                                <TrendChip
                                  value={`${dailySummary.comparison.netSales.change}%`}
                                  trend={dailySummary.comparison.netSales.trend}
                                />
                              )}
                              <div className="icon-box icon-net">💰</div>
                            </div>
                          </div>
                          <div className="value highlight">
                            {formatCurrency(dailySummary.netSales)}
                          </div>
                        </div>
                      </RichTooltip>

                      <RichTooltip
                        title={t('reports.sales.discount')}
                        meta={t('reports.sales.discount_meta')}
                      >
                        <div className="card card-discount">
                          <div className="card-header-row">
                            <h3>{t('reports.sales.discount')}</h3>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {dailySummary.comparison?.totalDiscount && (
                                <TrendChip
                                  value={`${dailySummary.comparison.totalDiscount.change}%`}
                                  trend={dailySummary.comparison.totalDiscount.trend}
                                />
                              )}
                              <div className="icon-box icon-discount">✂️</div>
                            </div>
                          </div>
                          <div className="value">{formatCurrency(dailySummary.totalDiscount)}</div>
                        </div>
                      </RichTooltip>

                      {settings.expensesEnabled && (
                        <RichTooltip
                          title={t('reports.sales.expenses')}
                          meta={t('reports.sales.expenses_meta')}
                        >
                          <div className="card card-discount">
                            <div className="card-header-row">
                              <h3>{t('reports.sales.expenses')}</h3>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {dailySummary.comparison?.totalExpenses && (
                                  <TrendChip
                                    value={`${dailySummary.comparison.totalExpenses.change}%`}
                                    trend={dailySummary.comparison.totalExpenses.trend}
                                  />
                                )}
                                <div className="icon-box icon-discount">📉</div>
                              </div>
                            </div>
                            <div className="value">
                              {formatCurrency(dailySummary.totalExpenses)}
                            </div>
                          </div>
                        </RichTooltip>
                      )}

                      <RichTooltip
                        title={
                          settings.expensesEnabled
                            ? t('reports.analytics.net_profit')
                            : t('reports.analytics.gross_profit')
                        }
                        meta={
                          settings.expensesEnabled
                            ? t('reports.sales.profit_meta_net')
                            : t('reports.sales.profit_meta_gross')
                        }
                      >
                        <div className="card card-profit">
                          <div className="card-header-row">
                            <h3>
                              {settings.expensesEnabled
                                ? t('reports.analytics.net_profit')
                                : t('reports.analytics.gross_profit')}
                            </h3>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {dailySummary.comparison?.trueNetProfit && (
                                <TrendChip
                                  value={`${dailySummary.comparison.trueNetProfit.change}%`}
                                  trend={dailySummary.comparison.trueNetProfit.trend}
                                />
                              )}
                              <div className="icon-box icon-profit">💰</div>
                            </div>
                          </div>
                          <div className="value highlight">
                            {formatCurrency(dailySummary.trueNetProfit)}
                          </div>
                        </div>
                      </RichTooltip>
                    </div>

                    {dailySummary.salesWithCost < dailySummary.totalItemSales && (
                      <div
                        className="reports-info-row animate-fade-in"
                        style={{ marginTop: '-1rem', marginBottom: '1.5rem' }}
                      >
                        <span className="info-icon">ℹ️</span>
                        <span
                          className="info-text"
                          title={`Wait! Only ₹${dailySummary.salesWithCost.toLocaleString()} of ₹${dailySummary.totalItemSales.toLocaleString()} sales have cost data.`}
                        >
                          {t('reports.sales.cost_data_warning', {
                            percent: Math.round(
                              (dailySummary.salesWithCost / (dailySummary.totalItemSales || 1)) *
                                100
                            ),
                          })}
                          {dailySummary.marginPercent > 0 && (
                            <>
                              {' '}
                              •{' '}
                              <strong>
                                {dailySummary.marginPercent}% {t('reports.sales.average_margin')}
                              </strong>
                            </>
                          )}
                        </span>
                      </div>
                    )}

                    <div className="payment-summary">
                      <div className="mode-badge mode-badge-bills">
                        <span className="mode-name">{t('reports.sales.transactions')}</span>
                        <span className="mode-val">{dailySummary.billCount}</span>
                      </div>
                      {/* Explicitly show Cash and UPI first */}
                      <div className="mode-badge">
                        <span className="mode-name">CASH</span>
                        <span className="mode-val">
                          {formatCurrency(
                            paymentModes.find((p) => p.mode === 'cash')?.totalAmount || 0
                          )}
                        </span>
                      </div>
                      <div className="mode-badge">
                        <span className="mode-name">UPI</span>
                        <span className="mode-val">
                          {formatCurrency(
                            paymentModes.find((p) => p.mode === 'upi')?.totalAmount || 0
                          )}
                        </span>
                      </div>

                      {/* Show any other modes (e.g. mixed) */}
                      {paymentModes
                        .filter((p) => p.mode !== 'cash' && p.mode !== 'upi')
                        .map((mode) => (
                          <div key={mode.mode} className="mode-badge">
                            <span className="mode-name">{mode.mode}</span>
                            <span className="mode-val">{formatCurrency(mode.totalAmount)}</span>
                          </div>
                        ))}
                    </div>

                    <div className="table-section">
                      <div className="reports-section-header">
                        <div className="reports-section-title">
                          {t('reports.sales.billwise_details')}
                        </div>
                      </div>
                      <div className="data-table-container">
                        <div className="data-table-header grid-sales">
                          <div>{t('reports.sales.table.time')}</div>
                          <div>{t('reports.sales.table.bill')}</div>
                          <div>{t('reports.sales.table.customer')}</div>
                          <div>{t('reports.sales.table.mode')}</div>
                          <div className="text-center">{t('reports.sales.table.qty')}</div>
                          <div className="text-right" title="Bill Grand Total (Incl. GST)">
                            {t('reports.sales.table.total')}
                          </div>
                          <div className="text-right"></div>
                        </div>
                        {billList.map((bill) => (
                          <div key={bill.id} className="data-table-row grid-sales">
                            <div
                              style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}
                            >
                              {(() => {
                                // SQLite created_at is 'YYYY-MM-DD HH:MM:SS' in UTC
                                // We append 'Z' to ensure it's parsed as UTC before toLocaleTimeString
                                const dateStr = bill.date.includes(' ')
                                  ? bill.date.replace(' ', 'T') + 'Z'
                                  : bill.date;
                                return new Date(dateStr).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                });
                              })()}
                            </div>
                            <div>
                              <button
                                className="bill-link-btn"
                                onClick={() => handleViewBill(bill.billNumber)}
                                title={t('reports.sales.view_details')}
                              >
                                {bill.billNumber}
                              </button>
                            </div>
                            <div style={{ fontSize: '0.85rem' }}>{bill.customerName || '-'}</div>
                            <div>{bill.paymentMode}</div>
                            <div className="text-center">{bill.itemCount}</div>
                            <div className="text-right font-bold">{formatCurrency(bill.total)}</div>
                            <div className="text-right">
                              <button
                                className="btn-secondary btn-sm"
                                onClick={() => handleReprintBill(bill.id)}
                              >
                                {t('common.print', 'Print')}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

              {activeTab === 'stock' && (
                <div className="stock-view-container animate-fade-in">
                  <div className="sub-tabs mb-4">
                    <button
                      className={`sub-tab ${activeStockTab === 'current' ? 'active' : ''}`}
                      onClick={() => setActiveStockTab('current')}
                    >
                      {t('reports.stock.current')}
                    </button>
                    <button
                      className={`sub-tab ${activeStockTab === 'aging' ? 'active' : ''}`}
                      onClick={() => setActiveStockTab('aging')}
                    >
                      {t('reports.stock.aging_tab')}
                    </button>
                    <button
                      className={`sub-tab ${activeStockTab === 'nearExpiry' ? 'active' : ''}`}
                      onClick={() => setActiveStockTab('nearExpiry')}
                    >
                      {t('reports.stock.near_expiry_tab')}
                    </button>
                  </div>

                  {activeStockTab === 'current' ? (
                    <div className="report-view stock-view animate-fade-in">
                      {stockSummary && (
                        <>
                          <div className="summary-cards">
                            <RichTooltip
                              title={t('reports.stock.items')}
                              meta={t('reports.stock.tooltips.items')}
                            >
                              <div className="card card-bills">
                                <div className="card-header-row">
                                  <h3>{t('reports.stock.items')}</h3>
                                  <div className="icon-box icon-bills">📦</div>
                                </div>
                                <div className="value">{stockSummary.totalItems}</div>
                              </div>
                            </RichTooltip>

                            <RichTooltip
                              title={t('reports.stock.value')}
                              meta={t('reports.stock.tooltips.value')}
                            >
                              <div className="card card-net">
                                <div className="card-header-row">
                                  <h3>{t('reports.stock.value')}</h3>
                                  <div className="icon-box icon-net">💎</div>
                                </div>
                                <div className="value highlight">
                                  {formatCurrency(stockSummary.totalStockValue)}
                                </div>
                              </div>
                            </RichTooltip>
                          </div>

                          <div className="table-section">
                            <div className="reports-section-header">
                              <label
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  cursor: 'pointer',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={stockFilter === 'low_stock'}
                                  onChange={(e) =>
                                    setStockFilter(e.target.checked ? 'low_stock' : 'all')
                                  }
                                />
                                <span>{t('reports.stock.low_stock_filter')}</span>
                              </label>
                            </div>

                            <div className="data-table-container">
                              <div className="data-table-header grid-stock">
                                <div>{t('reports.stock.table.product')}</div>
                                <div>{t('reports.stock.table.batch')}</div>
                                <div>{t('reports.stock.table.expiry')}</div>
                                <div className="text-right">{t('reports.stock.table.qty')}</div>
                                <div className="text-right">{t('reports.stock.table.alert')}</div>
                                <div className="text-center">{t('reports.stock.table.status')}</div>
                              </div>
                              {stockSummary.items.map((item) => (
                                <div key={item.id} className="data-table-row grid-stock">
                                  <div className="col-name">{item.name}</div>
                                  <div className="col-batch">{item.batchNumber || '-'}</div>
                                  <div className="col-expiry">
                                    {item.expiryDate ? formatDate(item.expiryDate) : '-'}
                                  </div>
                                  <div className="text-right">
                                    <span
                                      className={
                                        item.stockQty <= 0
                                          ? 'stock-out'
                                          : item.stockQty <= (item.lowStockAlert || 0)
                                            ? 'stock-low'
                                            : 'stock-qty'
                                      }
                                    >
                                      {item.stockQty}
                                    </span>
                                  </div>
                                  <div className="text-right">{item.lowStockAlert}</div>
                                  <div className="text-center">
                                    {item.stockQty <= (item.lowStockAlert || 0) ? (
                                      <span className="status-badge status-critical">LOW</span>
                                    ) : (
                                      <span className="status-badge status-ok">OK</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : activeStockTab === 'aging' ? (
                    <StockAgingView data={stockAgingData} loading={loading} />
                  ) : (
                    <StockNearExpiryView
                      data={nearExpiryData}
                      loading={loading}
                      days={expiryDays}
                      onDaysChange={(d) => setExpiryDays(d)}
                    />
                  )}
                </div>
              )}
              {activeTab === 'analytics' && <AnalyticsView data={analyticsData} />}
            </div>
          )}
        </div>
      </div>

      <BillDetailModal
        isOpen={!!selectedBillNo}
        onClose={() => setSelectedBillNo(null)}
        billNumber={selectedBillNo}
      />
    </div>
  );
};

export default ReportsPage;
