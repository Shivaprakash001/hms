import { StrictMode, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppPreferencesProvider } from './context/AppPreferencesContext';
import ProtectedTenantRoute from './components/ProtectedTenantRoute';
import ProtectedOwnerRoute from './components/ProtectedOwnerRoute';

// ── Critical path — loaded eagerly (auth shell, layouts) ─────────────────────
import Login from './pages/auth/Login.jsx';
import Legal from './pages/Legal.jsx';
import OwnerLayout from './layouts/OwnerLayout.jsx';
import TenantLayout from './layouts/TenantLayout.jsx';
import { HostelContextProvider, LegacyOwnerOperationalRedirect } from './context/HostelContext.jsx';

// ── Auth pages — small, low priority ─────────────────────────────────────────
const Register        = lazy(() => import('./pages/auth/Register.jsx'));
const ActivateAccount = lazy(() => import('./pages/auth/ActivateAccount.jsx'));
const CompleteProfile = lazy(() => import('./pages/auth/CompleteProfile.jsx'));
const GoogleCallback  = lazy(() => import('./pages/auth/GoogleCallback.jsx').then(m => ({ default: m.GoogleCallback })));

// ── Onboarding — new owner activation flow ────────────────────────────────────
const OnboardingShell    = lazy(() => import('./pages/onboarding/OnboardingShell.jsx'));
const OnboardingWelcome  = lazy(() => import('./pages/onboarding/OnboardingWelcome.jsx'));
const OnboardingPlans    = lazy(() => import('./pages/onboarding/OnboardingPlans.jsx'));
const OnboardingHostel   = lazy(() => import('./pages/onboarding/OnboardingHostel.jsx'));
const OnboardingBilling  = lazy(() => import('./pages/onboarding/OnboardingBilling.jsx'));
const OnboardingRooms    = lazy(() => import('./pages/onboarding/OnboardingRooms.jsx'));
const OnboardingTenant   = lazy(() => import('./pages/onboarding/OnboardingTenant.jsx'));
const OnboardingPayments = lazy(() => import('./pages/onboarding/OnboardingPayments.jsx'));
const OnboardingDone     = lazy(() => import('./pages/onboarding/OnboardingDone.jsx'));
const OnboardingChecklist = lazy(() => import('./pages/onboarding/OnboardingChecklist.jsx'));

// ── Owner pages — code-split per route ───────────────────────────────────────
const OwnerDashboard    = lazy(() => import('./pages/owner/OwnerDashboard.jsx'));
const ManageTenants     = lazy(() => import('./pages/owner/ManageTenants.jsx'));
const ManageRooms       = lazy(() => import('./pages/owner/ManageRooms.jsx'));
const Payments          = lazy(() => import('./pages/owner/Payments.jsx'));
const Expenses          = lazy(() => import('./pages/owner/Expenses.jsx'));
const ActivityHistory   = lazy(() => import('./pages/owner/ActivityHistory.jsx'));
const BillingPlans      = lazy(() => import('./pages/owner/BillingPlans.jsx'));
const OwnerProfile      = lazy(() => import('./pages/owner/settings/OwnerSettings.jsx'));
const Portfolio         = lazy(() => import('./pages/owner/Portfolio.jsx'));
const TenantProfilePage = lazy(() => import('./pages/owner/TenantProfilePage.jsx'));
const BulkImport        = lazy(() => import('./pages/owner/BulkImport.jsx'));
const BulkImportConfirm = lazy(() => import('./pages/owner/BulkImportConfirm.jsx'));

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
            <Route path="/legal" element={<Legal />} />
            <Route path="/register" element={<Register />} />
            <Route path="/activate" element={<ActivateAccount />} />
            <Route path="/complete-profile" element={<CompleteProfile />} />
            <Route path="/tenant/complete-profile" element={<Navigate to="/complete-profile" replace />} />
            <Route path="/callback" element={<GoogleCallback />} />
            <Route path="/payment-return" element={<TenantPaymentReturn />} />

            {/* Onboarding Routes — new owner setup flow */}
            <Route path="/onboarding" element={<OnboardingShell />}>
              <Route index element={<Navigate to="welcome" replace />} />
              <Route path="welcome"  element={<OnboardingWelcome />} />
              <Route path="plans"    element={<OnboardingPlans />} />
              <Route path="hostel"   element={<OnboardingHostel />} />
              <Route path="checklist" element={<OnboardingChecklist />} />
              <Route path="billing"  element={<OnboardingBilling />} />
              <Route path="rooms"    element={<OnboardingRooms />} />
              <Route path="tenant"   element={<OnboardingTenant />} />
              <Route path="payments" element={<OnboardingPayments />} />
              <Route path="done"     element={<OnboardingDone />} />
            </Route>

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
                <Route index element={<Navigate to="portfolio" replace />} />
                <Route path="dashboard"  element={<LegacyOwnerOperationalRedirect />} />
                <Route path="tenants"    element={<LegacyOwnerOperationalRedirect />} />
                <Route path="tenants/:id" element={<LegacyOwnerOperationalRedirect />} />
                <Route path="rooms"      element={<LegacyOwnerOperationalRedirect />} />
                <Route path="payments"   element={<LegacyOwnerOperationalRedirect />} />
                <Route path="expenses"   element={<LegacyOwnerOperationalRedirect />} />
                <Route path="activities" element={<LegacyOwnerOperationalRedirect />} />
                <Route path="activity"   element={<LegacyOwnerOperationalRedirect />} />
                <Route path="billing"    element={<BillingPlans />} />
                <Route path="profile"    element={<OwnerProfile />} />
                <Route path="portfolio"  element={<Portfolio />} />
              </Route>

              <Route path="/hostels/:hostelId" element={<HostelContextProvider><OwnerLayout /></HostelContextProvider>}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard"  element={<OwnerDashboard />} />
                <Route path="tenants"    element={<ManageTenants />} />
                <Route path="tenants/:id" element={<TenantProfilePage />} />
                <Route path="bulk-import" element={<BulkImport />} />
                <Route path="bulk-import/:batchId/confirm" element={<BulkImportConfirm />} />
                <Route path="rooms"      element={<ManageRooms />} />
                <Route path="payments"   element={<Payments />} />
                <Route path="expenses"   element={<Expenses />} />
                <Route path="activities" element={<ActivityHistory />} />
                <Route path="activity"   element={<Navigate to="activities" replace />} />
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
