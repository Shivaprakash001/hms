import { Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { PortfolioView } from './components/views/PortfolioView';
import { HostelsView } from './components/views/HostelsView';
import { AlertsView } from './components/views/AlertsView';
import { BillingView } from './components/views/BillingView';
import { SettingsView } from './components/views/SettingsView';
import { HostelDetailView } from './components/HostelDetailView';

export function AppRouter() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Owner shell — all children need auth */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin']}>
            <App />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<PortfolioView />} />
        <Route path="/hostels" element={<HostelsView />} />
        <Route path="/hostels/:hostelId" element={<HostelDetailView />} />
        <Route path="/hostels/:hostelId/:tab" element={<HostelDetailView />} />
        <Route path="/alerts" element={<AlertsView />} />
        <Route path="/billing" element={<BillingView />} />
        <Route path="/settings" element={<SettingsView />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
