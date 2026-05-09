# HMS Raw SQL Hardening Report

Date: 2026-05-09
Phase: 3 - Raw SQL Hardening

## Objective

Remove unsafe dynamic SQL from operational services and preserve unsafe raw SQL only in approved audit/invariant tooling.

## What Was Inspected

- `backend-next/lib/services/financial-service.ts`
- `backend-next/lib/services/analytics-service.ts`
- `backend-next/lib/services/dashboard-service.ts`
- `backend-next/lib/services/hostel-daily-snapshot-service.ts`
- Remaining `$queryRawUnsafe` usage across `backend-next/lib`, `backend-next/app`, and `backend-next/scripts`

## Risks Discovered

- Financial service used `$queryRawUnsafe` with string-built optional owner/hostel filters.
- Analytics cashflow used dynamic hostel interpolation in a raw SQL string.
- Tenant intelligence defined hostel filters but did not apply them consistently.
- Reminder funnel did not apply hostel filters consistently.
- Dashboard room stats used `$queryRawUnsafe` with optional hostel interpolation.
- Hostel daily snapshot service used `$queryRawUnsafe` despite static SQL and parameter values.

## What Changed

- Converted operational `$queryRawUnsafe` calls in financial metrics to tagged `$queryRaw` with `Prisma.sql` fragments.
- Converted dashboard room stats to tagged `$queryRaw` with a parameterized optional hostel filter.
- Converted analytics cashflow daily collections to tagged `$queryRaw`.
- Applied hostel filters consistently across tenant intelligence queries, including counts and exit insights.
- Applied hostel filters consistently across reminder funnel revenue, sent, and channel aggregation queries.
- Converted hostel daily snapshot queries to tagged `$queryRaw`.
- Added static regression to fail if operational app/services reintroduce `$queryRawUnsafe` or `$executeRawUnsafe` outside approved audit/invariant files.

## Files Modified

- `backend-next/lib/services/financial-service.ts`
- `backend-next/lib/services/analytics-service.ts`
- `backend-next/lib/services/dashboard-service.ts`
- `backend-next/lib/services/hostel-daily-snapshot-service.ts`
- `backend-next/lib/services/raw-sql-hardening.test.ts`
- `RAW_SQL_HARDENING_REPORT.md`

## Approved Unsafe Exceptions

Unsafe raw SQL remains only in:

- `backend-next/lib/services/migration-audit-service.ts`
- `backend-next/lib/services/financial-invariant-service.ts`
- `backend-next/lib/services/owner-isolation-invariant-service.ts`
- `backend-next/lib/services/hostel-invariant-validator.ts`
- migration/backfill scripts under `backend-next/scripts/**`

These are audit/invariant/tooling paths, not owner-facing operational query paths.

## Remaining Risks

- Some tagged raw SQL remains, but it is parameterized through Prisma template tags.
- RLS is still not enabled; database-level enforcement remains a later phase.
- Analytics still relies on live joins. Snapshot materialization remains a later phase.

## Rollback Strategy

- Changes are query-layer only and do not alter schema or data.
- If a regression appears, revert the affected service conversion while preserving the static unsafe-SQL test for future remediation.

## Operational Rollout Notes

- Deploy with existing isolation tests.
- Watch analytics and dashboard endpoints for query-shape regressions.
- Do not allow new `$queryRawUnsafe` in operational services.
