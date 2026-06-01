import { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Outlet, Route } from 'react-router-dom';
import { queryClient } from '@lib/queryClient';

const HomePage = lazy(() => import('@/app/pages/public/HomePage').then((m) => ({ default: m.HomePage })));
const AboutPage = lazy(() => import('@/app/pages/public/AboutPage').then((m) => ({ default: m.AboutPage })));
const FacilitiesPage = lazy(() => import('@/app/pages/public/FacilitiesPage').then((m) => ({ default: m.FacilitiesPage })));
const RoomsPage = lazy(() => import('@/app/pages/public/RoomsPage').then((m) => ({ default: m.RoomsPage })));
const GalleryPage = lazy(() => import('@/app/pages/public/GalleryPage').then((m) => ({ default: m.GalleryPage })));
const LocationPage = lazy(() => import('@/app/pages/public/LocationPage').then((m) => ({ default: m.LocationPage })));
const ContactPage = lazy(() => import('@/app/pages/public/ContactPage').then((m) => ({ default: m.ContactPage })));
const RulesPage = lazy(() => import('@/app/pages/public/RulesPage').then((m) => ({ default: m.RulesPage })));
const LegalPage = lazy(() => import('@/app/pages/LegalPage').then((m) => ({ default: m.LegalPage })));
const PricingPage = lazy(() => import('@/app/pages/PricingPage').then((m) => ({ default: m.PricingPage })));
const VisitPage = lazy(() => import('@/app/pages/public/VisitPage').then((m) => ({ default: m.VisitPage })));
const LoginPage = lazy(() => import('@/app/pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() => import('@/app/pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/app/pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const ActivateAccountPage = lazy(() => import('@/portal/pages/ActivateAccountPage').then((m) => ({ default: m.ActivateAccountPage })));
const CompleteProfilePage = lazy(() => import('@/portal/pages/CompleteProfilePage').then((m) => ({ default: m.CompleteProfilePage })));
const AuthRouteShell = lazy(() => import('@/app/providers/AuthRouteShell').then((m) => ({ default: m.AuthRouteShell })));

function PublicRouteFallback() {
  return <div className="min-h-screen bg-slate-50" />;
}

function PublicShell() {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<PublicRouteFallback />}>
        <Outlet />
      </Suspense>
    </QueryClientProvider>
  );
}

function AuthShell() {
  return (
    <Suspense fallback={<PublicRouteFallback />}>
      <AuthRouteShell />
    </Suspense>
  );
}

export function PublicRoutes() {
  return (
    <>
      {/* ── Public hostel landing pages (SEO crawlable) ──────────────── */}
      <Route element={<PublicShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/facilities" element={<FacilitiesPage />} />
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/location" element={<LocationPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/legal" element={<LegalPage />} />
        <Route path="/terms" element={<LegalPage />} />
        <Route path="/privacy" element={<LegalPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/visit/:hostelSlug" element={<VisitPage />} />
      </Route>

      {/* ── Auth & utility ───────────────────────────────────────────── */}
      <Route element={<AuthShell />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/activate" element={<ActivateAccountPage />} />
        <Route path="/activate/:token" element={<ActivateAccountPage />} />
        <Route path="/complete-profile" element={<CompleteProfilePage />} />
      </Route>
    </>
  );
}
