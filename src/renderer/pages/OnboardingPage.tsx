import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSettingsStore } from '../store/useAppSettingsStore';
import { PrivacyPolicy } from '../components/Settings/PrivacyPolicy';
import { useConfirm } from '../hooks/useConfirm';
import './OnboardingPage.css';

/**
 * Onboarding Page
 *
 * First-run experience for SmartKhata.
 * Mandatory Privacy Policy acceptance.
 */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const { settings, saveSettings } = useAppSettingsStore();
  const { alert } = useConfirm();
  const [step, setStep] = useState(1); // 1: Welcome/Mode, 2: Privacy
  const [selectedMode, setSelectedMode] = useState<'GENERAL' | 'KIRANA' | 'MEDICAL'>('GENERAL');
  const [hasReadToBottom, setHasReadToBottom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already accepted, redirect to billing
  useEffect(() => {
    if (settings.privacyPolicyAccepted) {
      navigate('/billing', { replace: true });
    }
  }, [settings.privacyPolicyAccepted, navigate]);

  const handleAccept = async () => {
    setIsSubmitting(true);
    try {
      let modeDefaults = {};
      if (selectedMode === 'GENERAL') {
        modeDefaults = {
          billingOnly: true,
          gstEnabled: false,
          customersEnabled: false,
          expensesEnabled: false,
          quotationsEnabled: false,
          barcodeGenEnabled: false,
          enableBatchTracking: false,
          roundOffEnabled: true,
          paperSize: '58mm',
          footerMessage: 'Thank you! Visit Again',
        };
      } else if (selectedMode === 'KIRANA') {
        modeDefaults = {
          billingOnly: false,
          gstEnabled: false,
          customersEnabled: true,
          expensesEnabled: true,
          quotationsEnabled: true,
          barcodeGenEnabled: true,
          enableBatchTracking: false,
          roundOffEnabled: true,
          paperSize: '58mm',
          footerMessage: 'Thank you for shopping with us!',
        };
      } else if (selectedMode === 'MEDICAL') {
        modeDefaults = {
          billingOnly: false,
          gstEnabled: true,
          customersEnabled: true,
          expensesEnabled: true,
          quotationsEnabled: true,
          barcodeGenEnabled: true,
          enableBatchTracking: true,
          roundOffEnabled: true,
          paperSize: '80mm',
          showCustomerDetails: true,
          footerMessage: 'Get Well Soon!',
        };
      }

      // Initialize app with mode using the IPC if available,
      // or just update settings store which syncs to repo
      const result = await saveSettings({
        privacyPolicyAccepted: true,
        appMode: selectedMode,
        ...modeDefaults,
      });

      if (result.success) {
        navigate('/billing', { replace: true });
      } else {
        await alert({
          title: 'Save Failed',
          message: 'Failed to save settings. Please try again.',
          type: 'danger',
        });
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Error during onboarding:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <div className="brand-logo">
            <img src="/icon.ico" alt="SmartKhata Logo" />
          </div>
          <h1>Welcome to SmartKhata</h1>
          <p>The Pro POS for your business</p>
        </div>

        <div className="onboarding-body">
          {step === 1 ? (
            <div className="mode-selection animate-fade-in">
              <h3>Select Your Business Type</h3>
              <p>Choose the mode that best fits your operations.</p>

              <div className="mode-options">
                <div
                  className={`mode-card ${selectedMode === 'GENERAL' ? 'active' : ''}`}
                  onClick={() => setSelectedMode('GENERAL')}
                >
                  <div className="mode-icon">🏪</div>
                  <h4>Retail / General</h4>
                  <p>Standard billing for any retail shop.</p>
                </div>
                <div
                  className={`mode-card ${selectedMode === 'MEDICAL' ? 'active' : ''}`}
                  onClick={() => setSelectedMode('MEDICAL')}
                >
                  <div className="mode-icon">💊</div>
                  <h4>Medical Store</h4>
                  <p>Pharma features: Batch, Expiry, and Salt Search.</p>
                </div>
                <div
                  className={`mode-card ${selectedMode === 'KIRANA' ? 'active' : ''}`}
                  onClick={() => setSelectedMode('KIRANA')}
                >
                  <div className="mode-icon">🌾</div>
                  <h4>Kirana / Grocery</h4>
                  <p>Grocery features: Weights and Quick-pick items.</p>
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ marginTop: '2rem', width: '100%' }}
                onClick={() => setStep(2)}
              >
                Continue with{' '}
                {selectedMode === 'GENERAL'
                  ? 'General'
                  : selectedMode === 'MEDICAL'
                    ? 'Medical'
                    : 'Kirana'}
              </button>
            </div>
          ) : (
            <div className="privacy-step animate-fade-in">
              <p className="intro-text">
                Please review and accept our Privacy Policy to finish setup.
              </p>

              <div className="policy-viewer">
                <PrivacyPolicy
                  showTitle={false}
                  maxHeight="300px"
                  onScrollBottom={() => setHasReadToBottom(true)}
                />
              </div>

              {!hasReadToBottom && (
                <div className="scroll-hint">
                  <span>Scroll to the bottom to continue</span>
                </div>
              )}

              <div
                className="step-actions"
                style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}
              >
                <button
                  className="btn btn-secondary"
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                >
                  Back
                </button>
                <button
                  className={`btn btn-primary accept-btn ${!hasReadToBottom || isSubmitting ? 'disabled' : ''}`}
                  disabled={!hasReadToBottom || isSubmitting}
                  onClick={handleAccept}
                  style={{ flex: 1 }}
                >
                  {isSubmitting ? 'Starting...' : 'Complete Setup'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
