import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppSettingsStore } from '../store';
import { IPCPoc } from '../components/Debug/IPCPoc';
import { DatabaseStatus } from '../components/Debug/DatabaseStatus';
import { CloudHealth } from '../components/Debug/CloudHealth';
import { AppMaintenance } from '../components/Debug/AppMaintenance';
import { DataManagement } from '../components/Settings/DataManagement';
import { useLicense } from '../hooks/useLicense';
import LicenseActivationModal from '../components/modals/LicenseActivationModal';
import LicenseSettings from '../components/Settings/LicenseSettings';
import { APP_CONSTANTS } from '@shared/constants/app-constants';
import { PrivacyPolicy } from '../components/Settings/PrivacyPolicy';
import { UpdateSettings } from '../components/Settings/UpdateSettings';
import './SettingsPage.css';

/**
 * Settings Page
 *
 * Professional tabbed interface for system configuration.
 * Fully synchronized with the "Rich App" design language and structural layout.
 */

type SettingsTab = 'shop' | 'inventory' | 'printing' | 'licensing' | 'data' | 'privacy' | 'debug';

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
  const [searchParams] = useSearchParams();

  // Handle global tab switching
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (
      tab &&
      ['shop', 'inventory', 'printing', 'licensing', 'data', 'privacy', 'debug'].includes(tab)
    ) {
      setActiveTab(tab as SettingsTab);
    }
  }, [searchParams]);

  React.useEffect(() => {
    fetchSettings(true);
    const fetchPrinters = async () => {
      try {
        const response: any = await window.api.invoke('printer:list');
        const printers = response.success ? response.data : [];
        setPrinterList(printers);
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
    if (settings.gstEnabled && settings.gstNumber && !/^[0-9A-Z]{15}$/.test(settings.gstNumber)) {
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

  const renderGSTReminder = () => {
    if (!settings.gstNumber || !settings.gstEnabled) {
      return null;
    }
    return (
      <div
        className="gst-filing-reminder animate-fade-in"
        style={{
          background: 'var(--color-warning-light)',
          border: '1px solid var(--color-warning)',
          padding: '1rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#856404',
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>📅</span>
        <div>
          <strong>GST Filing Reminder:</strong> GSTR-1 for the current period should be exported and
          filed by the 11th of{' '}
          {new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleString('default', {
            month: 'long',
          })}
          .
        </div>
      </div>
    );
  };

  const renderShopInfo = () => (
    <div className="tab-content-wrapper fade-in">
      {renderGSTReminder()}
      <div className="settings-section-card">
        <div className="section-header">
          <h2>Shop Information</h2>
          <div className="status-indicator">
            {saveStatus === 'success' && <span className="status-msg success">Saved!</span>}
            {saveStatus === 'error' && (
              <span className="status-msg error">{error || 'Save failed'}</span>
            )}
          </div>
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

          {settings.gstEnabled && (
            <>
              <div className="form-group">
                <label htmlFor="gstNumber">GST Number (GSTIN)</label>
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

              {settings.gstNumber && (
                <>
                  <div className="form-group">
                    <label htmlFor="supplyType">Supply Type (GST)</label>
                    <select
                      id="supplyType"
                      value={settings.supplyType || 'intrastate'}
                      onChange={(e) =>
                        updateSettings({
                          supplyType: e.target.value as 'intrastate' | 'interstate',
                        })
                      }
                      className="form-input"
                    >
                      <option value="intrastate">Intra-State (CGST + SGST)</option>
                      <option value="interstate">Inter-State (IGST)</option>
                    </select>
                    <p className="help-text">
                      Intra-State: buyer &amp; seller in the same state. Inter-State: different
                      states.
                    </p>
                  </div>

                  <div className="form-group">
                    <label htmlFor="stateCode">State Code (2-digit)</label>
                    <input
                      id="stateCode"
                      type="text"
                      maxLength={2}
                      value={settings.stateCode || ''}
                      onChange={(e) => updateSettings({ stateCode: e.target.value })}
                      className={`form-input ${validationErrors.stateCode ? 'error' : ''}`}
                      placeholder="e.g. 07 (Delhi), 27 (Maharashtra)"
                    />
                    {validationErrors.stateCode && (
                      <span className="error-text">{validationErrors.stateCode}</span>
                    )}
                    <p className="help-text">
                      Two-digit GST state code (first 2 digits of your GSTIN).
                    </p>
                  </div>

                  <div className="form-group">
                    <label htmlFor="placeOfSupply">Place of Supply</label>
                    <input
                      id="placeOfSupply"
                      type="text"
                      value={settings.placeOfSupply || ''}
                      onChange={(e) => updateSettings({ placeOfSupply: e.target.value })}
                      className="form-input"
                      placeholder="e.g. Maharashtra, Delhi"
                    />
                    <p className="help-text">Printed on Tax Invoice as required by GST law.</p>
                  </div>
                </>
              )}
            </>
          )}
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
          <div className="status-indicator">
            {saveStatus === 'success' && <span className="status-msg success">Saved!</span>}
          </div>
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
              When enabled, billing will not check or update product stock levels. Useful if you
              only need billing without inventory management.
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
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.customersEnabled}
                onChange={(e) => updateSettings({ customersEnabled: e.target.checked })}
              />
              Enable Customers & Udhaar Tracking
            </label>
            <p className="help-text">
              Toggle the visibility of the Customers page and related features like balance (Udhaar)
              tracking.
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

          {settings.gstEnabled && (
            <div className="form-group">
              <label htmlFor="gstPercentage">Standard GST Rate (%)</label>
              <select
                id="gstPercentage"
                value={settings.gstPercentage}
                onChange={(e) => updateSettings({ gstPercentage: parseInt(e.target.value, 10) })}
                className="form-input"
              >
                {APP_CONSTANTS.BUSINESS.GST_RATES.map((rate) => (
                  <option key={rate.value} value={rate.value}>
                    {rate.label}
                  </option>
                ))}
              </select>
              <p className="help-text">Default rate used for tax calculations when enabled.</p>
            </div>
          )}

          {settings.gstEnabled && (
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.gstExclusiveMode}
                  onChange={(e) => updateSettings({ gstExclusiveMode: e.target.checked })}
                />
                GST Exclusive Mode (Master Switch)
              </label>
              <p className="help-text">
                When enabled, all products use tax-exclusive pricing and individual GST toggles are
                hidden. When disabled, products default to GST Inclusive (MRP).
              </p>
            </div>
          )}

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.enableBatchTracking}
                onChange={(e) => updateSettings({ enableBatchTracking: e.target.checked })}
              />
              Enable Batch & Expiry Tracking
            </label>
            <p className="help-text">
              Track expiry dates and unique batch numbers for your inventory.
            </p>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.expensesEnabled}
                onChange={(e) => updateSettings({ expensesEnabled: e.target.checked })}
              />
              Enable Expense Tracking
            </label>
            <p className="help-text">Track and manage your day-to-day business expenses.</p>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.quotationsEnabled}
                onChange={(e) => updateSettings({ quotationsEnabled: e.target.checked })}
              />
              Enable Quotations / Estimates
            </label>
            <p className="help-text">Create and print pre-sale estimates for your customers.</p>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.barcodeGenEnabled}
                onChange={(e) => updateSettings({ barcodeGenEnabled: e.target.checked })}
              />
              Enable Barcode Generator
            </label>
            <p className="help-text">Generate and print custom barcode labels for your products.</p>
          </div>
        </div>

        {/* Payment Integrations */}
        <div className="section-header" style={{ marginTop: '2rem' }}>
          <h3>💸 Payment Integrations</h3>
          <p>Configure dynamic payment methods for checkout</p>
        </div>

        <div className="settings-grid">
          <div className="form-group">
            <label htmlFor="upiId">Store UPI ID (VPA)</label>
            <input
              type="text"
              id="upiId"
              value={settings.upiId || ''}
              onChange={(e) => updateSettings({ upiId: e.target.value })}
              className="form-input"
              placeholder="e.g. 9876543210@paytm"
            />
            <p className="help-text">
              Used to dynamically generate a payment QR code during billing.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="upiName">Payee Name</label>
            <input
              type="text"
              id="upiName"
              value={settings.upiName || ''}
              onChange={(e) => updateSettings({ upiName: e.target.value })}
              className="form-input"
              placeholder="e.g. SmartKhata Store"
            />
            <p className="help-text">The display name shown when the customer scans the QR code.</p>
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
          <div className="status-indicator">
            {saveStatus === 'success' && <span className="status-msg success">Saved!</span>}
          </div>
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

          <div className="form-group">
            <label htmlFor="printCopies">Number of Copies</label>
            <select
              id="printCopies"
              value={settings.printCopies}
              onChange={(e) => updateSettings({ printCopies: parseInt(e.target.value, 10) })}
              className="form-input"
            >
              {[1, 2, 3, 4, 5].map((num) => (
                <option key={num} value={num}>
                  {num} {num === 1 ? 'Copy' : 'Copies'}
                </option>
              ))}
            </select>
            <p className="help-text">How many identical receipts should be printed per sale.</p>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.autoPrint}
                onChange={(e) => updateSettings({ autoPrint: e.target.checked })}
              />
              Auto-Print Bill after Checkout
            </label>
            <p className="help-text">
              Automatically trigger printing as soon as a sale is confirmed.
            </p>
          </div>
        </div>
      </div>

      <div className="settings-section-card">
        <div className="section-header">
          <h2>Bill Formatting</h2>
        </div>
        <p className="settings-description">
          Customize how your receipts look and select paper dimensions.
        </p>

        <div className="settings-form">
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

          <div className="form-group">
            <label>Paper Size</label>
            <div
              className="radio-group"
              style={{
                marginTop: '0.8rem',
                display: 'flex',
                flexDirection: 'row',
                gap: '1.5rem',
              }}
            >
              <label
                className="radio-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                <input
                  type="radio"
                  name="paperSize"
                  value="58mm"
                  checked={settings.paperSize === '58mm'}
                  onChange={() => updateSettings({ paperSize: '58mm' })}
                />
                2-inch (58mm)
              </label>
              <label
                className="radio-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
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
            <p className="help-text" style={{ marginTop: '0.5rem' }}>
              Select paper width based on your printer model.
            </p>
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
        <div className="section-header">
          <h2>Application Lifecycle</h2>
        </div>
        <UpdateSettings />
      </div>

      <div className="settings-section-card debug-card">
        <div className="section-header">
          <h2>Communication Bridge</h2>
        </div>
        <IPCPoc />
      </div>

      <div className="settings-section-card debug-card">
        <div className="section-header">
          <h2>Cloud Health</h2>
        </div>
        <CloudHealth />
      </div>

      <div className="settings-section-card debug-card">
        <div className="section-header">
          <h2>Storage Health</h2>
        </div>
        <DatabaseStatus />
      </div>
      <div className="settings-section-card debug-card">
        <div className="section-header">
          <h2>Maintenance & Utilities</h2>
        </div>
        <AppMaintenance />
      </div>
    </div>
  );

  const renderPrivacySettings = () => (
    <div className="tab-content-wrapper fade-in">
      <div className="settings-section-card">
        <div className="section-header">
          <h2>Privacy & Terms</h2>
        </div>
        <p className="settings-description">
          Review our commitment to your data privacy and security.
        </p>

        <div className="settings-form">
          <div className="form-group full-width">
            <PrivacyPolicy showTitle={false} />
          </div>
        </div>
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
              className={activeTab === 'privacy' ? 'active' : ''}
              onClick={() => setActiveTab('privacy')}
            >
              Privacy
            </button>
            <button
              className={activeTab === 'debug' ? 'active' : ''}
              onClick={() => setActiveTab('debug')}
            >
              System Debug
            </button>
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
          {activeTab === 'privacy' && renderPrivacySettings()}
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
