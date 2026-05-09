# HMS Phase 2 Explicit Hostel Settings Report

Date: 2026-05-09
Phase: 2 - Explicit Hostel-Scoped Operational Settings

## Objective

Convert HMS settings from owner-global preference behavior into explicit hostel-scoped operational settings.

This phase focused only on settings/context hardening, not raw SQL hardening or RLS.

## What Was Inspected

- Legacy owner preference route: `backend-next/app/api/owner/me/preferences/route.ts`
- Legacy owner logo route: `backend-next/app/api/owner/logo/route.ts`
- Owner hostel settings route: `backend-next/app/api/owner/me/hostel/route.ts`
- Test reminder route: `backend-next/app/api/notifications/test-reminder/route.ts`
- Owner profile/property service: `backend-next/lib/services/property-service.ts`
- Existing preference resolver: `backend-next/lib/preferences.ts`
- Billing defaults service and routes
- Owner settings frontend: `frontend/src/pages/owner/OwnerProfile.jsx`
- Onboarding billing/payment flows
- Frontend preference cache and React Query scope keys

## Risks Discovered

- Owner settings APIs still allowed preference and branding updates without explicit hostel context.
- `property-service.ts` used first active hostel behavior for owner profile/settings compatibility.
- Test reminders resolved preferences from owner context instead of selected hostel context.
- Frontend settings UI did not maintain a selected-hostel settings workspace.
- React Query keys used session hostel scope but did not include the newly selected active hostel from owner settings.
- `resolvePreferences(hostel)` was still the runtime compatibility layer, so it needed to delegate to the canonical policy resolver instead of independently shaping settings.

## What Changed

### Canonical Policy Resolver

Added `backend-next/lib/services/hostel-policy-service.ts`.

Responsibilities implemented:

- Normalize typed hostel columns and legacy flat `preferences_config` into a canonical `HostelPolicy` object.
- Preserve transition compatibility through `compatibility_preferences`.
- Map old flat settings payloads into policy-domain patches.
- Validate writes strictly while allowing legacy reads to surface invalid config to existing billing validators.
- Persist nested policy domains back into `preferences_config` while mirroring compatibility keys during transition.
- Emit `HOSTEL_POLICY_UPDATED` and `BILLING_DEFAULTS_UPDATED` events.

### Explicit Hostel Preference APIs

Created:

- `GET /api/hostels/:id/preferences`
- `PATCH /api/hostels/:id/preferences`

Rules enforced:

- Resolve owner scope with `resolveOwnerScope`.
- Validate `hostel.id + owner_id + is_active`.
- Return `{ hostel, policy, compatibility_preferences }`.
- Patch only validated policy domains.
- Preserve old flat preference payload compatibility by converting flat keys into nested policy domains.

### Explicit Hostel Settings And Branding APIs

Created:

- `PATCH /api/hostels/:id`
- `POST /api/hostels/:id/logo`
- `DELETE /api/hostels/:id/logo`

The legacy `/api/owner/logo` route now refuses ambiguous owner-global logo updates and instructs callers to use the hostel-scoped route.

### Legacy Owner Preference Route Hardened

Changed `/api/owner/me/preferences` to require explicit `hostelId` / `hostel_id` if used during transition.

It no longer calls owner-level preference fallback and no longer selects a first hostel.

### Owner Profile / Hostel Update Hardening

Updated `property-service.ts`:

- `getOwnerProfile` returns owner and hostels without selecting a first hostel for settings.
- Compatibility `hostel` is only returned when there is exactly one active hostel.
- `updateHostel` requires `hostel_id` for existing hostel updates.
- Bootstrap creation still works without `hostel_id` only when the owner has no active hostel yet.

### Preference Compatibility Layer Rewired

Updated `backend-next/lib/preferences.ts`:

- Removed legacy `getPreferences(ownerId)`.
- Removed legacy `getHostelWithPreferences(ownerId)`.
- `resolvePreferences(hostel)` now delegates to `normalizeHostelPolicy()` and `toCompatibilityPreferences()`.

This keeps old runtime consumers compatible while making the policy resolver the canonical preference shape authority.

### Test Reminder Hardened

Updated `/api/notifications/test-reminder`:

- Requires explicit `hostelId` / `hostel_id`.
- Resolves reminder preferences from `hostelPolicyService.getHostelPolicy(hostelId, ownerId)`.
- Logs `hostel_id` in `TEST_REMINDER_SENT` events.

### Frontend Selected Hostel Settings Workspace

Updated owner settings UX:

- Added selected-hostel switcher on the owner profile/settings page.
- Settings copy now clearly states that edits apply only to the selected hostel.
- Hostels are loaded from `ownerService.getHostels()`.
- Active hostel id is persisted per owner in `localStorage`.
- Settings reads use `GET /api/hostels/:id/preferences`.
- Settings writes use `PATCH /api/hostels/:id/preferences`.
- Hostel details writes use `PATCH /api/hostels/:id`.
- Logo upload/delete uses `/api/hostels/:id/logo`.
- Test reminders send the selected hostel id.

