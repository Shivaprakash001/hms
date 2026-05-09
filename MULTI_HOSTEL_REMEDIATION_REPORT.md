# HMS Multi-Tenant Isolation Remediation Report

Date: 2026-05-09

## Fixes Applied

- Added role-safe operational scope helpers in `backend-next/lib/auth/resolve-operational-scope.ts`.
- Added scoped query helpers and ownership assertions in `backend-next/lib/security/scoped-query.ts`.
- Patched rooms APIs to resolve owner scope and validate hostel ownership.
- Patched tenants APIs to resolve owner scope and validate hostel ownership for list/create operations.
- Patched tenant detail service to prevent owners from reading another owner's tenant by direct ID.
- Patched dashboard and analytics APIs to resolve owner scope and validate optional `hostelId` before aggregating.
- Patched expenses APIs to resolve owner scope and validate hostel ownership on list/create/update/delete paths.
- Added `owner_id`, `tenant_id`, and `hostel_id` propagation in auth/session responses where available.
- Added owner/hostel-scoped React Query key factory.
- Cleared React Query cache and browser session state on login/logout boundaries.
- Added owner lineage invariant service in `backend-next/lib/services/owner-isolation-invariant-service.ts`.
- Added `multi-owner-isolation.test.ts` mandatory regression matrix.
- Preserved existing `multi-hostel-isolation.test.ts` and made both test files TypeScript modules.

## Files Changed

- `backend-next/lib/auth/resolve-operational-scope.ts`
- `backend-next/lib/security/scoped-query.ts`
- `backend-next/lib/auth-edge.ts`
- `backend-next/middleware.ts`
- `backend-next/lib/services/auth-service.ts`
- `backend-next/app/api/auth/me/route.ts`
- `backend-next/app/api/rooms/route.ts`
- `backend-next/app/api/rooms/[id]/route.ts`
- `backend-next/app/api/rooms/[id]/overview/route.ts`
- `backend-next/app/api/tenants/route.ts`
- `backend-next/app/api/tenants/[id]/route.ts`
- `backend-next/lib/services/tenant-service.ts`
- `backend-next/lib/services/financial-service.ts`
- `backend-next/app/api/dashboard/**`
- `backend-next/app/api/analytics/dashboard/route.ts`
- `backend-next/app/api/expenses/route.ts`
- `backend-next/app/api/expenses/[id]/route.ts`
- `backend-next/lib/services/owner-isolation-invariant-service.ts`
- `backend-next/lib/services/multi-owner-isolation.test.ts`
- `backend-next/lib/services/multi-hostel-isolation.test.ts`
- `frontend/src/lib/query/queryKeys.js`
- `frontend/src/context/AuthContext.jsx`

## Verification Run

- Backend TypeScript: `./node_modules/.bin/tsc --noEmit` passed.
- Frontend tests: `npm test -- --run` passed, 3 files / 5 tests.
- Multi-hostel isolation: 26 passed / 0 failed.
- Multi-owner isolation: 15 passed / 0 failed.
- Rent generation regression: 84 passed / 0 failed.

## Remaining Risks

- Some legacy preference calls still use owner-scoped first-hostel fallback. This is owner-isolated but not fully hostel-correct.
- Some raw SQL remains. Route-level ownership validation mitigates immediate cross-owner leakage, but SQL should be converted to parameterized fragments.
- DB-level RLS is not yet enforced. Application-level guards are improved, but RLS should become the final backstop.
- Admin operational scope still needs a full route-by-route review where admin support access is required.

## DB-Level RLS Recommendations

- Enable RLS on `hostels`, `rooms`, `room_allocations`, `tenants`, `rent_obligations`, `payments`, `receipts`, `expenses`, `reminder_logs`, and `notifications`.
- Store authenticated owner ID in a DB session variable or JWT claim and enforce `owner_id = current_setting(...)` policies.
- For hostel-derived entities, enforce ownership through joins to `hostels.owner_id`.
- Keep service-role bypass limited to migrations, cron, and audited system jobs.

## CI Protections Added / Recommended

Added:

- `multi-owner-isolation.test.ts`
- `multi-hostel-isolation.test.ts`

Recommended next CI gates:

- Fail on `findMany({})` in backend app/services.
- Fail on `$queryRawUnsafe` outside approved audit/invariant files.
- Fail on `getPreferences(ownerId)` in operational services.
- Fail on frontend query keys that do not include session scope.

## Rollback Strategy

- Backend route/helper changes are additive and can be reverted as a single commit if an unexpected regression appears.
- No destructive migrations were introduced in this remediation pass.
- Frontend cache scoping is safe to roll forward; rollback only affects client cache behavior, not data.
- If a production issue occurs, disable only affected endpoints while preserving auth scope helper changes.

## Operational Guidance

- Deploy backend and frontend together because session payload and query key scoping complement each other.
- After deploy, force users to refresh/re-login to clear stale browser runtime caches.
- Monitor system events for `CROSS_OWNER_DATA_LEAK`, `OWNER_SCOPE_VIOLATION`, `HOSTEL_SCOPE_VIOLATION`, and `ANALYTICS_CONTAMINATION`.
