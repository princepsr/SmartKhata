import './BillingPage.css';

/**
 * Billing Page
 * 
 * Main POS billing interface.
 * Keyboard shortcut: F2
 */

function BillingPage() {
  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Billing</h1>
        <p className="page-subtitle">Create new sale</p>
      </header>

      <div className="page-content">
        <div className="placeholder-card">
          <div className="placeholder-icon">💳</div>
          <h2>Billing Interface</h2>
          <p>POS billing screen will be implemented here</p>
          <ul className="feature-list">
            <li>Barcode scanning</li>
            <li>Product search</li>
            <li>Cart management</li>
            <li>Payment processing</li>
            <li>Receipt printing</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default BillingPage;
