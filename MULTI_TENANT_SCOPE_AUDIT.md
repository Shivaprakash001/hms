# HMS Multi-Tenant Scope Audit

Date: 2026-05-09
Phase: 1 - Complete Owner/Hostel Scope Audit

## Scope Inspected

- Backend API routes under `backend-next/app/api/**`
- Backend services under `backend-next/lib/services/**`
- Shared auth/scope/cache/event utilities under `backend-next/lib/**`
- Cron and background routes under `backend-next/app/api/cron/**`
- Raw SQL usage via `$queryRaw`, `$queryRawUnsafe`, `$executeRaw`, and `$executeRawUnsafe`
- Frontend React Query hooks and key factory under `frontend/src/hooks/**` and `frontend/src/lib/query/**`
- Frontend auth/session/localStorage/sessionStorage usage under `frontend/src/**`
- Notification/event-stream delivery paths

## Executive Summary

The codebase has materially improved owner and hostel scoping, but Phase 1 still found several hardening gaps that must be addressed in later phases before the platform can claim enterprise-grade isolation.

The immediate highest-risk issues are:

- Operational analytics still use dynamic SQL string interpolation for optional hostel filters.
- Legacy preference resolution still falls back from owner to first active hostel in several tenant/payment/document paths.
- Some owner profile/settings/logo/addon flows still operate on the first active hostel rather than explicit hostel context.
- Frontend localStorage had owner-global onboarding and preferences keys that could bleed state across logins on the same browser.
- SSE event bus previously delivered owner events to unscoped clients.

Phase 1 applied low-risk fixes only for frontend cache partitioning and SSE owner event delivery. Raw SQL hardening, RLS, and deterministic preference rewrites are deferred to their mandatory dedicated phases.

## Critical Findings

### CRITICAL-001 - Unsafe Dynamic SQL Hostel Filters In Operational Analytics

File: `backend-next/lib/services/analytics-service.ts`

Functions:

- `getCashflowDashboard`
- `getTenantIntelligenceDashboard`

Bug:

- Optional `hostelId` filters are built with string interpolation, for example `AND p.hostel_id = '${hostelId}'::uuid`.
- Several tenant intelligence queries define `hostelFilter` / `hostelPayFilter` but do not consistently apply those filters to every query in the dashboard.

Leakage Risk:

- A malformed or attacker-controlled `hostelId` could become unsafe SQL if route validation is bypassed or a future internal caller skips ownership checks.
- Partial hostel filtering can contaminate hostel-level analytics with owner-wide metrics.

Affected Entities:

- Payments
- Tenants
- Rent obligations
- Reminder logs
- Tenant behavior scores
- Analytics dashboards

Proposed Fix:

- Phase 3: Replace dynamic strings with `Prisma.sql` fragments.
- Phase 5/9: Add snapshot-backed analytics with hostel_id baked into materialized rows.
- Add tests proving Hostel A tenant intelligence does not include Hostel B payment behavior.

Status:

- Documented. Not changed in Phase 1 because this belongs to Raw SQL Hardening and analytics migration.

### CRITICAL-002 - Unsafe Dynamic SQL In Financial Operational Services

File: `backend-next/lib/services/financial-service.ts`

Functions:

- `getOperationalCashflowMetrics`
- `getOperationalDues`
- `getOperationalDefaulters`
- `getOperationalOverdueObligations`

Bug:

- Uses `$queryRawUnsafe` with string-built optional owner/hostel filters.
- Owner and hostel filters are logically present in many paths but not structurally parameterized.

Leakage Risk:

- Financial dashboards, reminders, and defaulter lists could become injection-sensitive or mis-scoped if called without route-level validation.
- Cron paths with optional `ownerId` can operate globally by design; that design needs explicit audit-safe service-role boundaries.

Affected Entities:

- RentObligation
- Payment
- Tenant
- ReminderLog

Proposed Fix:

- Phase 3: Convert to `Prisma.sql` and parameter arrays.
- Phase 6: Split global cron access from owner-request access with explicit system-job scope.
- Phase 10: CI gate `$queryRawUnsafe` outside audit/invariant files.

Status:

- Documented. Not changed in Phase 1.

