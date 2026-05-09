import { useState, useCallback } from 'react';
import { ownerService, roomService, tenantService } from '../api/services';

// Onboarding steps in order
export const ONBOARDING_STEPS = [
  'ACCOUNT_CREATED',
  'HOSTEL_CREATED',
  'BILLING_CONFIGURED',
  'FIRST_ROOM_ADDED',
  'FIRST_TENANT_ADDED',
  'COLLECTIONS_ENABLED',
  'COMPLETED',
];

const LEGACY_STORAGE_KEY = 'hms_onboarding_step';

const readStoredSession = () => {
  try {
    const owner = localStorage.getItem('ownerUser');
    const tenant = localStorage.getItem('tenantUser');
    return owner ? JSON.parse(owner) : (tenant ? JSON.parse(tenant) : null);
  } catch {
    return null;
  }
};

const storageKey = () => {
  const user = readStoredSession();
  const ownerId = user?.owner_id || (String(user?.role || '').toLowerCase() === 'owner' ? user?.id : null) || 'anonymous';
  return `hms_onboarding_step:${ownerId}`;
};

export const getStoredStep = () => localStorage.getItem(storageKey()) || localStorage.getItem(LEGACY_STORAGE_KEY) || 'ACCOUNT_CREATED';
export const setStoredStep = (step) => {
  localStorage.setItem(storageKey(), step);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
};
export const clearOnboardingState = () => {
  localStorage.removeItem(storageKey());
  localStorage.removeItem(LEGACY_STORAGE_KEY);
};
export const isOnboardingComplete = () => getStoredStep() === 'COMPLETED';

// Derive the furthest completed step from server data
export async function deriveOnboardingStep() {
  try {
    const profile = await ownerService.getProfile();
    const hostel = profile?.hostel;
    if (!hostel?.name) return 'ACCOUNT_CREATED';

    const hasPrefs = hostel?.auto_rent_day || profile?.preferences?.auto_rent_day;
    if (!hasPrefs) return 'HOSTEL_CREATED';

    const rooms = await roomService.getAll({ limit: 1 });
    const roomCount = Array.isArray(rooms) ? rooms.length : rooms?.total ?? 0;
    if (roomCount === 0) return 'BILLING_CONFIGURED';

    const tenants = await tenantService.getAll({ limit: 1, status: 'ACTIVE' });
    const tenantCount = Array.isArray(tenants) ? tenants.length : tenants?.total ?? 0;
    if (tenantCount === 0) return 'FIRST_ROOM_ADDED';

    const hasUpi = hostel?.upi_id;
    if (!hasUpi) return 'FIRST_TENANT_ADDED';

    return 'COMPLETED';
  } catch {
    return getStoredStep();
  }
}

// Map step name → route path
export const STEP_ROUTES = {
  ACCOUNT_CREATED:      '/onboarding/welcome',
  HOSTEL_CREATED:       '/onboarding/billing',
  BILLING_CONFIGURED:   '/onboarding/rooms',
  FIRST_ROOM_ADDED:     '/onboarding/tenant',
  FIRST_TENANT_ADDED:   '/onboarding/payments',
  COLLECTIONS_ENABLED:  '/onboarding/done',
  COMPLETED:            '/owner/dashboard',
};

// Human-readable step labels for progress indicator
export const STEP_LABELS = {
  ACCOUNT_CREATED:      'Account',
  HOSTEL_CREATED:       'Hostel',
  BILLING_CONFIGURED:   'Billing',
  FIRST_ROOM_ADDED:     'Rooms',
  FIRST_TENANT_ADDED:   'Tenants',
  COLLECTIONS_ENABLED:  'Payments',
  COMPLETED:            'Done',
};

export function useOnboardingState() {
  const [step, setStep] = useState(() => getStoredStep());

  const advance = useCallback((nextStep) => {
    setStep(nextStep);
    setStoredStep(nextStep);
  }, []);

  const complete = useCallback(() => {
    setStep('COMPLETED');
    setStoredStep('COMPLETED');
  }, []);

  const stepIndex = ONBOARDING_STEPS.indexOf(step);
  const progress = Math.round((stepIndex / (ONBOARDING_STEPS.length - 1)) * 100);

  return { step, stepIndex, progress, advance, complete };
}
