import { StrictMode, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppPreferencesProvider } from './context/AppPreferencesContext';
import ProtectedTenantRoute from './components/ProtectedTenantRoute';
import ProtectedOwnerRoute from './components/ProtectedOwnerRoute';

// ── Critical path — loaded eagerly (auth shell, layouts) ─────────────────────
import Login from './pages/auth/Login.jsx';
import OwnerLayout from './layouts/OwnerLayout.jsx';
import TenantLayout from './layouts/TenantLayout.jsx';

// ── Auth pages — small, low priority ─────────────────────────────────────────
const Register        = lazy(() => import('./pages/auth/Register.jsx'));
const ActivateAccount = lazy(() => import('./pages/auth/ActivateAccount.jsx'));
const CompleteProfile = lazy(() => import('./pages/auth/CompleteProfile.jsx'));
const GoogleCallback  = lazy(() => import('./pages/auth/GoogleCallback.jsx').then(m => ({ default: m.GoogleCallback })));

// ── Owner pages — code-split per route ───────────────────────────────────────
const OwnerDashboard    = lazy(() => import('./pages/owner/OwnerDashboard.jsx'));
const ManageTenants     = lazy(() => import('./pages/owner/ManageTenants.jsx'));
const ManageRooms       = lazy(() => import('./pages/owner/ManageRooms.jsx'));
const Payments          = lazy(() => import('./pages/owner/Payments.jsx'));
const Expenses          = lazy(() => import('./pages/owner/Expenses.jsx'));
const ActivityHistory   = lazy(() => import('./pages/owner/ActivityHistory.jsx'));
const BillingPlans      = lazy(() => import('./pages/owner/BillingPlans.jsx'));
const OwnerProfile      = lazy(() => import('./pages/owner/OwnerProfile.jsx'));
const TenantProfilePage = lazy(() => import('./pages/owner/TenantProfilePage.jsx'));

// ── Tenant pages — code-split per route ──────────────────────────────────────
const TenantDashboard     = lazy(() => import('./pages/tenant/TenantDashboard.jsx'));
const TenantPayments      = lazy(() => import('./pages/tenant/TenantPayments.jsx'));
const TenantPaymentReturn = lazy(() => import('./pages/tenant/TenantPaymentReturn.jsx'));
const TenantProfile       = lazy(() => import('./pages/tenant/TenantProfile.jsx'));
const TenantSettings      = lazy(() => import('./pages/tenant/TenantSettings.jsx'));

// Minimal inline fallback — no extra component needed
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-50">
    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

function App() {
  return (
    <AuthProvider>
      <AppPreferencesProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/activate" element={<ActivateAccount />} />
            <Route path="/complete-profile" element={<CompleteProfile />} />
            <Route path="/tenant/complete-profile" element={<Navigate to="/complete-profile" replace />} />
            <Route path="/callback" element={<GoogleCallback />} />
            <Route path="/payment-return" element={<TenantPaymentReturn />} />

            {/* Tenant Routes */}
            <Route element={<ProtectedTenantRoute />}>
              <Route path="/tenant" element={<TenantLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<TenantDashboard />} />
                <Route path="payments" element={<TenantPayments />} />
                <Route path="payment-return" element={<TenantPaymentReturn />} />
                <Route path="profile" element={<TenantProfile />} />
                <Route path="settings" element={<TenantSettings />} />
              </Route>
            </Route>

            {/* Owner Routes */}
            <Route element={<ProtectedOwnerRoute />}>
              <Route path="/owner" element={<OwnerLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard"  element={<OwnerDashboard />} />
                <Route path="tenants"    element={<ManageTenants />} />
                <Route path="tenants/:id" element={<TenantProfilePage />} />
                <Route path="rooms"      element={<ManageRooms />} />
                <Route path="payments"   element={<Payments />} />
                <Route path="expenses"   element={<Expenses />} />
                <Route path="activities" element={<ActivityHistory />} />
                <Route path="activity"   element={<Navigate to="/owner/activities" replace />} />
                <Route path="billing"    element={<BillingPlans />} />
                <Route path="profile"    element={<OwnerProfile />} />
              </Route>
            </Route>

            {/* Global Redirects */}
            <Route path="/dashboard" element={<Navigate to="/owner/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AppPreferencesProvider>
    </AuthProvider>
  );
}

export default App;
