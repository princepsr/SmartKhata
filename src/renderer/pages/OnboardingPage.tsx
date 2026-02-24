import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSettingsStore } from '../store/useAppSettingsStore';
import { PrivacyPolicy } from '../components/Settings/PrivacyPolicy';
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
      const result = await saveSettings({ privacyPolicyAccepted: true });
      if (result.success) {
        navigate('/billing', { replace: true });
      } else {
        alert('Failed to save settings. Please try again.');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Error accepting privacy policy:', error);
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
          <p>Your local-first Kirana POS solution</p>
        </div>

        <div className="onboarding-body">
          <p className="intro-text">
            Before we begin, please review and accept our Privacy Policy to ensure you understand
            how we protect your business data.
          </p>

          <div className="policy-viewer">
            <PrivacyPolicy
              showTitle={false}
              maxHeight="350px"
              onScrollBottom={() => setHasReadToBottom(true)}
            />
          </div>

          {!hasReadToBottom && (
            <div className="scroll-hint">
              <span>Scroll to the bottom to continue</span>
            </div>
          )}
        </div>

        <div className="onboarding-footer">
          <button
            className={`btn btn-primary accept-btn ${!hasReadToBottom || isSubmitting ? 'disabled' : ''}`}
            disabled={!hasReadToBottom || isSubmitting}
            onClick={handleAccept}
          >
            {isSubmitting ? 'Saving...' : 'Accept & Continue'}
          </button>
          <p className="footer-note">
            By clicking "Accept & Continue", you agree to the conditions stated above.
          </p>
        </div>
      </div>
    </div>
  );
}
