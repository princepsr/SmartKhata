import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useConfirm } from '../hooks/useConfirm';
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
import type { PrinterInfo } from '@shared/types/ipc';
import ContactDeveloper from '../components/common/ContactDeveloper';
import './SettingsPage.css';

/**
 * Settings Page
 *
 * Professional tabbed interface for system configuration.
 * Fully synchronized with the "Rich App" design language and structural layout.
 */

type SettingsTab =
  | 'shop'
  | 'inventory'
  | 'printing'
  | 'licensing'
  | 'data'
  | 'privacy'
  | 'debug'
  | 'whatsapp_reports'
  | 'support';

function SettingsPage() {
  const { settings, updateSettings, fetchSettings, saveSettings, resetSettings, isLoading, error } =
    useAppSettingsStore();
  const { alert } = useConfirm();
  const { refresh } = useLicense();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('shop');
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [printerList, setPrinterList] = useState<PrinterInfo[]>([]);
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [searchParams] = useSearchParams();

  // Handle global tab switching
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (
      tab &&
      [
        'shop',
        'inventory',
        'printing',
        'licensing',
        'data',
        'privacy',
        'debug',
        'whatsapp_reports',
        'support',
      ].includes(tab)
    ) {
      setActiveTab(tab as SettingsTab);
    }
  }, [searchParams]);

  React.useEffect(() => {
    fetchSettings(true);
    const fetchPrinters = async () => {
      try {
        const response = await window.api.invoke<PrinterInfo[]>(
          'printer:list'
        );
        const printers = response.success && response.data ? response.data : [];
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
      errors.shopName = t('settings.validation.shop_name');
    }
    if (settings.gstEnabled) {
      if (!settings.address?.trim()) {
        errors.address = t('settings.validation.address_gst');
      }
      if (!settings.gstNumber?.trim()) {
        errors.gstNumber = t('settings.validation.gstin_required');
      } else if (!/^[0-9A-Z]{15}$/.test(settings.gstNumber)) {
        errors.gstNumber = t('settings.validation.gstin_invalid');
      }
      if (!settings.stateCode?.trim()) {
        errors.stateCode = t('settings.validation.state_code_required');
      }
      if (!settings.placeOfSupply?.trim()) {
        errors.placeOfSupply = t('settings.validation.pos_required');
      }
    }

    if (settings.phone && !/^\d{10}$/.test(settings.phone.replace(/[\s-()]/g, ''))) {
      errors.phone = t('settings.validation.phone_invalid');
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
          <h2>{t('settings.shop_info')}</h2>
          <div className="status-indicator">
            {saveStatus === 'success' && <span className="status-msg success">Saved!</span>}
            {saveStatus === 'error' && (
              <span className="status-msg error">{error || 'Save failed'}</span>
            )}
          </div>
        </div>
        <p className="settings-description">{t('settings.shop_info_desc')}</p>

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
            <label htmlFor="shopAddress">
              {t('settings.postal_address')} {settings.gstEnabled && '*'}
            </label>
            <textarea
              id="shopAddress"
              value={settings.address || ''}
              onChange={(e) => updateSettings({ address: e.target.value })}
              className={`form-input ${validationErrors.address ? 'error' : ''}`}
              rows={3}
              placeholder={t('settings.address_placeholder')}
            />
            {validationErrors.address && (
              <span className="error-text">{validationErrors.address}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="phone">{t('settings.phone')}</label>
            <input
              id="phone"
              type="text"
              value={settings.phone || ''}
              onChange={(e) => updateSettings({ phone: e.target.value })}
              className={`form-input ${validationErrors.phone ? 'error' : ''}`}
              placeholder={t('settings.phone_placeholder')}
            />
            {validationErrors.phone && <span className="error-text">{validationErrors.phone}</span>}
          </div>

          {settings.gstEnabled && (
            <>
              <div className="form-group">
                <label htmlFor="gstNumber">{t('settings.gstin')}</label>
                <input
                  id="gstNumber"
                  type="text"
                  value={settings.gstNumber || ''}
                  onChange={(e) => updateSettings({ gstNumber: e.target.value.toUpperCase() })}
                  className={`form-input ${validationErrors.gstNumber ? 'error' : ''}`}
                  placeholder={t('settings.gstin_placeholder')}
                />
                {validationErrors.gstNumber && (
                  <span className="error-text">{validationErrors.gstNumber}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="supplyType">{t('settings.supply_type')}</label>
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
                  <option value="intrastate">{t('settings.intrastate')}</option>
                  <option value="interstate">{t('settings.interstate')}</option>
                </select>
                <p className="help-text">{t('settings.supply_type_help')}</p>
              </div>

              <div className="form-group">
                <label htmlFor="stateCode">{t('settings.state_code')}</label>
                <input
                  id="stateCode"
                  type="text"
                  maxLength={2}
                  value={settings.stateCode || ''}
                  onChange={(e) => updateSettings({ stateCode: e.target.value })}
                  className={`form-input ${validationErrors.stateCode ? 'error' : ''}`}
                  placeholder={t('settings.state_code_placeholder')}
                />
                {validationErrors.stateCode && (
                  <span className="error-text">{validationErrors.stateCode}</span>
                )}
                <p className="help-text">{t('settings.state_code_help')}</p>
              </div>

              <div className="form-group">
                <label htmlFor="placeOfSupply">{t('settings.place_of_supply')}</label>
                <input
                  id="placeOfSupply"
                  type="text"
                  value={settings.placeOfSupply || ''}
                  onChange={(e) => updateSettings({ placeOfSupply: e.target.value })}
                  className={`form-input ${validationErrors.placeOfSupply ? 'error' : ''}`}
                  placeholder={t('settings.place_of_supply_placeholder')}
                />
                {validationErrors.placeOfSupply && (
                  <span className="error-text">{validationErrors.placeOfSupply}</span>
                )}
                <p className="help-text">{t('settings.place_of_supply_help')}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="settings-section-card">
        <div className="section-header">
          <h3>{t('settings.regional_preferences')}</h3>
        </div>
        <p className="settings-description">{t('settings.regional_description')}</p>
        <div className="settings-form">
          <div className="form-group">
            <label htmlFor="language">{t('settings.language')}</label>
            <select
              id="language"
              value={settings.language || 'en'}
              onChange={(e) => updateSettings({ language: e.target.value as 'en' | 'hi' })}
              className="form-input"
            >
              <option value="en">{t('settings.english')} (default)</option>
              <option value="hi">{t('settings.hindi')} (हिन्दी)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="settings-section-card">
        {/* Payment Integrations */}
        <div className="section-header">
          <h3>{t('settings.payment_integrations')}</h3>
        </div>
        <p className="settings-description">{t('settings.payment_desc')}</p>

        <div className="settings-grid">
          <div className="form-group">
            <label htmlFor="upiId">{t('settings.upi_id')}</label>
            <input
              type="text"
              id="upiId"
              value={settings.upiId || ''}
              onChange={(e) => updateSettings({ upiId: e.target.value })}
              className="form-input"
              placeholder={t('settings.upi_id_placeholder')}
            />
            <p className="help-text">{t('settings.upi_id_help')}</p>
          </div>

          <div className="form-group">
            <label htmlFor="upiName">{t('settings.payee_name')}</label>
            <input
              type="text"
              id="upiName"
              value={settings.upiName || ''}
              onChange={(e) => updateSettings({ upiName: e.target.value })}
              className="form-input"
              placeholder={t('settings.payee_name_placeholder')}
            />
            <p className="help-text">{t('settings.payee_name_help')}</p>
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
          <h2>{t('settings.business_rules')}</h2>
          <div className="status-indicator">
            {saveStatus === 'success' && <span className="status-msg success">Saved!</span>}
          </div>
        </div>
        <p className="settings-description">{t('settings.business_description')}</p>

        <div className="settings-form">
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.billingOnly}
                onChange={(e) => updateSettings({ billingOnly: e.target.checked })}
              />
              {t('settings.business.billing_only')}
            </label>
            <p className="help-text">{t('settings.business.billing_only_help')}</p>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.roundOffEnabled}
                onChange={(e) => updateSettings({ roundOffEnabled: e.target.checked })}
              />
              {t('settings.business.rounding')}
            </label>
            <p className="help-text">{t('settings.business.rounding_help')}</p>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.customersEnabled}
                onChange={(e) => updateSettings({ customersEnabled: e.target.checked })}
              />
              {t('settings.business.customers')}
            </label>
            <p className="help-text">{t('settings.business.customers_help')}</p>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.gstEnabled}
                onChange={(e) => updateSettings({ gstEnabled: e.target.checked })}
              />
              {t('settings.business.gst_calc')}
            </label>
            <p className="help-text">{t('settings.business.gst_calc_help')}</p>
          </div>

          {settings.gstEnabled && (
            <div className="form-group">
              <label htmlFor="gstPercentage">{t('settings.business.gst_rate')}</label>
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
              <p className="help-text">{t('settings.business.gst_rate_help')}</p>
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
                {t('settings.business.gst_exclusive')}
              </label>
              <p className="help-text">{t('settings.business.gst_exclusive_help')}</p>
            </div>
          )}

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.enableBatchTracking}
                onChange={(e) => updateSettings({ enableBatchTracking: e.target.checked })}
              />
              {t('settings.business.batch_tracking')}
            </label>
            <p className="help-text">{t('settings.business.batch_tracking_help')}</p>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.expensesEnabled}
                onChange={(e) => updateSettings({ expensesEnabled: e.target.checked })}
              />
              {t('settings.business.expenses')}
            </label>
            <p className="help-text">{t('settings.business.expenses_help')}</p>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.quotationsEnabled}
                onChange={(e) => updateSettings({ quotationsEnabled: e.target.checked })}
              />
              {t('settings.business.quotations')}
            </label>
            <p className="help-text">{t('settings.business.quotations_help')}</p>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.barcodeGenEnabled}
                onChange={(e) => updateSettings({ barcodeGenEnabled: e.target.checked })}
              />
              {t('settings.business.barcode_gen')}
            </label>
            <p className="help-text">{t('settings.business.barcode_gen_help')}</p>
          </div>
        </div>

        <div className="settings-footer">
          <button
            type="button"
            onClick={resetSettings}
            className="btn btn-secondary"
            disabled={isLoading}
          >
            {t('settings.reset')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn btn-primary"
            disabled={isLoading}
          >
            {saveStatus === 'saving' ? t('settings.saving') : t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  );

  const renderPrintingSettings = () => (
    <div className="tab-content-wrapper fade-in">
      <div className="settings-section-card">
        <div className="section-header">
          <h2>{t('settings.printer.title')}</h2>
          <div className="status-indicator">
            {saveStatus === 'success' && <span className="status-msg success">Saved!</span>}
          </div>
        </div>
        <p className="settings-description">{t('settings.printer.desc')}</p>

        <div className="settings-form">
          {/* Printer Selection - Row 1 */}
          <div className="form-group full-width">
            <label htmlFor="printerName">{t('settings.printer.available')}</label>
            <select
              id="printerName"
              value={settings.printerName || ''}
              onChange={(e) => updateSettings({ printerName: e.target.value })}
              className="form-input"
            >
              <option value="">{t('settings.printer.default_system')}</option>
              {printerList.map((printer) => (
                <option key={printer.name} value={printer.name}>
                  {printer.name} {printer.isDefault ? '(Default)' : ''}
                </option>
              ))}
            </select>
            <p className="help-text">{t('settings.printer.available_help')}</p>
          </div>

          <div className="form-group">
            <label htmlFor="printCopies">{t('settings.printer.copies')}</label>
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
            <p className="help-text">{t('settings.printer.copies_help')}</p>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.autoPrint}
                onChange={(e) => updateSettings({ autoPrint: e.target.checked })}
              />
              {t('settings.printer.auto_print')}
            </label>
            <p className="help-text">{t('settings.printer.auto_print_help')}</p>
          </div>
        </div>
      </div>

      <div className="settings-section-card">
        <div className="section-header">
          <h2>{t('settings.printer.formatting')}</h2>
        </div>
        <p className="settings-description">{t('settings.printer.formatting_desc')}</p>

        <div className="settings-form">
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.showLogo}
                onChange={(e) => updateSettings({ showLogo: e.target.checked })}
              />
              {t('settings.printer.show_logo')}
            </label>
            <p className="help-text">{t('settings.printer.show_logo_help')}</p>
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
              {t('settings.printer.show_customer')}
            </label>
            <p className="help-text">{t('settings.printer.show_customer_help')}</p>
          </div>

          <div className="form-group">
            <label>{t('settings.printer.paper_size')}</label>
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
              {t('settings.printer.paper_size_help')}
            </p>
          </div>

          <div className="form-group">
            <label>{t('settings.printer.maintenance')}</label>
            <div style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={async () => {
                  setIsTestPrinting(true);
                  try {
                    const result = await window.api.invoke<{ success: boolean; message?: string }>(
                      'settings:testPrint',
                      {
                        printerName: settings.printerName,
                        paperSize: settings.paperSize,
                      }
                    );
                    if (!result?.success && !result) {
                      throw new Error('Printer might be offline or unavailable.');
                    }
                    await alert({
                      title: 'Success',
                      message: 'Test print sent successfully!',
                      type: 'info',
                    });
                  } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : String(err);
                    await alert({
                      title: 'Print Error',
                      message: `Print Error: ${message || 'Unknown error'}`,
                      type: 'danger',
                    });
                  } finally {
                    setIsTestPrinting(false);
                  }
                }}
                disabled={isTestPrinting}
              >
                {isTestPrinting
                  ? t('settings.printer.test_printing')
                  : t('settings.printer.test_print')}
              </button>
              <p className="help-text">{t('settings.printer.test_print_help')}</p>
            </div>
          </div>

          <div className="form-group full-width">
            <label htmlFor="footerMessage">{t('settings.printer.footer_msg')}</label>
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
            <p className="help-text">{t('settings.printer.footer_msg_help')}</p>
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

  const renderSupportSettings = () => (
    <div className="tab-content-wrapper fade-in">
      <div className="settings-section-card">
        <div className="section-header">
          <h2>{t('settings.contact_support')}</h2>
        </div>
        <p className="settings-description">{t('help.topics.contact_dev.description')}</p>

        <div className="settings-form">
          <div className="form-group full-width">
            <ContactDeveloper />
          </div>
        </div>
      </div>
    </div>
  );

  const renderWhatsAppReportsTab = () => (
    <div className="tab-content-wrapper fade-in">
      <div className="settings-section-card">
        <div className="section-header">
          <h2>{t('settings.whatsapp_reports.title')}</h2>
        </div>
        <p className="settings-description">
          Configure automated daily sales reports delivered directly to your WhatsApp.
        </p>

        <div className="settings-form">
          <div className="form-group">
            <div className="toggle-row">
              <div className="toggle-info">
                <label className="settings-label">
                  {t('settings.whatsapp_reports.enable_title')}
                </label>
                <p className="control-description">{t('settings.whatsapp_reports.enable_desc')}</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.whatsappAutoReportEnabled}
                  onChange={(e) => updateSettings({ whatsappAutoReportEnabled: e.target.checked })}
                />
                <span className="slider round"></span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="settings-label">
              {t('settings.whatsapp_reports.recipient_title')}
            </label>
            <input
              type="text"
              className="settings-input"
              placeholder="+919044612070"
              value={settings.whatsappRecipientNumber || ''}
              onChange={(e) => updateSettings({ whatsappRecipientNumber: e.target.value })}
            />
            <p className="control-description">{t('settings.whatsapp_reports.recipient_desc')}</p>
          </div>

          <div className="form-group">
            <label className="settings-label">{t('settings.whatsapp_reports.time_title')}</label>
            <input
              type="time"
              className="settings-input"
              value={settings.whatsappReportTime || '20:00'}
              onChange={(e) => updateSettings({ whatsappReportTime: e.target.value })}
            />
            <p className="control-description">{t('settings.whatsapp_reports.time_desc')}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page settings-page">
      <div className="page-content-wrapper animate-fade-in">
        <header className="page-header settings-header">
          <h1 className="page-title">{t('settings.title')}</h1> {/* Translated title */}
          <p className="page-subtitle text-secondary">{t('settings.subtitle')}</p>{' '}
          {/* Translated subtitle */}
        </header>

        <div className="settings-toolbar">
          <div className="settings-tabs">
            <button
              className={`tab-btn ${activeTab === 'shop' ? 'active' : ''}`}
              onClick={() => setActiveTab('shop')}
            >
              {t('settings.shop_info')}
            </button>
            <button
              className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
              onClick={() => setActiveTab('inventory')}
            >
              {t('settings.business_rules')}
            </button>
            <button
              className={`tab-btn ${activeTab === 'printing' ? 'active' : ''}`}
              onClick={() => setActiveTab('printing')}
            >
              {t('settings.printing')}
            </button>
            <button
              className={`tab-btn ${activeTab === 'licensing' ? 'active' : ''}`}
              onClick={() => setActiveTab('licensing')}
            >
              {t('settings.licensing')}
            </button>
            <button
              className={`tab-btn ${activeTab === 'data' ? 'active' : ''}`}
              onClick={() => setActiveTab('data')}
            >
              {t('settings.data_management')}
            </button>
            <button
              className={`tab-btn ${activeTab === 'privacy' ? 'active' : ''}`}
              onClick={() => setActiveTab('privacy')}
            >
              {t('settings.privacy_policy')}
            </button>
            <button
              className={`tab-btn ${activeTab === 'debug' ? 'active' : ''}`}
              onClick={() => setActiveTab('debug')}
            >
              {t('settings.debug')}
            </button>
            <button
              className={`tab-btn ${activeTab === 'whatsapp_reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('whatsapp_reports')}
            >
              {t('settings.whatsapp_reports.title')}
            </button>
            <button
              className={`tab-btn ${activeTab === 'support' ? 'active' : ''}`}
              onClick={() => setActiveTab('support')}
            >
              {t('settings.contact_support')}
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
          {activeTab === 'whatsapp_reports' && renderWhatsAppReportsTab()}
          {activeTab === 'support' && renderSupportSettings()}
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
