import React, { useState } from 'react';
import { useAppSettingsStore } from '../store';
import { IPCPoc } from '../components/Debug/IPCPoc';
import { DatabaseStatus } from '../components/Debug/DatabaseStatus';
import { DataManagement } from '../components/Settings/DataManagement';
import { useLicense } from '../hooks/useLicense';
import LicenseActivationModal from '../components/modals/LicenseActivationModal';
import LicenseSettings from '../components/Settings/LicenseSettings';
import { APP_CONSTANTS } from '@shared/constants/app-constants';
import './SettingsPage.css';

/**
 * Settings Page
 *
 * Professional tabbed interface for system configuration.
 * Fully synchronized with the "Rich App" design language and structural layout.
 */

type SettingsTab = 'shop' | 'inventory' | 'printing' | 'licensing' | 'data' | 'debug';

function SettingsPage() {
  const { settings, updateSettings, fetchSettings, saveSettings, resetSettings, isLoading, error } =
    useAppSettingsStore();
  const { refresh } = useLicense();
  const [activeTab, setActiveTab] = useState<SettingsTab>('shop');
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [printerList, setPrinterList] = useState<any[]>([]);
  const [isTestPrinting, setIsTestPrinting] = useState(false);

  React.useEffect(() => {
    fetchSettings();
    const fetchPrinters = async () => {
      try {
        const response: any = await window.api.invoke('printer:list');
        // Handle IPC response structure correctly
        const printers = response.success ? response.data : response;
        setPrinterList(Array.isArray(printers) ? printers : []);
      } catch (err) {
        console.error('Failed to fetch printers:', err);
      }
    };
    fetchPrinters();
  }, [fetchSettings]);

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!settings.shopName.trim()) {
      errors.shopName = 'Shop Name is required';
    }
    if (settings.phone && !/^\d{10}$/.test(settings.phone.replace(/[\s-()]/g, ''))) {
      errors.phone = 'Phone must be a 10-digit number';
    }
    if (settings.gstNumber && !/^[0-9A-Z]{15}$/.test(settings.gstNumber)) {
      errors.gstNumber = 'GST Number must be 15 alphanumeric characters';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    setSaveStatus('saving');
    const result = await saveSettings(settings);
    if (result.success) {
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } else {
      setSaveStatus('error');
    }
  };

  const renderShopInfo = () => (
    <div className="tab-content-wrapper fade-in">
      <div className="settings-section-card">
        <div className="section-header">
          <h2>Shop Information</h2>
          {saveStatus === 'success' && <span className="status-msg success">Saved!</span>}
          {saveStatus === 'error' && (
            <span className="status-msg error">{error || 'Save failed'}</span>
          )}
        </div>
        <p className="settings-description">
          Configure your shop details that will appear on printed receipts and invoices.
        </p>

        <div className="settings-form">
          <div className="form-group full-width">
            <label htmlFor="shopName">Shop Name *</label>
            <input
              id="shopName"
              type="text"
              value={settings.shopName}
              onChange={(e) => updateSettings({ shopName: e.target.value })}
              className={`form-input ${validationErrors.shopName ? 'error' : ''}`}
              placeholder="Enter shop name..."
            />
            {validationErrors.shopName && (
              <span className="error-text">{validationErrors.shopName}</span>
            )}
          </div>

          <div className="form-group full-width">
            <label htmlFor="shopAddress">Postal Address</label>
            <textarea
              id="shopAddress"
              value={settings.address || ''}
              onChange={(e) => updateSettings({ address: e.target.value })}
              className="form-input"
              rows={3}
              placeholder="Full address for receipt printing..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="text"
              value={settings.phone || ''}
              onChange={(e) => updateSettings({ phone: e.target.value })}
              className={`form-input ${validationErrors.phone ? 'error' : ''}`}
              placeholder="10-digit mobile number"
            />
            {validationErrors.phone && <span className="error-text">{validationErrors.phone}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="gstNumber">GST Number</label>
            <input
              id="gstNumber"
              type="text"
              value={settings.gstNumber || ''}
              onChange={(e) => updateSettings({ gstNumber: e.target.value.toUpperCase() })}
              className={`form-input ${validationErrors.gstNumber ? 'error' : ''}`}
              placeholder="15-character GSTIN (Optional)"
            />
            {validationErrors.gstNumber && (
              <span className="error-text">{validationErrors.gstNumber}</span>
            )}
          </div>
        </div>

        <div className="settings-footer">
          <button
            type="button"
            onClick={resetSettings}
            className="btn btn-secondary"
            disabled={isLoading}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn btn-primary"
            disabled={isLoading}
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderInventorySettings = () => (
    <div className="tab-content-wrapper fade-in">
      <div className="settings-section-card">
        <div className="section-header">
          <h2>Business Rules</h2>
          {saveStatus === 'success' && <span className="status-msg success">Saved!</span>}
        </div>
        <p className="settings-description">
          Set your preferences for taxes, bill rounding, and standard rates.
        </p>

        <div className="settings-form">
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.billingOnly}
                onChange={(e) => updateSettings({ billingOnly: e.target.checked })}
              />
              Billing Only Mode (Skip Inventory)
            </label>
            <p className="help-text">
              When enabled, billing will not check or update product stock levels.
              Useful if you only need billing without inventory management.
            </p>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.gstEnabled}
                onChange={(e) => updateSettings({ gstEnabled: e.target.checked })}
              />
              Enable GST Calculation
            </label>
            <p className="help-text">
              Automatically calculate GST on bills based on standard rate.
            </p>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.roundOffEnabled}
                onChange={(e) => updateSettings({ roundOffEnabled: e.target.checked })}
              />
              Enable Bill Rounding (to nearest ₹)
            </label>
            <p className="help-text">Round bill totals to avoid fractional currency amounts.</p>
          </div>

          <div className="form-group">
            <label htmlFor="gstPercentage">Standard GST Rate (%)</label>
            <select
              id="gstPercentage"
              value={settings.gstPercentage}
              onChange={(e) => updateSettings({ gstPercentage: parseInt(e.target.value, 10) })}
              className="form-input"
            >
              <option value={5}>5% (Basic)</option>
              <option value={12}>12% (Standard)</option>
              <option value={18}>18% (Premium/Luxury)</option>
            </select>
            <p className="help-text">Default rate used for tax calculations when enabled.</p>
          </div>
        </div>

        <div className="settings-footer">
          <button
            type="button"
            onClick={resetSettings}
            className="btn btn-secondary"
            disabled={isLoading}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn btn-primary"
            disabled={isLoading}
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderPrintingSettings = () => (
    <div className="tab-content-wrapper fade-in">
      <div className="settings-section-card">
        <div className="section-header">
          <h2>Printer Configuration</h2>
          {saveStatus === 'success' && <span className="status-msg success">Saved!</span>}
        </div>
        <p className="settings-description">
          Set up your thermal printer and customize how your receipts are printed.
        </p>

        <div className="settings-form">
          {/* Printer Selection - Row 1 */}
          <div className="form-group full-width">
            <label htmlFor="printerName">Available Printers</label>
            <select
              id="printerName"
              value={settings.printerName || ''}
              onChange={(e) => updateSettings({ printerName: e.target.value })}
              className="form-input"
            >
              <option value="">Default System Printer</option>
              {printerList.map((printer) => (
                <option key={printer.name} value={printer.name}>
                  {printer.name} {printer.isDefault ? '(Default)' : ''}
                </option>
              ))}
            </select>
            <p className="help-text">Select the thermal printer for receipt printing.</p>
          </div>

          <div className="divider full-width" style={{ margin: '1rem 0' }}></div>

          {/* Bill Formatting - Row 2 */}
          <div className="section-header full-width" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
              Bill Formatting
            </h3>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.showLogo}
                onChange={(e) => updateSettings({ showLogo: e.target.checked })}
              />
              Show Logo Space (Top Margin)
            </label>
            <p className="help-text">Enables additional space at the top for shop branding.</p>
          </div>

          <div className="form-group">
            <label
              className="checkbox-label"
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'flex-start',
                paddingTop: '4px',
              }}
            >
              <input
                type="checkbox"
                checked={settings.showCustomerDetails}
                onChange={(e) => updateSettings({ showCustomerDetails: e.target.checked })}
              />
              Show Customer ID on Receipt
            </label>
            <p className="help-text">Include customer identification on printed bills.</p>
          </div>

          <div className="form-group full-width">
            <label htmlFor="footerMessage">Footer Message</label>
            <textarea
              id="footerMessage"
              value={settings.footerMessage}
              onChange={(e) => updateSettings({ footerMessage: e.target.value })}
              className="form-input"
              rows={2}
              maxLength={200}
              placeholder="e.g. Thank you! Visit Again"
              style={{ height: 'auto', minHeight: '80px', padding: '12px' }}
            />
            <p className="help-text">Custom message printed at the bottom of every bill.</p>
          </div>

          <div className="divider full-width" style={{ margin: '1rem 0' }}></div>

          {/* Paper Size & Maintenance - Row 3 */}
          <div className="form-group">
            <label>Paper Size</label>
            <div className="radio-group" style={{ marginTop: '0.5rem' }}>
              <label className="radio-label">
                <input
                  type="radio"
                  name="paperSize"
                  value="58mm"
                  checked={settings.paperSize === '58mm'}
                  onChange={() => updateSettings({ paperSize: '58mm' })}
                />
                2-inch (58mm)
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="paperSize"
                  value="80mm"
                  checked={settings.paperSize === '80mm'}
                  onChange={() => updateSettings({ paperSize: '80mm' })}
                />
                3-inch (80mm)
              </label>
            </div>
            <p className="help-text">Select paper width based on your printer model.</p>
          </div>

          <div className="form-group">
            <label>Print Maintenance</label>
            <div style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={async () => {
                  setIsTestPrinting(true);
                  try {
                    const result: any = await window.api.invoke('settings:testPrint', {
                      printerName: settings.printerName,
                      paperSize: settings.paperSize,
                    });
                    if (!result?.success && !result) {
                      throw new Error('Printer might be offline or unavailable.');
                    }
                    alert('Test print sent successfully!');
                  } catch (err: any) {
                    alert(`Print Error: ${err.message || 'Unknown error'}`);
                  } finally {
                    setIsTestPrinting(false);
                  }
                }}
                disabled={isTestPrinting}
              >
                {isTestPrinting ? 'Printing...' : 'Run Test Print'}
              </button>
              <p className="help-text">Prints a test receipt to verify printer connection.</p>
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button
            type="button"
            onClick={resetSettings}
            className="btn btn-secondary"
            disabled={isLoading}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn btn-primary"
            disabled={isLoading}
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderDataManagement = () => (
    <div className="tab-content-wrapper fade-in">
      <DataManagement />
    </div>
  );

  const renderSystemDebug = () => (
    <div className="tab-content-wrapper fade-in debug-section">
      <div className="settings-section-card debug-card">
        <h2>Communication Bridge</h2>
        <IPCPoc />
      </div>
      <div className="settings-section-card debug-card">
        <h2>Storage Health</h2>
        <DatabaseStatus />
      </div>
    </div>
  );

  return (
    <div className="page settings-page">
      <div className="page-content-wrapper animate-fade-in">
        <header className="page-header settings-header">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle text-secondary">Configure your POS system preferences</p>
        </header>

        <div className="settings-toolbar">
          <div className="tabs">
            <button
              className={activeTab === 'shop' ? 'active' : ''}
              onClick={() => setActiveTab('shop')}
            >
              Shop Info
            </button>
            <button
              className={activeTab === 'inventory' ? 'active' : ''}
              onClick={() => setActiveTab('inventory')}
            >
              Business Rules
            </button>
            <button
              className={activeTab === 'printing' ? 'active' : ''}
              onClick={() => setActiveTab('printing')}
            >
              Printing
            </button>
            <button
              className={activeTab === 'licensing' ? 'active' : ''}
              onClick={() => setActiveTab('licensing')}
            >
              Licensing
            </button>
            <button
              className={activeTab === 'data' ? 'active' : ''}
              onClick={() => setActiveTab('data')}
            >
              Data Management
            </button>
            <button
              className={activeTab === 'debug' ? 'active' : ''}
              onClick={() => setActiveTab('debug')}
            >
              System Debug
            </button>
          </div>
          <div className="settings-sidebar-footer">
            <span className="app-version-tag">Version {APP_CONSTANTS.APP_VERSION}</span>
          </div>
        </div>

        <main className="settings-content">
          {activeTab === 'shop' && renderShopInfo()}
          {activeTab === 'inventory' && renderInventorySettings()}
          {activeTab === 'printing' && renderPrintingSettings()}
          {activeTab === 'licensing' && (
            <LicenseSettings onActivate={() => setShowLicenseModal(true)} />
          )}
          {activeTab === 'data' && renderDataManagement()}
          {activeTab === 'debug' && renderSystemDebug()}
        </main>
      </div>

      {showLicenseModal && (
        <LicenseActivationModal
          isOpen={showLicenseModal}
          onClose={() => {
            setShowLicenseModal(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

export default SettingsPage;
