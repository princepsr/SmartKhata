import { Outlet, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import GlobalMessages from './GlobalMessages';
import './Layout.css';

/**
 * Layout Component
 * 
 * Main layout wrapper with navigation sidebar and content area.
 * Used by all routes.
 */

function Layout() {
  const [appVersion, setAppVersion] = useState<string>('');

  useEffect(() => {
    if (window.electron) {
      window.electron.app.getVersion()
        .then(setAppVersion)
        .catch(console.error);
    }
  }, []);

  return (
    <>
      {/* Global Messages (loading, error, success) */}
      <GlobalMessages />
      
      <div className="layout">
        {/* Sidebar Navigation */}
        <aside className="layout-sidebar">
          <div className="sidebar-header">
            <h1 className="sidebar-title">SmartKhata</h1>
            <p className="sidebar-version">v{appVersion}</p>
          </div>

          <nav className="sidebar-nav">
            <NavLink to="/billing" className="nav-item">
              <span className="nav-icon">💳</span>
              <span className="nav-label">Billing</span>
              <kbd className="nav-shortcut">F2</kbd>
            </NavLink>

            <NavLink to="/products" className="nav-item">
              <span className="nav-icon">📦</span>
              <span className="nav-label">Products</span>
              <kbd className="nav-shortcut">F3</kbd>
            </NavLink>

            <NavLink to="/customers" className="nav-item">
              <span className="nav-icon">👥</span>
              <span className="nav-label">Customers</span>
              <kbd className="nav-shortcut">F4</kbd>
            </NavLink>

            <NavLink to="/reports" className="nav-item">
              <span className="nav-icon">📊</span>
              <span className="nav-label">Reports</span>
              <kbd className="nav-shortcut">F5</kbd>
            </NavLink>

            <NavLink to="/settings" className="nav-item">
              <span className="nav-icon">⚙️</span>
              <span className="nav-label">Settings</span>
              <kbd className="nav-shortcut">F6</kbd>
            </NavLink>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="layout-main">
          <Outlet />
        </main>
      </div>
    </>
  );
}

export default Layout;