### Frontend Cache Isolation

Added active-hostel helper:

- `frontend/src/lib/hostel/activeHostel.js`

Updated:

- React Query key factory now includes active selected hostel id.
- App preferences cache reads selected-hostel preferences explicitly.
- Login/logout clears active-hostel storage keys.
- Onboarding stores active hostel after hostel creation.
- Onboarding billing/payment updates resolve the created active hostel explicitly.

## Files Modified

Backend:

- `backend-next/lib/services/hostel-policy-service.ts`
- `backend-next/app/api/hostels/[id]/preferences/route.ts`
- `backend-next/app/api/hostels/[id]/route.ts`
- `backend-next/app/api/hostels/[id]/logo/route.ts`
- `backend-next/app/api/owner/me/preferences/route.ts`
- `backend-next/app/api/owner/logo/route.ts`
- `backend-next/app/api/owner/me/hostel/route.ts`
- `backend-next/app/api/notifications/test-reminder/route.ts`
- `backend-next/lib/services/property-service.ts`
- `backend-next/lib/preferences.ts`
- `backend-next/lib/hostel-context.ts`
- `backend-next/lib/services/deterministic-context.test.ts`
- `backend-next/lib/services/hostel-policy-service.test.ts`

Frontend:

- `frontend/src/lib/hostel/activeHostel.js`
- `frontend/src/lib/query/queryKeys.js`
- `frontend/src/context/AppPreferencesContext.jsx`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/api/services.js`
- `frontend/src/pages/owner/OwnerProfile.jsx`
- `frontend/src/pages/onboarding/OnboardingHostel.jsx`
- `frontend/src/pages/onboarding/OnboardingBilling.jsx`
- `frontend/src/pages/onboarding/OnboardingPayments.jsx`
- `frontend/tests/utils/activeHostel.test.js`

## Tests Added

- `backend-next/lib/services/hostel-policy-service.test.ts`
- `frontend/tests/utils/activeHostel.test.js`

Updated:

- `backend-next/lib/services/deterministic-context.test.ts`

## Verification Results

Completed on 2026-05-09:

- Backend TypeScript: `./node_modules/.bin/tsc --noEmit` passed.
- Hostel policy resolver regression: `12 passed / 0 failed`.
- Deterministic context static regression: `2 passed / 0 failed`.
- Billing defaults regression: `11 passed / 0 failed`.
- Multi-owner isolation: `15 passed / 0 failed`.
- Multi-hostel isolation: `26 passed / 0 failed`.
- Rent generation regression: `84 passed / 0 failed`.
- Frontend tests: `5 files / 9 tests passed`.
- Frontend production build: passed.
- Patch hygiene: `git diff --check` passed.

Known non-failing warning remains during rent-generation regression:

- `abandonment-service.ts` milestone notification logs an invalid UUID warning for synthetic test owner IDs such as `P7A`. The rent-generation suite still passes and this warning was not introduced by Phase 2.

## Remaining Risks

- Frontend owner settings now has selected-hostel context, but broader portfolio navigation still needs a full global hostel switcher UX in a later phase.
- Policy change history table is not implemented yet; current audit trail uses `SYSTEM_EVENT_LOG` events.
- Existing runtime services still consume compatibility preferences via `resolvePreferences(hostel)`, although that resolver now delegates to the canonical policy service.
- Legacy `/api/owner/me/preferences` remains as a transition endpoint, but it now requires explicit hostel context.
- Raw SQL hardening remains Phase 3 and was intentionally not started.
- RLS remains a later enterprise security phase and was intentionally not started.

## Rollback Strategy

- Revert the explicit hostel preference APIs and frontend selected-hostel settings workspace as one change set if settings UX regresses.
- Keep the old `/api/owner/me/preferences` route fallback disabled unless an emergency rollback is required; restoring first-hostel selection would reintroduce the core ambiguity.
- No destructive migrations were introduced.
- Policy writes still mirror legacy flat keys, so rolling back frontend code should not orphan preference data.

## Operational Rollout Notes

- Deploy backend and frontend together because frontend settings now call hostel-scoped endpoints.
- Existing browser sessions should refresh or re-login so active-hostel and preference caches reset cleanly.
- Monitor `HOSTEL_POLICY_UPDATED`, `BILLING_DEFAULTS_UPDATED`, and `TEST_REMINDER_SENT` events after rollout.
- Any `HOSTEL_CONTEXT_REQUIRED` response from legacy routes should be treated as a client integration needing explicit hostel id, not a reason to restore owner-global fallback.
- Phase 3 should proceed to raw SQL hardening after this settings phase is deployed and verified.
