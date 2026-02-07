import './ReportsPage.css';

/**
 * Reports Page
 * 
 * Sales reports and analytics.
 * Keyboard shortcut: F5
 */

function ReportsPage() {
  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">Sales analytics and reports</p>
      </header>

      <div className="page-content">
        <div className="placeholder-card">
          <div className="placeholder-icon">📊</div>
          <h2>Reports & Analytics</h2>
          <p>Reports dashboard will be implemented here</p>
          <ul className="feature-list">
            <li>Daily/monthly sales reports</li>
            <li>Product performance</li>
            <li>Profit analysis</li>
            <li>Stock alerts</li>
            <li>Export to PDF/Excel</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ReportsPage;
