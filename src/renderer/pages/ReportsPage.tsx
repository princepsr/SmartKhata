import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import './ReportsPage.css';
import EmptyState from '../components/common/EmptyState';
import { reportApi } from '@renderer/services/report-api';
import {
  DailySalesSummary,
  PaymentModeSummary,
  GstReport,
  StockSummary,
  BillSummary,
  TrendAnalytics,
} from '@shared/types/report.types';
import { formatCurrency, toLocalDateISO } from '@renderer/utils/formatters';
import { BillDetailModal } from '../components/billing/BillDetailModal';
import { ipcClient } from '../utils/ipc';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { RichSelect } from '../components/ui/RichSelect';

type Tab = 'sales' | 'gst' | 'stock' | 'analytics';

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

const AnalyticsView: React.FC<{ data: TrendAnalytics | null }> = ({ data }) => {
  if (!data) {
    return <SkeletonLoader type="sales" />;
  }

  const maxSales = Math.max(...data.periods.map((p) => p.totalSales), 1);

  return (
    <div className="report-view analytics-view animate-fade-in">
      {/* Annual Summary Cards */}
      <div className="summary-cards">
        <div className="card card-gross">
          <div className="card-header-row">
            <h3>Total Sales</h3>
            <div className="icon-box icon-gross">💰</div>
          </div>
          <p className="value">₹{data.totalSales.toLocaleString('en-IN')}</p>
        </div>
        <div className="card card-net">
          <div className="card-header-row">
            <h3>Total Net Revenue</h3>
            <div className="icon-box icon-net">💳</div>
          </div>
          <div className="value highlight">₹{data.totalNet.toLocaleString('en-IN')}</div>
        </div>
        <div className="card card-orders">
          <div className="card-header-row">
            <h3>Total Transactions</h3>
            <div className="icon-box icon-orders">🧾</div>
          </div>
          <div className="value">{data.totalBills}</div>
        </div>
      </div>

      {/* Visual Timeline Chart */}
      <div className="chart-container">
        <h3>Revenue Trend</h3>
        <div className="bar-chart">
          {data.periods.map((period) => {
            const heightParam = (period.totalSales / maxSales) * 100;
            return (
              <div key={period.period} className="bar-group">
                <div
                  className="bar"
                  style={{ height: `${heightParam}%` }}
                  title={`₹${period.totalSales.toLocaleString()}`}
                ></div>
                <span className="bar-label">{period.period}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Table */}
      <div className="table-container">
        <h3>Detailed Breakdown</h3>
        <table className="report-table">
          <thead>
            <tr>
              <th>Period</th>
              <th className="text-right">Bills</th>
              <th className="text-right">Gross Sales</th>
              <th className="text-right">Net Sales</th>
              <th className="text-right">Growth</th>
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
                <td className="text-right">
                  {row.growth !== 0 && (
                    <span className={`trend-badge ${row.growth > 0 ? 'up' : 'down'}`}>
                      {row.growth > 0 ? '▲' : '▼'} {Math.abs(row.growth)}%
                    </span>
                  )}
                  {row.growth === 0 && <span className="text-muted">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

const ReportsPage: React.FC = () => {
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
      } else if (activeTab === 'stock') {
        const stock = await reportApi.getStockSummary(stockFilter);
        setStockSummary(stock);
      } else if (activeTab === 'analytics') {
        const { startDate, endDate } = getTrendDates(trendLookback);
        const data = await reportApi.getTrendAnalytics(startDate, endDate, trendGranularity);
        setAnalyticsData(data);
      }
    } catch (error) {
      console.error('Failed to load report data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateRange, stockFilter, trendGranularity, trendLookback]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

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

  return (
    <div className="page reports-page">
      <div className="page-content-wrapper animate-fade-in">
        <header className="page-header">
          <h1 className="page-title">Reports Dashboard</h1>
          <div className="header-actions">
            <button
              className="btn-secondary btn-excel"
              onClick={handleExportExcel}
              disabled={loading}
            >
              Export Excel
            </button>
            <button className="btn-secondary btn-pdf" onClick={handleExportPdf} disabled={loading}>
              Save PDF
            </button>
            <button className="btn-primary" onClick={handlePrint} disabled={loading}>
              Print Report
            </button>
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
                  title="Previous Interval"
                  disabled={activeTab === 'stock'}
                >
                  ‹
                </button>
                <button
                  className={`btn-preset ${selectedPreset === 'daily' ? 'active' : ''}`}
                  onClick={() => applyPreset('daily')}
                  disabled={activeTab === 'stock'}
                >
                  Daily
                </button>
                <button
                  className={`btn-preset ${selectedPreset === 'weekly' ? 'active' : ''}`}
                  onClick={() => applyPreset('weekly')}
                  disabled={activeTab === 'stock'}
                >
                  Weekly
                </button>
                <button
                  className={`btn-preset ${selectedPreset === 'monthly' ? 'active' : ''}`}
                  onClick={() => applyPreset('monthly')}
                  disabled={activeTab === 'stock'}
                >
                  Monthly
                </button>
                <button
                  className="btn-nav"
                  onClick={() => navigateInterval('next')}
                  title="Next Interval"
                  disabled={isNextDisabled()}
                >
                  ›
                </button>
              </div>

              <div className="date-inputs">
                <label>
                  Start
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => handleDateChange('start', e.target.value)}
                    disabled={activeTab === 'stock'}
                  />
                </label>
                <label>
                  End
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
                  Today
                </button>
              </div>
            </div>
          )}

          <div className="tabs">
            <button
              className={activeTab === 'sales' ? 'active' : ''}
              onClick={() => setActiveTab('sales')}
            >
              Sales
            </button>
            <button
              className={activeTab === 'gst' ? 'active' : ''}
              onClick={() => setActiveTab('gst')}
            >
              GST
            </button>
            <button
              className={activeTab === 'stock' ? 'active' : ''}
              onClick={() => setActiveTab('stock')}
            >
              Stock
            </button>
            <button
              className={activeTab === 'analytics' ? 'active' : ''}
              onClick={() => setActiveTab('analytics')}
            >
              Trends
            </button>
          </div>
        </div>

        <div className="reports-content">
          {loading && !dailySummary && !gstReport && !stockSummary && !analyticsData ? (
            <SkeletonLoader type={activeTab === 'analytics' ? 'sales' : activeTab} />
          ) : (
            <div className="tab-content-wrapper animate-fade-in" key={activeTab}>
              {activeTab === 'sales' &&
                (!dailySummary || dailySummary.billCount === 0 ? (
                  <EmptyState
                    title="No Sales Data"
                    message="We couldn't find any sales for the selected date range. Try adjusting your filters."
                    icon="📭"
                  />
                ) : (
                  <div className="report-view sales-view">
                    <div className="summary-cards">
                      <div className="card card-gross">
                        <div className="card-header-row">
                          <h3>Gross Sales</h3>
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

                      <div className="card card-net">
                        <div className="card-header-row">
                          <h3>Net Sales</h3>
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

                      <div className="card card-discount">
                        <div className="card-header-row">
                          <h3>Discount</h3>
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

                      <div className="card card-bills">
                        <div className="card-header-row">
                          <h3>Bills</h3>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {dailySummary.comparison?.billCount && (
                              <TrendChip
                                value={`${dailySummary.comparison.billCount.change}%`}
                                trend={dailySummary.comparison.billCount.trend}
                              />
                            )}
                            <div className="icon-box icon-bills">📄</div>
                          </div>
                        </div>
                        <div className="value">{dailySummary.billCount}</div>
                      </div>
                    </div>

                    <div className="payment-summary">
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
                      <div className="section-header">
                        <div className="section-title">Billwise Details</div>
                      </div>
                      <div className="data-table-container">
                        <div className="data-table-header grid-sales">
                          <div>Time</div>
                          <div>Bill #</div>
                          <div>Customer</div>
                          <div>Mode</div>
                          <div className="text-center">Qty</div>
                          <div className="text-right">Total</div>
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
                                title="View Full Details"
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
                                Print
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

              {activeTab === 'gst' && gstReport && (
                <div className="report-view gst-view">
                  <div className="summary-cards">
                    <div className="card card-bills">
                      <div className="card-header-row">
                        <h3>Taxable</h3>
                        <div className="icon-box icon-bills">📊</div>
                      </div>
                      <div className="value">{formatCurrency(gstReport.totalTaxable)}</div>
                    </div>
                    <div className="card card-net">
                      <div className="card-header-row">
                        <h3>GST</h3>
                        <div className="icon-box icon-net">💸</div>
                      </div>
                      <div className="value highlight">{formatCurrency(gstReport.totalGst)}</div>
                    </div>
                  </div>
                  <div className="table-section">
                    <div className="data-table-container">
                      <div className="data-table-header grid-gst">
                        <div>Slab</div>
                        <div className="text-right">Taxable</div>
                        <div className="text-right">GST</div>
                        <div className="text-right">Total</div>
                      </div>
                      {gstReport.slabs.map((slab) => (
                        <div key={slab.gstPercent} className="data-table-row grid-gst">
                          <div className="font-bold">{slab.gstPercent}%</div>
                          <div className="text-right">{formatCurrency(slab.taxableAmount)}</div>
                          <div className="text-right">{formatCurrency(slab.gstAmount)}</div>
                          <div className="text-right font-bold">
                            {formatCurrency(slab.totalAmount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'stock' && stockSummary && (
                <div className="report-view stock-view animate-fade-in">
                  <div className="summary-cards">
                    <div className="card card-bills">
                      <div className="card-header-row">
                        <h3>Items</h3>
                        <div className="icon-box icon-bills">📦</div>
                      </div>
                      <div className="value">{stockSummary.totalItems}</div>
                    </div>
                    <div className="card card-net">
                      <div className="card-header-row">
                        <h3>Value</h3>
                        <div className="icon-box icon-net">💎</div>
                      </div>
                      <div className="value highlight">
                        {formatCurrency(stockSummary.totalStockValue)}
                      </div>
                    </div>
                  </div>

                  <div className="table-section">
                    <div className="section-header">
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
                          onChange={(e) => setStockFilter(e.target.checked ? 'low_stock' : 'all')}
                        />
                        <span>Low Stock Only</span>
                      </label>
                    </div>

                    <div className="data-table-container">
                      <div className="data-table-header grid-stock">
                        <div>Product</div>
                        <div className="text-right">Stock</div>
                        <div className="text-right">Alert</div>
                        <div className="text-center">Status</div>
                      </div>
                      {stockSummary.items.map((item) => (
                        <div key={item.id} className="data-table-row grid-stock">
                          <div className="col-name">{item.name}</div>
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
