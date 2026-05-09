# HMS Multi-Tenant Isolation Audit Report

Date: 2026-05-09
Scope: `backend-next/app/api/**`, `backend-next/lib/**`, `backend-next/lib/services/**`, frontend query/session/cache surfaces.

## Executive Summary

A SEV-1 multi-tenant leakage risk was confirmed. The most likely production symptom was a combination of:

- frontend React Query cache keys that were not owner/session scoped, allowing dashboard/tenant/room data to be reused after account switching;
- logout/login flows that did not clear React Query cache or session-scoped browser state;
- API handlers relying directly on `session.sub`, without a central role-safe owner scope resolver;
- legacy hostel fallback patterns such as first active hostel selection and `getPreferences(ownerId)`.

Immediate remediation was applied to the highest-risk operational surfaces: rooms, tenants, dashboard/analytics, expenses, auth payload propagation, query cache scoping, and invariant detection.

## Critical Findings

### CRITICAL-001: Frontend query cache not owner-scoped

File: `frontend/src/lib/query/queryKeys.js`

Exact bug: Query keys such as `['dashboard']`, `['tenants']`, `['rooms']`, and `['analytics']` were shared across all authenticated owners in the same browser runtime.

Leakage risk: Owner B could see Owner A's cached tenants, rooms, dashboard metrics, payments, analytics, or notifications after account switching or multi-tab reuse.

Affected entities: tenants, rooms, dashboard metrics, analytics, payments, expenses, notifications.

Fix applied: Query keys now include a session scope prefix: `['scope', ownerId, hostelId, ...]`.

### CRITICAL-002: Logout did not clear API cache/session state

File: `frontend/src/context/AuthContext.jsx`

Exact bug: Logout only removed localStorage users. React Query cache, onboarding state, and sessionStorage remained alive.

Leakage risk: Recently fetched owner data could be displayed to a different account before fresh network data loaded.

Affected entities: all frontend-cached API data.

Fix applied: logout and login now call `queryClient.clear()`, remove onboarding state, and clear `sessionStorage` on logout.

### CRITICAL-003: Ambiguous owner scope resolution

Files: multiple API routes and services.

Exact bug: Owner routes directly used `session.sub`. Some legacy code used patterns equivalent to `owner_id || id`, and there was no central guard that validates `OWNER.owner_id === sub`.

Leakage risk: malformed JWT/session payloads or admin paths could accidentally resolve to the wrong owner boundary.

Affected entities: rooms, tenants, dashboard, analytics, expenses.

Fix applied: Added `resolveOwnerScope()`, `resolveTenantScope()`, and `resolveAdminScope()` in `backend-next/lib/auth/resolve-operational-scope.ts`. Patched high-risk routes to use role-safe scope resolution.

### CRITICAL-004: Hostile `hostelId` parameter could be trusted by route/service callers

Files: dashboard/analytics/rooms/tenants/expenses API routes.

Exact bug: Several APIs accepted optional `hostelId` and passed it deeper after only applying owner filters elsewhere.

Leakage risk: If any nested query was insufficiently owner-scoped, `hostelId` could pivot queries into another owner's hostel.

Affected entities: rooms, tenants, analytics, expenses.

Fix applied: Added `assertHostelBelongsToOwner()` and patched high-risk endpoints to validate hostel ownership before query execution.

## High Findings

### HIGH-001: Legacy single-hostel preference fallback remains

Files: `backend-next/lib/preferences.ts`, `receipt-service.ts`, `payment-service.ts`, `document-service.ts`, `tenant-advance-service.ts`, `reminder-service.ts`.

Exact bug: `getPreferences(ownerId)` still resolves an owner's first active hostel as a compatibility fallback.

Leakage risk: Multi-hostel owners can get wrong branding/payment preferences; cross-owner risk is lower because fallback is owner-scoped, but operational correctness can drift.

Fix status: Not fully removed. Calls are logged and should be replaced with explicit hostel context in a follow-up.

### HIGH-002: Raw SQL remains in analytics and invariant services

Files: `analytics-service.ts`, `dashboard-service.ts`, `migration-audit-service.ts`, `financial-invariant-service.ts`, `owner-isolation-invariant-service.ts`.

Exact bug: Several queries use `$queryRawUnsafe`. Some are static audit SQL; some compose SQL conditionally.

Leakage risk: Parameter safety and future maintenance risk. Current remediated API routes validate `hostelId` before passing it into analytics, reducing immediate exposure.

Fix status: Partially mitigated via route-level hostel ownership validation. Future work should convert dynamic SQL to `Prisma.sql` fragments.

### HIGH-003: Property profile APIs still use first active hostel

File: `backend-next/lib/services/property-service.ts`

Exact bug: owner profile/preferences APIs read `profile.hostels[0]`.

Leakage risk: Owner-scoped but not hostel-correct for multi-hostel accounts.

Fix status: Documented as remaining architecture weakness.

## Medium Findings

### MEDIUM-001: Admin routes need explicit owner scope for operational access

Exact bug: Admin support flows historically use `session.sub` unless an explicit owner is passed.

Risk: Admin support actions can be ambiguous.

Fix applied: `resolveOwnerScope(session, { allowAdmin: true, ownerId })` requires explicit owner ID for admin operational access. Remaining admin routes should adopt it incrementally.

### MEDIUM-002: Owner isolation invariant checks were missing

Exact bug: System had hostel invariants but not direct owner-lineage invariants.

Risk: Cross-owner row drift could persist silently.

Fix applied: Added `owner-isolation-invariant-service.ts` emitting `CROSS_OWNER_DATA_LEAK`, `HOSTEL_SCOPE_VIOLATION`, and `OWNER_SCOPE_VIOLATION` style events.

## Low Findings

### LOW-001: Test files were global scripts

Exact bug: test files without `export {}` collided during TypeScript project checking.

Fix applied: converted isolation test files into modules.

## Recommendations

- Add PostgreSQL Row Level Security policies on owner-scoped tables.
- Convert remaining `$queryRawUnsafe` analytics SQL to parameterized `Prisma.sql`.
- Replace all `getPreferences(ownerId)` call sites with explicit hostel context.
- Add CI grep checks blocking new `findMany({})`, unsafe `findFirst(owner_id)` fallback, and unscoped cache keys.
- Add production alerting on `CROSS_OWNER_DATA_LEAK`, `OWNER_SCOPE_VIOLATION`, `HOSTEL_SCOPE_VIOLATION`, and `ANALYTICS_CONTAMINATION`.
