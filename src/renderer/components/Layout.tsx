import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import GlobalMessages from './GlobalMessages';
import LicenseBanner from './layout/LicenseBanner';
import CommandCenter from './layout/CommandCenter';
import LicenseActivationModal from './modals/LicenseActivationModal';
import { useAppSettingsStore } from '../store';
import './Layout.css';
import { IPC_CHANNELS } from '@shared/ipc/channels';

/**
 * Layout Component
 *
 * Main layout wrapper with navigation sidebar and content area.
 * Used by all routes.
 */

// --- Icons ---
const BillingIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect>
    <line x1="2" y1="10" x2="22" y2="10"></line>
  </svg>
);

const ProductsIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
    <line x1="12" y1="22.08" x2="12" y2="12"></line>
  </svg>
);

const CustomersIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const ReportsIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="20" x2="18" y2="10"></line>
    <line x1="12" y1="20" x2="12" y2="4"></line>
    <line x1="6" y1="20" x2="6" y2="14"></line>
  </svg>
);

const SettingsIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
);

function Layout() {
  const [appVersion, setAppVersion] = useState<string>('');
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const { settings, fetchSettings } = useAppSettingsStore();

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
    fetchSettings(true);
  }, [fetchSettings]);

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
          if (settings.customersEnabled) {
            e.preventDefault();
            navigate('/customers');
          }
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
  }, [navigate, settings.customersEnabled]);

  return (
    <div className="app-container">
      {/* Global Messages (loading, error, success) */}
      <GlobalMessages />

      {/* Command Center (Ctrl+K) */}
      <CommandCenter />

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
              <span className="nav-icon">
                <BillingIcon />
              </span>
              <span className="nav-label">Billing</span>
              <kbd className="nav-shortcut">F2</kbd>
            </NavLink>

            <NavLink to="/products" className="nav-item">
              <span className="nav-icon">
                <ProductsIcon />
              </span>
              <span className="nav-label">Products</span>
              <kbd className="nav-shortcut">F3</kbd>
            </NavLink>

            {settings.customersEnabled && (
              <NavLink to="/customers" className="nav-item">
                <span className="nav-icon">
                  <CustomersIcon />
                </span>
                <span className="nav-label">Customers</span>
                <kbd className="nav-shortcut">F4</kbd>
              </NavLink>
            )}

            <NavLink to="/reports" className="nav-item">
              <span className="nav-icon">
                <ReportsIcon />
              </span>
              <span className="nav-label">Reports</span>
              <kbd className="nav-shortcut">F5</kbd>
            </NavLink>

            <NavLink to="/settings" className="nav-item">
              <span className="nav-icon">
                <SettingsIcon />
              </span>
              <span className="nav-label">Settings</span>
              <kbd className="nav-shortcut">F6</kbd>
            </NavLink>
          </nav>

          <div className="sidebar-footer">
            <div className="store-info">
              <span className="store-name">{settings.shopName}</span>
              <div className="system-status">
                <span className="status-dot"></span>
                <span className="status-text">System Active</span>
              </div>
            </div>
          </div>
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
