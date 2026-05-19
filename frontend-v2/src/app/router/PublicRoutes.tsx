import { Route } from 'react-router-dom';
import { LegalPage } from '@/app/pages/LegalPage';
import { LoginPage } from '@/app/pages/LoginPage';
import { PricingPage } from '@/app/pages/PricingPage';
import { ActivateAccountPage } from '@/portal/pages/ActivateAccountPage';
import { CompleteProfilePage } from '@/portal/pages/CompleteProfilePage';

export function PublicRoutes() {
  return (
    <>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/activate" element={<ActivateAccountPage />} />
      <Route path="/complete-profile" element={<CompleteProfilePage />} />
      <Route path="/legal" element={<LegalPage />} />
      <Route path="/terms" element={<LegalPage />} />
      <Route path="/privacy" element={<LegalPage />} />
      <Route path="/pricing" element={<PricingPage />} />
    </>
  );
}