### CRITICAL-003 - Legacy Owner-to-First-Hostel Preference Resolution Remains

Files:

- `backend-next/lib/preferences.ts`
- `backend-next/lib/services/tenant-service.ts`
- `backend-next/lib/services/payment-service.ts`
- `backend-next/lib/services/document-service.ts`
- `backend-next/lib/services/tenant-advance-service.ts`
- `backend-next/app/api/notifications/test-reminder/route.ts`
- `backend-next/app/api/tenants/me/onboarding-settings/route.ts`
- `backend-next/app/api/tenants/me/complete-profile/route.ts`
- `backend-next/app/api/owner/me/preferences/route.ts`

Bug:

- `getPreferences(ownerId)` and `getHostelWithPreferences(ownerId)` intentionally return the first active hostel for backward compatibility.
- Several tenant/payment/document flows still call this owner-level fallback when entity-derived hostel context is missing.

Leakage Risk:

- Multi-hostel owners can receive the wrong billing/reminder/document policy for tenants in non-first hostels.
- This is usually owner-isolated but not hostel-correct and can cause financial attribution/config drift.

Affected Entities:

- Tenants
- Payments
- Receipts
- Tenant documents
- Reminders
- Onboarding settings

Proposed Fix:

- Phase 2: Replace each call with entity-derived context: tenant -> active allocation/current hostel -> hostel.preferences_config.
- For owner profile/preferences UI, require explicit hostel selection before editing hostel-specific settings.
- Add CI gate for new `getPreferences(ownerId)` calls in operational services.

Status:

- Documented. Billing-default invite flow already uses room-derived defaults from the prior implementation.

## High Findings

### HIGH-001 - Owner Profile/Logo/Preference APIs Still Use First Active Hostel

Files:

- `backend-next/lib/services/property-service.ts`
- `backend-next/app/api/owner/logo/route.ts`

Functions:

- `getOwnerProfile`
- `updateHostel`
- `updatePreferences`
- logo `POST`
- logo `DELETE`

Bug:

- Uses `include: { hostels: { where: { is_active: true }, take: 1 } }` and `profile.hostels[0]` or `hostel.findFirst`.

Leakage Risk:

- Owner-isolated, but not hostel-deterministic.
- Multi-hostel owners can edit/view/upload assets for an arbitrary first hostel instead of selected hostel.

Affected Entities:

- Hostel
- Preferences
- Logo assets

Proposed Fix:

- Phase 2/5: Require `hostelId` for hostel settings and logo routes; validate with `assertHostelBelongsToOwner`.
- Preserve default single-hostel fallback only for onboarding bootstrap, with explicit audit log.

Status:

- Documented. Not changed in Phase 1.

### HIGH-002 - Event Bus Broadcast Allowed Unscoped Clients

File: `backend-next/lib/events/event-bus.ts`

Function:

- `broadcast`

Bug:

- Previous delivery condition sent owner events to `client.ownerId === ownerId || !client.ownerId`.

Leakage Risk:

- Any accidentally unscoped SSE client could receive every owner event broadcast through this bus.

Affected Entities:

- Live owner events
- Dashboard refresh events
- Notification refresh events

Fix Applied:

- Removed unscoped broadcast fallback. Events are delivered only when `client.ownerId === ownerId`.

Tests Added:

- `backend-next/lib/events/event-bus.test.ts`

Rollback Strategy:

- Revert `event-bus.ts` only if SSE delivery breaks, but do not restore global unscoped delivery; instead fix client registration.

### HIGH-003 - Frontend Onboarding State Was Owner-Global

File:

- `frontend/src/hooks/useOnboardingState.js`

Bug:

- Used a single `hms_onboarding_step` localStorage key across all owners on the same browser.

Leakage Risk:

- Owner B could inherit Owner A onboarding progress and skip setup screens or see stale onboarding state.

Fix Applied:

- Onboarding progress now uses `hms_onboarding_step:{ownerId}`.
- Legacy key is read only for compatibility and removed when new scoped state is saved.

Tests Added:

- `frontend/tests/hooks/useOnboardingState.test.js`

Rollback Strategy:

