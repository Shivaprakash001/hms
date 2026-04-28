import { StrictMode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import ActivateAccount from './pages/auth/ActivateAccount.jsx';
import CompleteProfile from './pages/auth/CompleteProfile.jsx';
import { GoogleCallback } from './pages/auth/GoogleCallback.jsx';
import OwnerLayout from './layouts/OwnerLayout.jsx';
import OwnerDashboard from './pages/owner/OwnerDashboard.jsx';
import ManageTenants from './pages/owner/ManageTenants.jsx';
import ManageRooms from './pages/owner/ManageRooms.jsx';
import Payments from './pages/owner/Payments.jsx';
import Complaints from './pages/owner/Complaints.jsx';
import Expenses from './pages/owner/Expenses.jsx';
import ActivityHistory from './pages/owner/ActivityHistory.jsx';
import BillingPlans from './pages/owner/BillingPlans.jsx';
import OwnerProfile from './pages/owner/OwnerProfile.jsx';
import StudentProfilePage from './pages/owner/StudentProfilePage.jsx';

// Tenant Imports

import StudentLayout from './layouts/StudentLayout.jsx';
import StudentDashboard from './pages/tenant/StudentDashboard.jsx';
import StudentPayments from './pages/tenant/StudentPayments.jsx';
import StudentPaymentReturn from './pages/tenant/StudentPaymentReturn.jsx';
import StudentComplaints from './pages/tenant/StudentComplaints.jsx';
import StudentProfile from './pages/tenant/StudentProfile.jsx';
import StudentSettings from './pages/tenant/StudentSettings.jsx';
import { AuthProvider } from './context/AuthContext';
import ProtectedStudentRoute from './components/ProtectedStudentRoute';
import ProtectedOwnerRoute from './components/ProtectedOwnerRoute';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
            <Route path="/activate" element={<ActivateAccount />} />
          <Route path="/complete-profile" element={<CompleteProfile />} />
            <Route path="/tenant/complete-profile" element={<Navigate to="/complete-profile" replace />} />
          <Route path="/callback" element={<GoogleCallback />} />
            <Route path="/payment-return" element={<StudentPaymentReturn />} />

        {/* Tenant Routes */}

        <Route element={<ProtectedStudentRoute />}>
            <Route path="/tenant" element={<StudentLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<StudentDashboard />} />
                <Route path="payments" element={<StudentPayments />} />
                <Route path="payment-return" element={<StudentPaymentReturn />} />
                <Route path="complaints" element={<StudentComplaints />} />
            <Route path="profile" element={<StudentProfile />} />
            <Route path="settings" element={<StudentSettings />} />
          </Route>
        </Route>

        {/* Owner Routes */}
        <Route element={<ProtectedOwnerRoute />}>
          <Route path="/owner" element={<OwnerLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<OwnerDashboard />} />
            <Route path="tenants" element={<ManageTenants />} />
            <Route path="tenants/:id" element={<StudentProfilePage />} />
            <Route path="rooms" element={<ManageRooms />} />
            <Route path="payments" element={<Payments />} />
            <Route path="complaints" element={<Complaints />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="activities" element={<ActivityHistory />} />
            <Route path="activity" element={<Navigate to="/owner/activities" replace />} />
            <Route path="billing" element={<BillingPlans />} />
            <Route path="profile" element={<OwnerProfile />} />
          </Route>
        </Route>
        {/* Global Redirects */}
        <Route path="/dashboard" element={<Navigate to="/owner/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App
