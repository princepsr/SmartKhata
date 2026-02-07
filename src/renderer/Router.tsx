import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import BillingPage from './pages/BillingPage';
import ProductsPage from './pages/ProductsPage';
import CustomersPage from './pages/CustomersPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

/**
 * App Router
 * 
 * Defines all routes for the SmartKhata POS application.
 * Uses React Router with BrowserRouter for client-side routing.
 * Wrapped with ErrorBoundary to catch component errors.
 */

function AppRouter() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            {/* Default route - redirect to billing */}
            <Route index element={<Navigate to="/billing" replace />} />
            
            {/* Main routes */}
            <Route path="billing" element={<BillingPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="reports" element={<ReportsPage />} />
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