- Revert frontend hook only; server-derived onboarding still remains source of truth through `deriveOnboardingStep`.

### HIGH-004 - Frontend Owner Preferences Cache Was Owner-Global

File:

- `frontend/src/context/AppPreferencesContext.jsx`

Bug:

- Used a single `ownerPreferences` localStorage key.

Leakage Risk:

- Browser-level preference bleed between owners, especially currency/date/receipt/billing display behavior.

Fix Applied:

- Preferences now store under `ownerPreferences:{ownerId}:{hostelId}`.
- Auth login/logout clears legacy and scoped preference keys.

Files Modified:

- `frontend/src/context/AppPreferencesContext.jsx`
- `frontend/src/context/AuthContext.jsx`

Rollback Strategy:

- Revert scoped key change if a client regression appears; backend scope enforcement remains unaffected.

## Medium Findings

### MEDIUM-001 - One React Query Hook Bypassed Scoped Query Key Factory

File:

- `frontend/src/hooks/useActivities.js`

Bug:

- Used raw key `['activities', params]` instead of `queryKeys.activity.list(params)`.

Leakage Risk:

- Activity data could survive account rotation in React Query cache if auth clearing missed a path.

Fix Applied:

- Switched to owner/hostel-scoped query key factory.

### MEDIUM-002 - Payment Attempt IDs Stored In Global Browser Keys

File:

- `frontend/src/components/owner/payments/OnlinePaymentTestModal.jsx`

Bug:

- Stores `lastPaymentAttemptId` and `lastPaymentMerchantTxnId` in global localStorage/sessionStorage keys.

Leakage Risk:

- Low direct data exposure because backend verifies payment attempts, but confusing previous-session payment state can appear after account switches.

Proposed Fix:

- Phase 5: Partition payment attempt debug keys by owner/session or move to sessionStorage only.

Status:

- Documented. Not changed in Phase 1.

### MEDIUM-003 - Activity Aggregation Is Owner-Scoped But Not Hostel-Scoped

File:

- `backend-next/lib/services/activity-service.ts`

Bug:

- `getOwnerActivity` filters by owner only and has no optional `hostelId` filtering.

Leakage Risk:

- Owner-level activity is safe, but future hostel dashboards can show cross-hostel activity.

Proposed Fix:

- Phase 5/9: Add optional `hostelId`, validate route, filter payments/allocations by hostel_id.

Status:

- Documented. Not changed in Phase 1.

### MEDIUM-004 - Notification Read Uses Compound Where Shape That Requires Schema Support

File:

- `backend-next/lib/services/notification-service.ts`

Function:

- `markAsRead`

Bug:

- Uses `update({ where: { id, profile_id } })`. This is safe only if Prisma schema has a matching unique compound constraint; otherwise it can fail at runtime or require `updateMany`.

Leakage Risk:

- Not a cross-owner read leak, but notification state mutation reliability should be verified.

Proposed Fix:

- Phase 6/7: Confirm schema constraint or replace with `updateMany({ where: { id, profile_id } })` and assert count.

Status:

- Documented. Not changed in Phase 1.

## Low Findings

### LOW-001 - Admin Scope Still Needs Route-by-Route Explicit Bypass Review

Files:

- Multiple `backend-next/app/api/**` routes

Bug:

- Many routes allow `ADMIN` but use owner scope resolution that requires explicit owner context or assumes `session.sub` in older routes.

Risk:

- Admin support workflows may fail or accidentally use admin profile ID as owner ID.

Proposed Fix:

- Phase 2/6: Require explicit `ownerId` for admin operational support routes and deny admin in normal owner routes unless designed.

### LOW-002 - `findFirst` Is Used Safely In Many Ownership Assertions But Needs CI Classification

Files:

- `backend-next/lib/security/scoped-query.ts`
- multiple operational services

Bug:

- Some `findFirst` calls are correct because they include owner/entity filters; others are first-hostel fallbacks.

Risk:

- Grep-only CI would create noise unless approved exceptions are categorized.

Proposed Fix:

- Phase 10: Build static checker with allowlist categories:
  - allowed scoped lookup
  - forbidden first-hostel fallback
  - audit/invariant exception

## Phase 1 Changes Applied

### Backend

