import './CustomersPage.css';

/**
 * Customers Page
 * 
 * Customer management.
 * Keyboard shortcut: F4
 */

function CustomersPage() {
  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Customers</h1>
        <p className="page-subtitle">Manage customer database</p>
      </header>

      <div className="page-content">
        <div className="placeholder-card">
          <div className="placeholder-icon">👥</div>
          <h2>Customer Management</h2>
          <p>Customer database screen will be implemented here</p>
          <ul className="feature-list">
            <li>Customer list with search</li>
            <li>Add/edit customer details</li>
            <li>Purchase history</li>
            <li>Credit management</li>
            <li>Contact information</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default CustomersPage;
