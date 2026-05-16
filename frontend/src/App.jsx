import { StrictMode, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppPreferencesProvider } from './context/AppPreferencesContext';
import ProtectedTenantRoute from './components/ProtectedTenantRoute';
import ProtectedOwnerRoute from './components/ProtectedOwnerRoute';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';

// ── Critical path — loaded eagerly (auth shell, layouts) ─────────────────────
import Login from './pages/auth/Login.jsx';
import Legal from './pages/Legal.jsx';
import PortfolioLayout from './layouts/PortfolioLayout.jsx';
import HostelWorkspaceLayout from './layouts/HostelWorkspaceLayout.jsx';
import TenantLayout from './layouts/TenantLayout.jsx';
import { HostelContextProvider } from './context/HostelContext.jsx';

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
const OnboardingAutomation = lazy(() => import('./pages/onboarding/OnboardingAutomation.jsx'));
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
const MoveOutManagement = lazy(() => import('./pages/owner/MoveOutManagement.jsx'));
const OwnerFinance          = lazy(() => import('./pages/owner/OwnerFinance.jsx'));
const OwnerFinanceTransfers = lazy(() => import('./pages/owner/OwnerFinanceTransfers.jsx'));

// ── Admin pages ──────────────────────────────────────────────────────────────
const AdminReconciliation   = lazy(() => import('./pages/admin/AdminReconciliation.jsx'));

// ── Tenant pages — code-split per route ──────────────────────────────────────
const TenantDashboard     = lazy(() => import('./pages/tenant/TenantDashboard.jsx'));
const TenantPayments      = lazy(() => import('./pages/tenant/TenantPayments.jsx'));
const TenantPaymentReturn = lazy(() => import('./pages/tenant/TenantPaymentReturn.jsx'));
const TenantProfile       = lazy(() => import('./pages/tenant/TenantProfile.jsx'));
const TenantSettings      = lazy(() => import('./pages/tenant/TenantSettings.jsx'));
const TenantMoveOut       = lazy(() => import('./pages/tenant/TenantMoveOut.jsx'));

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
              <Route path="automation" element={<OnboardingAutomation />} />
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
                <Route path="move-out" element={<TenantMoveOut />} />
              </Route>
            </Route>

            {/* Owner Routes */}
            <Route element={<ProtectedOwnerRoute />}>
              {/* Portfolio Dashboard Mode */}
              <Route path="/dashboard" element={<PortfolioLayout />}>
                <Route index element={<Portfolio />} />
                <Route path="billing" element={<BillingPlans />} />
                <Route path="profile" element={<OwnerProfile />} />
                <Route path="finance" element={<OwnerFinance />} />
                <Route path="finance/transfers" element={<OwnerFinanceTransfers />} />
              </Route>

              {/* Hostel Workspace Mode */}
              <Route path="/dashboard/:hostelId" element={<HostelContextProvider><HostelWorkspaceLayout /></HostelContextProvider>}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview"   element={<OwnerDashboard />} />
                <Route path="tenants"    element={<ManageTenants />} />
                <Route path="tenants/:id" element={<TenantProfilePage />} />
                <Route path="bulk-import" element={<BulkImport />} />
                <Route path="bulk-import/:batchId/confirm" element={<BulkImportConfirm />} />
                <Route path="rooms"      element={<ManageRooms />} />
                <Route path="financials" element={<Payments />} />
                <Route path="expenses"   element={<Expenses />} />
                <Route path="activities" element={<ActivityHistory />} />
                <Route path="activity-log/*" element={<Navigate to="../activities" replace />} />
                <Route path="move-outs"  element={<MoveOutManagement />} />
                <Route path="settings"   element={<OwnerProfile />} />
                <Route path="*"          element={<Navigate to="overview" replace />} />
              </Route>
            </Route>

            {/* Admin Routes */}
            <Route element={<ProtectedAdminRoute />}>
              <Route path="/admin/reconciliation" element={<AdminReconciliation />} />
            </Route>

            {/* Global Redirects */}
            <Route path="/owner/*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AppPreferencesProvider>
    </AuthProvider>
  );
}

export default App;
