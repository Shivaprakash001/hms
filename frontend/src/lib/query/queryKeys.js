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

export const queryKeys = {
  // ── Auth / session ──────────────────────────────────────────────────────────
  me: () => ['me'],

  // ── Notifications ───────────────────────────────────────────────────────────
  notifications: () => ['notifications'],

  // ── Analytics (owner dashboard) ─────────────────────────────────────────────
  analytics: {
    all:        ()       => ['analytics'],
    cashflow:   (range)  => range ? ['analytics', 'cashflow', range]   : ['analytics', 'cashflow'],
    tenants:    (range)  => range ? ['analytics', 'tenants',  range]   : ['analytics', 'tenants'],
    funnel:     (range)  => range ? ['analytics', 'funnel',   range]   : ['analytics', 'funnel'],
    operations: (range)  => range ? ['analytics', 'operations', range] : ['analytics', 'operations'],
  },

  // ── Dashboard (legacy stats endpoints) ──────────────────────────────────────
  dashboard: {
    all:     ()       => ['dashboard'],
    stats:   ()       => ['dashboard', 'stats'],
    summary: ()       => ['dashboard', 'summary'],
    monthly: (months) => ['dashboard', 'monthly', months ?? 6],
  },

  // ── Tenants ─────────────────────────────────────────────────────────────────
  tenants: {
    all:            ()         => ['tenants'],
    list:           (filters)  => ['tenants', 'list', filters ?? {}],
    detail:         (id)       => ['tenants', 'detail', id],
    documents:      (id)       => ['tenants', id, 'documents'],
    paymentHistory: (id)       => ['tenants', id, 'payments'],
  },

  // ── Rooms ───────────────────────────────────────────────────────────────────
  rooms: {
    all:    ()       => ['rooms'],
    list:   (params) => ['rooms', 'list', params ?? {}],
    detail: (id)     => ['rooms', 'detail', id],
  },

  // ── Allocations ─────────────────────────────────────────────────────────────
  allocations: {
    all:    () => ['allocations'],
    active: () => ['allocations', 'active'],
  },

  // ── Payments ────────────────────────────────────────────────────────────────
  payments: {
    all:                () => ['payments'],
    ledger:     (params) => ['payments', 'ledger', params ?? {}],
    dues:       (params) => ['payments', 'dues',   params ?? {}],
    pendingVerification: () => ['payments', 'pending-verification'],
    attempt:       (id)  => ['payments', 'attempt', id],
  },

  // ── Expenses ─────────────────────────────────────────────────────────────────
  expenses: {
    all:  () => ['expenses'],
    list: () => ['expenses', 'list'],
  },

  // ── Addon / usage ────────────────────────────────────────────────────────────
  addon: {
    all:   () => ['addon'],
    usage: () => ['addon', 'usage'],
  },

  // ── Subscription ─────────────────────────────────────────────────────────────
  subscription: {
    all:     () => ['subscription'],
    current: () => ['subscription', 'current'],
  },

  // ── Activity ─────────────────────────────────────────────────────────────────
  activity: {
    all:  ()       => ['activity'],
    list: (params) => ['activity', 'list', params ?? {}],
  },
};
