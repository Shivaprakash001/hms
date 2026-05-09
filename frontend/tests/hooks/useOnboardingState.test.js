import { describe, it, expect, beforeEach } from 'vitest';
import { getStoredStep, setStoredStep, clearOnboardingState } from '../../src/hooks/useOnboardingState';

describe('onboarding localStorage scoping', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('partitions onboarding progress by owner id', () => {
    localStorage.setItem('ownerUser', JSON.stringify({ id: 'owner-a', owner_id: 'owner-a', role: 'owner' }));
    setStoredStep('BILLING_CONFIGURED');

    localStorage.setItem('ownerUser', JSON.stringify({ id: 'owner-b', owner_id: 'owner-b', role: 'owner' }));
    expect(getStoredStep()).toBe('ACCOUNT_CREATED');
    setStoredStep('FIRST_ROOM_ADDED');

    localStorage.setItem('ownerUser', JSON.stringify({ id: 'owner-a', owner_id: 'owner-a', role: 'owner' }));
    expect(getStoredStep()).toBe('BILLING_CONFIGURED');

    localStorage.setItem('ownerUser', JSON.stringify({ id: 'owner-b', owner_id: 'owner-b', role: 'owner' }));
    expect(getStoredStep()).toBe('FIRST_ROOM_ADDED');
  });

  it('clears only the active owner onboarding key plus the legacy key', () => {
    localStorage.setItem('ownerUser', JSON.stringify({ id: 'owner-a', owner_id: 'owner-a', role: 'owner' }));
    setStoredStep('BILLING_CONFIGURED');
    localStorage.setItem('hms_onboarding_step:owner-b', 'FIRST_ROOM_ADDED');
    localStorage.setItem('hms_onboarding_step', 'COMPLETED');

    clearOnboardingState();

    expect(localStorage.getItem('hms_onboarding_step:owner-a')).toBeNull();
    expect(localStorage.getItem('hms_onboarding_step')).toBeNull();
    expect(localStorage.getItem('hms_onboarding_step:owner-b')).toBe('FIRST_ROOM_ADDED');
  });
});
