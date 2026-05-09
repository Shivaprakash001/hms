# HMS Phase 2 Deterministic Context Resolution Report

Date: 2026-05-09
Phase: 2 - Remove Non-Deterministic Operational Context Resolution

## Objective

Begin removing owner-first-hostel assumptions from operational paths. The target architecture is:

```text
entity -> allocation/payment/obligation -> room/hostel -> preferences
```

Never:

```text
owner -> first active hostel -> preferences
```

## What Was Inspected

- Remaining `getPreferences(ownerId)` callers from Phase 1 audit.
- Tenant self-profile preference enforcement.
- Tenant document preference enforcement.
- Tenant advance/deposit preference enforcement.
- Payment receipt and payment-rule preference resolution.
- Tenant onboarding/profile-photo requirement settings.

## Risks Discovered

- Several services had already started using entity hostel IDs but still fell back to `getPreferences(ownerId)` when `hostel_id` was missing.
- That fallback preserved runtime compatibility but silently reintroduced first-hostel policy drift for multi-hostel owners.
- Tenant onboarding settings and profile-completion settings used owner preferences instead of tenant hostel lineage.

## What Changed

### Central Context Helpers

Added deterministic helpers in `backend-next/lib/hostel-context.ts`:

- `getTenantOperationalContext(tenantId, ownerId, storedHostelId?)`
- `getPaymentOperationalContext(paymentId, ownerId, storedHostelId?, tenantId?)`
- `getObligationOperationalContext(obligation)`

Behavior:

- Prefer stored `hostel_id` when already stamped on the entity.
- Derive from active allocation when needed.
- Validate hostel belongs to owner.
- Emit `HOSTEL_SCOPE_VIOLATION` if lineage is missing.
- Throw `HOSTEL_CONTEXT_REQUIRED` instead of guessing first hostel.

### Operational Callers Patched

- `tenant-service.ts`: tenant self-edit policy now uses tenant operational context.
- `document-service.ts`: document visibility/approval requirement now uses tenant operational context.
- `tenant-advance-service.ts`: advance/deposit feature flag now requires tenant-derived hostel context.
- `payment-service.ts`: receipt emailing, partial-payment rules, checkout preferences, and advance payment preferences now use payment/obligation/tenant operational context.
- `tenants/me/onboarding-settings/route.ts`: tenant onboarding settings now resolve from tenant hostel context.
- `tenants/me/complete-profile/route.ts`: profile-photo requirement now resolves from tenant hostel context.

## Files Modified

- `backend-next/lib/hostel-context.ts`
- `backend-next/lib/services/tenant-service.ts`
- `backend-next/lib/services/document-service.ts`
- `backend-next/lib/services/tenant-advance-service.ts`
- `backend-next/lib/services/payment-service.ts`
- `backend-next/app/api/tenants/me/onboarding-settings/route.ts`
- `backend-next/app/api/tenants/me/complete-profile/route.ts`
- `backend-next/lib/services/deterministic-context.test.ts`

## Tests Added

- `backend-next/lib/services/deterministic-context.test.ts`

This static regression fails if operational services or tenant/payment routes reintroduce `getPreferences(ownerId)`.

## Remaining Risks

- `backend-next/app/api/owner/me/preferences/route.ts` remains a legacy owner preferences route and still uses owner-first preference resolution. It is owner-isolated but not hostel-deterministic.
- `backend-next/app/api/notifications/test-reminder/route.ts` remains owner-level and still uses owner preferences because it is a synthetic owner test email, not an entity-derived operational tenant/payment flow.
- Some owner profile/logo/preference APIs still need explicit `hostelId` contracts in a later UI/API compatibility pass.
- Raw SQL hardening remains Phase 3.

## Rollback Strategy

- Revert the helper additions and specific service route patches if a production entity with missing hostel lineage blocks an urgent workflow.
- Prefer data repair/backfill for missing `hostel_id` over restoring first-hostel fallback.
- The new `HOSTEL_SCOPE_VIOLATION` events should be monitored after deploy to find records requiring lineage repair.

## Operational Rollout Notes

- Deploy after confirming migration/backfill has populated `hostel_id` on tenants, obligations, payments, and allocations.
- If `HOSTEL_CONTEXT_REQUIRED` appears, treat it as a data integrity issue, not a reason to guess context.
- Phase 3 should follow quickly because analytics and financial raw SQL still contain string-built optional filters.

## Verification Results

Completed on 2026-05-09:

- Backend TypeScript: `./node_modules/.bin/tsc --noEmit` passed.
- Deterministic context static regression: `1 passed / 0 failed`.
- Event bus isolation: `3 passed / 0 failed`.
- Billing defaults regression: `11 passed / 0 failed`.
- Multi-owner isolation: `15 passed / 0 failed`.
- Multi-hostel isolation: `26 passed / 0 failed`.
- Rent generation regression: `84 passed / 0 failed`.
- Frontend tests: `4 files / 7 tests passed`.
- Frontend production build: passed.

Known non-failing warning remains during rent-generation regression:

- `abandonment-service.ts` milestone notification logs an invalid UUID warning for synthetic test owner IDs such as `P7A`. The rent-generation suite still passes and this warning was not introduced by Phase 2.
