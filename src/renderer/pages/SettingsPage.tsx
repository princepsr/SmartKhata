import React, { useState } from 'react';
import { useAppSettingsStore } from '../store';
import { IPCPoc } from '../components/Debug/IPCPoc';
import { DatabaseStatus } from '../components/Debug/DatabaseStatus';
import { DataManagement } from '../components/Settings/DataManagement';
import './SettingsPage.css';

/**
 * Settings Page
 *
 * Professional tabbed interface for system configuration.
 * Fully synchronized with the "Rich App" design language and structural layout.
 */

type SettingsTab = 'shop' | 'inventory' | 'data' | 'debug';

function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useAppSettingsStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('shop');

  const handleSave = () => {
    alert('Settings saved successfully!');
  };

  const renderShopInfo = () => (
    <div className="tab-content-wrapper fade-in">
      <div className="settings-section-card">
        <h2>Shop Details</h2>
        <div className="settings-form">
          <div className="form-group full-width">
            <label htmlFor="shopName">Shop Name</label>
            <input
              id="shopName"
              type="text"
              value={settings.shopName}
              onChange={(e) => updateSettings({ shopName: e.target.value })}
              className="form-input"
              placeholder="Enter shop name..."
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="shopAddress">Postal Address</label>
            <textarea
              id="shopAddress"
              value={settings.shopAddress}
              onChange={(e) => updateSettings({ shopAddress: e.target.value })}
              className="form-input"
              rows={3}
              placeholder="Full address for receipt printing..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="receiptFooter">Receipt Footer Note</label>
            <input
              id="receiptFooter"
              type="text"
              value={settings.receiptFooter}
              onChange={(e) => updateSettings({ receiptFooter: e.target.value })}
              className="form-input"
              placeholder="e.g. Come visit again!"
            />
          </div>
        </div>

        <div className="settings-footer">
          <button type="button" onClick={resetSettings} className="btn btn-secondary">
            Reset Defaults
          </button>
          <button type="button" onClick={handleSave} className="btn btn-primary">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );

  const renderInventorySettings = () => (
    <div className="tab-content-wrapper fade-in">
      <div className="settings-section-card">
        <h2>Region & Tax</h2>
        <div className="settings-form">
          <div className="form-group">
            <label htmlFor="taxRate">Standard Tax Rate (%)</label>
            <input
              id="taxRate"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={settings.taxRate}
              onChange={(e) => updateSettings({ taxRate: parseFloat(e.target.value) || 0 })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="currency">Currency Symbol</label>
            <input
              id="currency"
              type="text"
              value={settings.currency}
              onChange={(e) => updateSettings({ currency: e.target.value })}
              className="form-input"
              maxLength={3}
            />
          </div>
        </div>

        <div className="settings-footer">
          <button type="button" onClick={resetSettings} className="btn btn-secondary">
            Reset Defaults
          </button>
          <button type="button" onClick={handleSave} className="btn btn-primary">
            Save Changes
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
              Inventory
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
        </div>

        <main className="settings-content">
          {activeTab === 'shop' && renderShopInfo()}
          {activeTab === 'inventory' && renderInventorySettings()}
          {activeTab === 'data' && renderDataManagement()}
          {activeTab === 'debug' && renderSystemDebug()}
        </main>
      </div>
    </div>
  );
}

export default SettingsPage;
