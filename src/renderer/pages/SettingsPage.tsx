import { useAppSettingsStore } from '../store';
import { IPCPoc } from '../components/Debug/IPCPoc';
import { DatabaseStatus } from '../components/Debug/DatabaseStatus';
import './SettingsPage.css';

/**
 * Settings Page
 * 
 * Application settings and configuration.
 * Keyboard shortcut: F6
 * 
 * EXAMPLE: Using Zustand store
 */

function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useAppSettingsStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Settings are already updated via onChange
    alert('Settings saved!');
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure application</p>
      </header>

      <div className="page-content">
        <div className="settings-card">
          <h2>Shop Information</h2>
          
          <form onSubmit={handleSubmit} className="settings-form">
            <div className="form-group">
              <label htmlFor="shopName">Shop Name</label>
              <input
                id="shopName"
                type="text"
                value={settings.shopName}
                onChange={(e) => updateSettings({ shopName: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="shopAddress">Shop Address</label>
              <textarea
                id="shopAddress"
                value={settings.shopAddress}
                onChange={(e) => updateSettings({ shopAddress: e.target.value })}
                className="form-input"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="taxRate">Tax Rate (%)</label>
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

            <div className="form-group">
              <label htmlFor="receiptFooter">Receipt Footer</label>
              <input
                id="receiptFooter"
                type="text"
                value={settings.receiptFooter}
                onChange={(e) => updateSettings({ receiptFooter: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Save Settings
              </button>
              <button
                type="button"
                onClick={resetSettings}
                className="btn btn-secondary"
              >
                Reset to Defaults
              </button>
            </div>
          </form>
          <div className="settings-card">
            <IPCPoc />
          </div>
          <div className="settings-card">
            <DatabaseStatus />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
