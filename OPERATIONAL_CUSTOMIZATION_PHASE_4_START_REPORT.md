# HMS Phase 4 Operational Customization Start Report

Date: 2026-05-09
Phase: 4 - Collection Strategy Engine Start

## Objective

Begin turning hostel policy into operational behavior. This slice focuses only on collection/reminder strategy execution.

## What Was Inspected

- `backend-next/lib/services/reminder-service.ts`
- `backend-next/lib/services/hostel-policy-service.ts`
- `backend-next/lib/preferences.ts`
- Existing reminder UI compatibility keys

## Risks Discovered

- Automated reminders still used hardcoded day-1/day-5/day-10 behavior.
- Custom `policy.reminders.schedule.after_due_days` normalized correctly but was not consumed by reminder execution.
- Manual reminders still had a fallback path that could resolve a hostel by owner instead of tenant lineage.

## What Changed

- Added `collection-strategy-service.ts` to resolve collection strategy from hostel policy compatibility preferences.
- Added configurable after-due schedule execution.
- Preserved legacy day-1/day-5/day-10 compatibility.
- Mapped configured schedule positions to reminder types:
  - first configured day -> `DUE_SOON`
  - middle configured days -> `WARNING`
  - last configured day when 3+ stages exist -> `FINAL_NOTICE`
- Updated reminder cron to call the collection strategy resolver instead of hardcoded reminder toggles.
- Added policy compatibility fields:
  - `reminder_before_due_days`
  - `reminder_after_due_days`
  - `reminder_auto_stop_after_payment`
  - `reminder_escalation_tone`
- Updated policy compatibility PATCH mapping so explicit reminder schedules write into the canonical `reminders.schedule` domain.
- Removed manual-reminder first-hostel fallback and replaced it with `getTenantOperationalContext`.
- Ensured reminder logs receive immutable `hostel_id` from the resolved obligation/tenant context.
- Replaced legacy-only reminder schedule toggles in selected-hostel settings with a collection strategy editor for after-due and before-due day arrays.
- Fixed the test-reminder UI path to pass explicit selected hostel context into the notifications module.

## Files Modified

- `backend-next/lib/services/collection-strategy-service.ts`
- `backend-next/lib/services/collection-strategy-service.test.ts`
- `backend-next/lib/services/hostel-policy-service.test.ts`
- `backend-next/lib/services/reminder-service.ts`
- `backend-next/lib/services/hostel-policy-service.ts`
- `backend-next/lib/preferences.ts`
- `frontend/src/pages/owner/OwnerProfile.jsx`
- `OPERATIONAL_CUSTOMIZATION_PHASE_4_START_REPORT.md`

## Tests Added

- `backend-next/lib/services/collection-strategy-service.test.ts`
- Extended `backend-next/lib/services/hostel-policy-service.test.ts`

## Remaining Risks

- Before-due reminders are modeled but not executed yet because the current operational reminder source returns overdue obligations only.
- Reminder tone/template customization is modeled as policy metadata but not yet connected to email/WhatsApp template selection.
- Before-due reminder schedule can now be configured but is not executed yet.
- Reminder schedule input is intentionally simple in this first slice; a richer collection playbook builder can follow after execution semantics stabilize.

## Rollback Strategy

- Revert `collection-strategy-service.ts` and the `reminder-service.ts` call site to return to day-1/day-5/day-10 behavior.
- No schema or data migrations were introduced.

## Operational Rollout Notes

- Existing hostels retain legacy day behavior through compatibility normalization.
- Hostels with nested `policy.reminders.schedule.after_due_days` will now execute that configured schedule.
- Monitor `REMINDER_SENT` counts after deploy to ensure customized schedules behave as expected.
