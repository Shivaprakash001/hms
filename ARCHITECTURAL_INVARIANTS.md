# HMS Architectural Invariants

This document is the constitution for HMS multi-hostel stabilization. Any change
that violates these rules must be rejected, even if it appears to work locally.

## Operational Scope

- Every operational read and write must require an explicit `hostelId`.
- Operational routes, hooks, services, cache keys, events, locks, and snapshots
  must be hostel-scoped.
- Operational code must not infer a hostel from owner state, browser storage, or
  "first hostel" fallback behavior.
- Owner-wide aggregation is allowed only in the portfolio layer.

Operational domains include dashboard, rooms, tenants, allocations, payments,
rent obligations, receipts, expenses, reminders, notifications, analytics, and
rent generation.

## Frontend Scope

- The URL is the only source of truth for the active operational hostel.
- Operational pages must use `/hostels/:hostelId/...`.
- React Query keys for operational data must start with
  `['hostel', hostelId, ...]`.
- Browser storage must not hold active operational hostel context.
- Legacy `/owner/dashboard`, `/owner/rooms`, `/owner/tenants`,
  `/owner/payments`, `/owner/expenses`, and `/owner/activities` paths may only
  redirect to a concrete hostel URL.

## Backend Scope

- Operational APIs must reject missing hostel context with
  `HOSTEL_CONTEXT_REQUIRED`.
- Operational service signatures must require `hostelId`.
- No operational financial calculation may mix hostels.
- Reconciliation and rent generation must run per hostel.
- Cross-hostel references must be rejected by service logic and database
  constraints.

## Cache, Events, And Snapshots

- Cache invalidation must target one hostel unless explicitly invalidating
  portfolio data.
- Realtime events must include `scope: 'hostel'` and `hostelId`, or
  `scope: 'portfolio'` and `ownerId`.
- Operational snapshots are `HostelDailySnapshot`.
- Portfolio snapshots aggregate hostel snapshots only; they must not scan raw
  transactional tables.

## Freeze Policy

Until hostel isolation is complete, do not add AI features, new analytics,
automation upgrades, advanced billing, or portfolio intelligence beyond the
stabilization work described here.
