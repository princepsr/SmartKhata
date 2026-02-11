import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import GlobalMessages from './GlobalMessages';
import LicenseBanner from './layout/LicenseBanner';
import LicenseActivationModal from './modals/LicenseActivationModal';
import './Layout.css';
import { IPC_CHANNELS } from '@shared/ipc/channels';

/**
 * Layout Component
 *
 * Main layout wrapper with navigation sidebar and content area.
 * Used by all routes.
 */

function Layout() {
  const [appVersion, setAppVersion] = useState<string>('');
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await window.api.invoke<string>(IPC_CHANNELS.APP_VERSION);
        if (response.success && response.data) {
          setAppVersion(response.data);
        }
      } catch (error) {
        console.error('Failed to get app version:', error);
      }
    };

    fetchVersion();
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'F2':
          e.preventDefault();
          navigate('/billing');
          break;
        case 'F3':
          e.preventDefault();
          navigate('/products');
          break;
        case 'F4':
          e.preventDefault();
          navigate('/customers');
          break;
        case 'F5':
          e.preventDefault();
          navigate('/reports');
          break;
        case 'F6':
          e.preventDefault();
          navigate('/settings');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div className="app-container">
      {/* Global Messages (loading, error, success) */}
      <GlobalMessages />

      {/* License Banner (Global) */}
      <LicenseBanner onActivateClick={() => setIsLicenseModalOpen(true)} />

      {/* License Activation Modal */}
      <LicenseActivationModal
        isOpen={isLicenseModalOpen}
        onClose={() => setIsLicenseModalOpen(false)}
      />

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
    </div>
  );
}

export default Layout;
