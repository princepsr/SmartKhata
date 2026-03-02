import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import GlobalMessages from './GlobalMessages';
import LicenseBanner from './layout/LicenseBanner';
import CommandCenter from './layout/CommandCenter';
import UpdateBanner from './layout/UpdateBanner';
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
const PurchasesIcon = () => (
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
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <path d="M3 6h18" />
    <path d="M16 10a4 4 0 0 1-8 0" />
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

const ExpensesIcon = () => (
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
    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const QuotationsIcon = () => (
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
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const BarcodeIcon = () => (
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
    <path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14" />
  </svg>
);

function Layout() {
  const [appVersion, setAppVersion] = useState<string>('');
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [isMoreExpanded, setIsMoreExpanded] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });
  const { settings, fetchSettings } = useAppSettingsStore();

  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isSidebarCollapsed.toString());
  }, [isSidebarCollapsed]);

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

  // Auto-expand "More" section if current path is a sub-item
  useEffect(() => {
    const subPaths = ['/purchases', '/expenses', '/quotations', '/barcode-gen'];
    if (subPaths.some((path) => window.location.pathname.includes(path))) {
      setIsMoreExpanded(true);
    }
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
        case 'F7':
          if (settings.gstEnabled) {
            e.preventDefault();
            setIsMoreExpanded(true);
            navigate('/purchases');
          }
          break;
        case 'F8':
          if (settings.expensesEnabled) {
            e.preventDefault();
            setIsMoreExpanded(true);
            navigate('/expenses');
          }
          break;
        case 'F9':
          if (settings.quotationsEnabled) {
            e.preventDefault();
            setIsMoreExpanded(true);
            navigate('/quotations');
          }
          break;
        case 'F10':
          if (settings.barcodeGenEnabled) {
            e.preventDefault();
            setIsMoreExpanded(true);
            navigate('/barcode-gen');
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    navigate,
    settings.customersEnabled,
    settings.gstEnabled,
    settings.expensesEnabled,
    settings.quotationsEnabled,
    settings.barcodeGenEnabled,
  ]);

  const hasMoreItems =
    settings.gstEnabled ||
    settings.expensesEnabled ||
    settings.quotationsEnabled ||
    settings.barcodeGenEnabled;

  return (
    <div className="app-container">
      {/* Global Messages (loading, error, success) */}
      <GlobalMessages />

      {/* Command Center (Ctrl+K) */}
      <CommandCenter />

      {/* Update Banner (Global) */}
      <UpdateBanner />

      {/* License Banner (Global) */}
      <LicenseBanner onActivateClick={() => setIsLicenseModalOpen(true)} />

      {/* License Activation Modal */}
      <LicenseActivationModal
        isOpen={isLicenseModalOpen}
        onClose={() => setIsLicenseModalOpen(false)}
      />

      <div className="layout">
        {/* Sidebar Navigation */}
        <aside className={`layout-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-header">
            <div className="header-top">
              {!isSidebarCollapsed && (
                <div className="brand-container">
                  <h1 className="sidebar-title">SmartKhata</h1>
                  <span className="sidebar-version">v{appVersion}</span>
                </div>
              )}
              <button
                className="sidebar-toggle-btn"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
            </div>
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

            {hasMoreItems && (
              <div className={`nav-section-container ${isMoreExpanded ? 'expanded' : ''}`}>
                <div
                  className="nav-item more-toggle"
                  onClick={() => setIsMoreExpanded(!isMoreExpanded)}
                >
                  <span className="nav-icon">
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
                      <circle cx="12" cy="12" r="1"></circle>
                      <circle cx="19" cy="12" r="1"></circle>
                      <circle cx="5" cy="12" r="1"></circle>
                    </svg>
                  </span>
                  <span className="nav-label">More</span>
                  <div className="nav-dropdown-btn">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                </div>

                {isMoreExpanded && (
                  <div className="more-items-list animate-pure-fade">
                    {settings.gstEnabled && (
                      <NavLink to="/purchases" className="nav-item">
                        <span className="nav-icon">
                          <PurchasesIcon />
                        </span>
                        <span className="nav-label">Purchases</span>
                        <kbd className="nav-shortcut">F7</kbd>
                      </NavLink>
                    )}

                    {settings.expensesEnabled && (
                      <NavLink to="/expenses" className="nav-item">
                        <span className="nav-icon">
                          <ExpensesIcon />
                        </span>
                        <span className="nav-label">Expenses</span>
                        <kbd className="nav-shortcut">F8</kbd>
                      </NavLink>
                    )}

                    {settings.quotationsEnabled && (
                      <NavLink to="/quotations" className="nav-item">
                        <span className="nav-icon">
                          <QuotationsIcon />
                        </span>
                        <span className="nav-label">Quotation</span>
                        <kbd className="nav-shortcut">F9</kbd>
                      </NavLink>
                    )}

                    {settings.barcodeGenEnabled && (
                      <NavLink to="/barcode-gen" className="nav-item">
                        <span className="nav-icon">
                          <BarcodeIcon />
                        </span>
                        <span className="nav-label">Barcodes</span>
                        <kbd className="nav-shortcut">F10</kbd>
                      </NavLink>
                    )}
                  </div>
                )}
              </div>
            )}

            <NavLink to="/settings" className="nav-item settings-link">
              <span className="nav-icon">
                <SettingsIcon />
              </span>
              <span className="nav-label">Settings</span>
              <kbd className="nav-shortcut">F6</kbd>
            </NavLink>
          </nav>

          <div className="sidebar-footer">
            <div className="store-info">
              {!isSidebarCollapsed && <span className="store-name">{settings.shopName}</span>}
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
