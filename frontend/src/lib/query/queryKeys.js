/**
 * Centralized React Query key factory.
 *
 * Rules:
 *  - Every key is a function — even zero-arg ones. This lets you call
 *    invalidateQueries(queryKeys.analytics.all()) to wipe the whole namespace
 *    and queryKeys.analytics.cashflow() to hit only that slice.
 *  - List vs detail are namespaced separately ('list' / 'detail') so
 *    invalidateQueries(['tenants']) invalidates ALL tenant queries as intended,
 *    but setQueryData(['tenants', 'detail', id], …) never hits a list query.
 *  - Params/filters are always the last element so partial-key invalidation
 *    still works (e.g., invalidate all ['payments', 'dues'] regardless of filter).
 */

const readStoredSession = () => {
  if (typeof window === 'undefined') return null;
  try {
    const owner = window.localStorage.getItem('ownerUser');
    const tenant = window.localStorage.getItem('tenantUser');
    return owner ? JSON.parse(owner) : (tenant ? JSON.parse(tenant) : null);
  } catch {
    return null;
  }
};

const scope = () => {
  const user = readStoredSession();
  const ownerId = user?.owner_id || (user?.role === 'owner' ? user?.id : null) || 'anonymous';
  const hostelId = user?.hostel_id || 'all-hostels';
  return ['scope', ownerId, hostelId];
};

const key = (...parts) => [...scope(), ...parts];

export const queryKeys = {
  // ── Auth / session ──────────────────────────────────────────────────────────
  me: () => key('me'),

  // ── Notifications ───────────────────────────────────────────────────────────
  notifications: () => key('notifications'),

  // ── Analytics (owner dashboard) ─────────────────────────────────────────────
  analytics: {
    all:        ()       => key('analytics'),
    cashflow:   (range)  => range ? key('analytics', 'cashflow', range)   : key('analytics', 'cashflow'),
    tenants:    (range)  => range ? key('analytics', 'tenants',  range)   : key('analytics', 'tenants'),
    funnel:     (range)  => range ? key('analytics', 'funnel',   range)   : key('analytics', 'funnel'),
    operations: (range)  => range ? key('analytics', 'operations', range) : key('analytics', 'operations'),
  },

  // ── Dashboard (legacy stats endpoints) ──────────────────────────────────────
  dashboard: {
    all:     ()       => key('dashboard'),
    stats:   ()       => key('dashboard', 'stats'),
    summary: ()       => key('dashboard', 'summary'),
    monthly: (months) => key('dashboard', 'monthly', months ?? 6),
  },

  // ── Tenants ─────────────────────────────────────────────────────────────────
  tenants: {
    all:            ()         => key('tenants'),
    list:           (filters)  => key('tenants', 'list', filters ?? {}),
    detail:         (id)       => key('tenants', 'detail', id),
    documents:      (id)       => key('tenants', id, 'documents'),
    paymentHistory: (id)       => key('tenants', id, 'payments'),
  },

  // ── Rooms ───────────────────────────────────────────────────────────────────
  rooms: {
    all:    ()       => key('rooms'),
    list:   (params) => key('rooms', 'list', params ?? {}),
    detail: (id)     => key('rooms', 'detail', id),
  },

  // ── Allocations ─────────────────────────────────────────────────────────────
  allocations: {
    all:    () => key('allocations'),
    active: () => key('allocations', 'active'),
  },

  // ── Payments ────────────────────────────────────────────────────────────────
  payments: {
    all:                () => key('payments'),
    ledger:     (params) => key('payments', 'ledger', params ?? {}),
    dues:       (params) => key('payments', 'dues',   params ?? {}),
    pendingVerification: () => key('payments', 'pending-verification'),
    attempt:       (id)  => key('payments', 'attempt', id),
  },

  // ── Expenses ─────────────────────────────────────────────────────────────────
  expenses: {
    all:  () => key('expenses'),
    list: () => key('expenses', 'list'),
  },

  // ── Addon / usage ────────────────────────────────────────────────────────────
  addon: {
    all:   () => key('addon'),
    usage: () => key('addon', 'usage'),
  },

  // ── Subscription ─────────────────────────────────────────────────────────────
  subscription: {
    all:     () => key('subscription'),
    current: () => key('subscription', 'current'),
    plans:   () => key('subscription', 'plans'),
  },

  // ── Activity ─────────────────────────────────────────────────────────────────
  activity: {
    all:  ()       => key('activity'),
    list: (params) => key('activity', 'list', params ?? {}),
  },
};
