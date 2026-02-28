import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import BillingPage from './pages/BillingPage';
import ProductsPage from './pages/ProductsPage';
import CustomersPage from './pages/CustomersPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import PurchasesPage from './pages/PurchasesPage';
import OnboardingPage from './pages/OnboardingPage';
import LoadingScreen from './components/common/LoadingScreen';
import { useAppSettingsStore } from './store/useAppSettingsStore';
import { useEffect, useState } from 'react';

/**
 * App Router
 *
 * Defines all routes for the SmartKhata POS application.
 * Uses React Router with BrowserRouter for client-side routing.
 * Wrapped with ErrorBoundary to catch component errors.
 */

function AppRouter() {
  const { settings, fetchSettings, isLoading } = useAppSettingsStore();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    fetchSettings().finally(() => setIsInitialized(true));
  }, [fetchSettings]);

  if (!isInitialized) {
    return <LoadingScreen message="Initializing SmartKhata..." />;
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        {/* Global Loading Overlay (for background updates) */}
        {isLoading && <LoadingScreen message="Saving changes..." />}

        <Routes>
          {/* Onboarding route (always accessible) */}
          <Route path="/onboarding" element={<OnboardingPage />} />

          <Route
            path="/"
            element={
              settings.privacyPolicyAccepted ? <Layout /> : <Navigate to="/onboarding" replace />
            }
          >
            {/* Default route - redirect to billing */}
            <Route index element={<Navigate to="/billing" replace />} />

            {/* Main routes */}
            <Route path="billing" element={<BillingPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="purchases" element={<PurchasesPage />} />
            <Route path="settings" element={<SettingsPage />} />

            {/* 404 - redirect to billing */}
            <Route path="*" element={<Navigate to="/billing" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default AppRouter;