- Hardened SSE event bus delivery in `backend-next/lib/events/event-bus.ts`.
- Added owner-isolation regression test in `backend-next/lib/events/event-bus.test.ts`.

### Frontend

- Scoped onboarding localStorage by owner in `frontend/src/hooks/useOnboardingState.js`.
- Scoped owner preference localStorage by owner/hostel in `frontend/src/context/AppPreferencesContext.jsx`.
- Cleared scoped/legacy frontend state at login/logout boundaries in `frontend/src/context/AuthContext.jsx`.
- Replaced raw activity React Query key with scoped factory key in `frontend/src/hooks/useActivities.js`.
- Added onboarding-state regression test in `frontend/tests/hooks/useOnboardingState.test.js`.

## Deferred To Later Phases

- Phase 2: Remove `getPreferences(ownerId)` and first-hostel fallbacks from operational services.
- Phase 3: Replace `$queryRawUnsafe` in analytics/financial/dashboard services.
- Phase 4: Add rollout-safe RLS migrations and deployment guide.
- Phase 5: Finish frontend storage partitioning for payment attempt debug keys and hostel-specific query params.
- Phase 6: Review all cron jobs for explicit system scope and owner/hostel iteration boundaries.
- Phase 7: Enforce append-only financial mutations.
- Phase 8: Deep transfer reconciliation tests.
- Phase 9: Snapshot-backed dashboard migration.
- Phase 10: Static CI gates.

## Verification Plan For Phase 1

Required commands:

- `backend-next`: `./node_modules/.bin/tsc --noEmit`
- `backend-next`: `node ./node_modules/.bin/tsx lib/events/event-bus.test.ts`
- `backend-next`: `node ./node_modules/.bin/tsx lib/services/hostel-billing-preferences-service.test.ts`
- `backend-next`: `node ./node_modules/.bin/tsx lib/services/multi-owner-isolation.test.ts`
- `backend-next`: `node ./node_modules/.bin/tsx lib/services/multi-hostel-isolation.test.ts`
- `backend-next`: `DOTENV_CONFIG_PATH=../.env node -r dotenv/config ./node_modules/.bin/tsx lib/services/rent-generation-service.test.ts`
- `frontend`: `npm test -- --run`
- `frontend`: `npm run build`

## Remaining Risks

- Database RLS is not yet enabled.
- Raw SQL unsafe usage remains in operational services until Phase 3.
- First-hostel preference fallbacks remain until Phase 2.
- Some owner settings routes are owner-isolated but not hostel-explicit.
- Activity timelines are owner-scoped but not hostel-scoped.
- Payment test/debug localStorage keys are still not owner-partitioned.

## Rollback Strategy

Phase 1 code changes are additive/low-risk:

- Revert `event-bus.ts` and `event-bus.test.ts` if SSE delivery fails, but keep the invariant that unscoped clients must not receive owner events.
- Revert frontend scoped localStorage changes if onboarding/preference UX regresses; no backend data shape changes were introduced.
- No database migration was added in Phase 1.

## Operational Rollout Notes

- Deploy backend and frontend together so cache partitioning and event delivery semantics align.
- Existing browser sessions should refresh after deploy; login/logout now clears legacy preference/onboarding keys.
- Monitor event delivery after deployment for missing owner dashboard refreshes. If refreshes fail, fix client registration to include owner scope instead of restoring unscoped broadcast.

## Phase 1 Verification Results

Completed on 2026-05-09:

- Backend TypeScript: `./node_modules/.bin/tsc --noEmit` passed.
- Event bus isolation: `3 passed / 0 failed`.
- Billing defaults regression: `11 passed / 0 failed`.
- Frontend tests: `4 files / 7 tests passed`.
- Multi-owner isolation: `15 passed / 0 failed`.
- Multi-hostel isolation: `26 passed / 0 failed`.
- Rent generation regression: `84 passed / 0 failed`.
- Frontend production build: passed.

Known non-failing warning during rent-generation regression:

- `abandonment-service.ts` milestone notification logs an invalid UUID warning for synthetic test owner IDs such as `P7A`. The rent-generation suite still passes and this warning is not introduced by Phase 1 changes.
