---
tags: [bugs]
---

# Bugs

Related: [[Features]] · [[Changelog]] · [[TODO]] · [[Business-Rules]]

Log of significant bugs — open and fixed. Not meant to replace an issue tracker for every minor bug; use this for anything that revealed a real architectural/business-rule gap (the kind of thing worth remembering months later), matching the bar already used in `docs/known-issues.md` and `docs/business-logic/*-investigation-report.md`.

## Bug report template

Copy this block for each new entry:

```markdown
### <Short title>

- **Status:** open / investigating / fixed
- **Found:** YYYY-MM-DD
- **Area:** [[Backend]] / [[Frontend]] / [[Database]]
- **Symptom:** What did the user/system observe?
- **Root cause:** Once known — the actual mechanism, not just the symptom.
- **Fix:** What changed, and where (file/commit).
- **Related:** [[links]]
```

---

## Fixed

### Ledger `entry_type` vs `type` field mismatch crashed tenant financial timeline

- **Status:** fixed
- **Found:** 2026-07 (during Owner Financial Workspace redesign)
- **Area:** [[Backend]] — `financial-timeline-service.ts`
- **Symptom:** Runtime throw whenever a tenant had any `tenant_financial_ledger` rows.
- **Root cause:** Service referenced `entry_type`, but the actual Prisma field on `tenant_financial_ledger` is `type`.
- **Fix:** Corrected field reference in `backend-next/src/services/payments/financial-timeline-service.ts`.
- **Related:** [[Features]] (Owner financial workspace)

### Raw SQL calculators used `o.amount` instead of `o.total_amount`, silently dropping late fees

- **Status:** fixed
- **Found:** 2026-07
- **Area:** [[Database]] / [[Backend]]
- **Symptom:** Owner and tenant surfaces showed different Outstanding/Overdue/Future Credit for the same tenant.
- **Root cause:** ~6 independently duplicated outstanding/overdue calculators across surfaces; two used the wrong column in raw SQL.
- **Fix:** Introduced `financial-read-model-service.ts` composing existing services; migrated consumers. See `docs/business-logic/financial-consistency-investigation-report.md` and [[Decisions]] ADR-001.
- **Related:** [[Business-Rules]], [[Decisions]]

### Typing in the Expenses Workspace search box unmounted the whole tab (looked like a full page reload)

- **Status:** fixed
- **Found:** 2026-07-18
- **Area:** [[Frontend]] — `ExpensesTab.tsx`
- **Symptom:** Every keystroke in the expense search box blanked the entire tab (dashboard, filter bar, the search input itself) into a loading skeleton, dropping input focus.
- **Root cause:** `search` was part of the React Query key, so every keystroke produced a brand-new, never-cached query key; React Query v5's `isLoading` is `true` whenever there's no cached data for the *current* key, and `ExpensesTab.tsx` gated its entire render on `isLoading`.
- **Fix:** Added `placeholderData: keepPreviousData` to the list query so the previous result set stays mounted while a new key fetches in the background, instead of unmounting into `TabSkeleton`.
- **Related:** [[Features]] (Expenses)

### Export button threw "Cannot read properties of undefined (reading 'export')" in production only

- **Status:** fixed
- **Found:** 2026-07-18
- **Area:** [[Frontend]] — `ExpensesTab.tsx`
- **Symptom:** Clicking Export in the deployed app threw immediately; worked fine in `vite dev`.
- **Root cause:** Not a stale deploy (verified by diffing the live production chunk against a fresh local build — identical). Vite's production bundler mis-transforms `const { blob, filename } = await import(...).then((m) => m.expenseService.export(...))` — its chunk-preload wrapper ends up destructuring `blob`/`filename` off the *module namespace* (which only has `expenseService` on it) instead of the `.then()` result, so `.expenseService` reads as `undefined` before `.export` is ever reached.
- **Fix:** Split the import resolution from the destructuring (`const { expenseService } = await import(...); const { blob, filename } = await expenseService.export(...)`) — verified by inspecting the compiled bundle before/after.
- **Related:** [[Features]] (Expenses)

## Open / known issues

> See also `docs/known-issues.md` for the maintained list of known drift/gaps in `docs/`.

- **Manual ledger POST route validates against the wrong enum values.** `/api/tenants/[id]/financial-ledger` only accepts `DEPOSIT/TOPUP/DEDUCTION/REFUND/CORRECTION`, none of which exist in the real `FinancialLedgerReason` Prisma enum. Left untouched as out-of-scope during the 2026-07 financial workspace redesign — worth fixing if that route is ever actually exercised.
- **No live-database audit done** for tenants with simultaneous Outstanding + Future Credit predating the future-credit-auto-consumption fix (`cf88ce94`). Needs an explicit user-run query.

## See also
- [[Features]] for which feature each bug affected
- [[Changelog]] for when fixes shipped
