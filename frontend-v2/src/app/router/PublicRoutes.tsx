import { Route } from 'react-router-dom';
import { LegalPage } from '@/app/pages/LegalPage';
import { LoginPage } from '@/app/pages/LoginPage';
import { PricingPage } from '@/app/pages/PricingPage';
import { ActivateAccountPage } from '@/portal/pages/ActivateAccountPage';
import { CompleteProfilePage } from '@/portal/pages/CompleteProfilePage';
import { HomePage } from '@/app/pages/public/HomePage';
import { AboutPage } from '@/app/pages/public/AboutPage';
import { FacilitiesPage } from '@/app/pages/public/FacilitiesPage';
import { RoomsPage } from '@/app/pages/public/RoomsPage';
import { GalleryPage } from '@/app/pages/public/GalleryPage';
import { LocationPage } from '@/app/pages/public/LocationPage';
import { ContactPage } from '@/app/pages/public/ContactPage';
import { RulesPage } from '@/app/pages/public/RulesPage';

export function PublicRoutes() {
  return (
    <>
      {/* ── Public hostel landing pages (SEO crawlable) ──────────────── */}
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/facilities" element={<FacilitiesPage />} />
      <Route path="/rooms" element={<RoomsPage />} />
      <Route path="/gallery" element={<GalleryPage />} />
      <Route path="/location" element={<LocationPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/rules" element={<RulesPage />} />

      {/* ── Auth & utility ───────────────────────────────────────────── */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/activate" element={<ActivateAccountPage />} />
      <Route path="/activate/:token" element={<ActivateAccountPage />} />
      <Route path="/complete-profile" element={<CompleteProfilePage />} />
      <Route path="/legal" element={<LegalPage />} />
      <Route path="/terms" element={<LegalPage />} />
      <Route path="/privacy" element={<LegalPage />} />
      <Route path="/pricing" element={<PricingPage />} />
    </>
  );
}
