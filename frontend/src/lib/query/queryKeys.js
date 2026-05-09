/**
 * Centralized React Query key factory.
 *
 * Rules:
 *  - Operational keys must receive hostelId explicitly from the URL-driven
 *    HostelContextProvider. Browser storage is not an operational scope source.
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

const ownerScope = () => {
  const user = readStoredSession();
  const ownerId = user?.owner_id || (user?.role === 'owner' ? user?.id : null) || 'anonymous';
  return ['owner', ownerId];
};

const ownerKey = (...parts) => [...ownerScope(), ...parts];
const hostelKey = (hostelId, ...parts) => {
  if (!hostelId) throw new Error('hostelId is required for operational query keys');
  return ['hostel', hostelId, ...parts];
};

export const queryKeys = {
  // ── Auth / session ──────────────────────────────────────────────────────────
  me: () => ownerKey('me'),

  owner: {
    hostels: () => ownerKey('hostels'),
  },

  // ── Notifications ───────────────────────────────────────────────────────────
  notifications: () => ownerKey('notifications'),

  // ── Analytics (owner dashboard) ─────────────────────────────────────────────
  analytics: {
    all:        (hostelId)        => hostelKey(hostelId, 'analytics'),
    cashflow:   (hostelId, range) => range ? hostelKey(hostelId, 'analytics', 'cashflow', range)   : hostelKey(hostelId, 'analytics', 'cashflow'),
    tenants:    (hostelId, range) => range ? hostelKey(hostelId, 'analytics', 'tenants',  range)   : hostelKey(hostelId, 'analytics', 'tenants'),
    funnel:     (hostelId, range) => range ? hostelKey(hostelId, 'analytics', 'funnel',   range)   : hostelKey(hostelId, 'analytics', 'funnel'),
    operations: (hostelId, range) => range ? hostelKey(hostelId, 'analytics', 'operations', range) : hostelKey(hostelId, 'analytics', 'operations'),
  },

  // ── Dashboard (legacy stats endpoints) ──────────────────────────────────────
  dashboard: {
    all:     (hostelId)         => hostelKey(hostelId, 'dashboard'),
    stats:   (hostelId)         => hostelKey(hostelId, 'dashboard', 'stats'),
    summary: (hostelId)         => hostelKey(hostelId, 'dashboard', 'summary'),
    monthly: (hostelId, months) => hostelKey(hostelId, 'dashboard', 'monthly', months ?? 6),
  },

  // ── Tenants ─────────────────────────────────────────────────────────────────
  tenants: {
    all:            (hostelId)          => hostelKey(hostelId, 'tenants'),
    list:           (hostelId, filters) => hostelKey(hostelId, 'tenants', 'list', filters ?? {}),
    detail:         (hostelId, id)      => hostelKey(hostelId, 'tenants', 'detail', id),
    documents:      (hostelId, id)      => hostelKey(hostelId, 'tenants', id, 'documents'),
    paymentHistory: (hostelId, id)      => hostelKey(hostelId, 'tenants', id, 'payments'),
  },

  // ── Rooms ───────────────────────────────────────────────────────────────────
  rooms: {
    all:    (hostelId)         => hostelKey(hostelId, 'rooms'),
    list:   (hostelId, params) => hostelKey(hostelId, 'rooms', 'list', params ?? {}),
    detail: (hostelId, id)     => hostelKey(hostelId, 'rooms', 'detail', id),
  },

  // ── Allocations ─────────────────────────────────────────────────────────────
  allocations: {
    all:    (hostelId) => hostelKey(hostelId, 'allocations'),
    active: (hostelId) => hostelKey(hostelId, 'allocations', 'active'),
  },

  // ── Payments ────────────────────────────────────────────────────────────────
  payments: {
    all:                 (hostelId)         => hostelKey(hostelId, 'payments'),
    ledger:              (hostelId, params) => hostelKey(hostelId, 'payments', 'ledger', params ?? {}),
    dues:                (hostelId, params) => hostelKey(hostelId, 'payments', 'dues',   params ?? {}),
    pendingVerification: (hostelId)         => hostelKey(hostelId, 'payments', 'pending-verification'),
    attempt:             (hostelId, id)     => hostelKey(hostelId, 'payments', 'attempt', id),
  },

  // ── Expenses ─────────────────────────────────────────────────────────────────
  expenses: {
    all:  (hostelId) => hostelKey(hostelId, 'expenses'),
    list: (hostelId) => hostelKey(hostelId, 'expenses', 'list'),
  },

  // ── Addon / usage ────────────────────────────────────────────────────────────
  addon: {
    all:   () => ownerKey('addon'),
    usage: () => ownerKey('addon', 'usage'),
  },

  // ── Subscription ─────────────────────────────────────────────────────────────
  subscription: {
    all:     () => ownerKey('subscription'),
    current: () => ownerKey('subscription', 'current'),
    plans:   () => ownerKey('subscription', 'plans'),
  },

  // ── Activity ─────────────────────────────────────────────────────────────────
  activity: {
    all:  (hostelId)         => hostelKey(hostelId, 'activity'),
    list: (hostelId, params) => hostelKey(hostelId, 'activity', 'list', params ?? {}),
  },
};
