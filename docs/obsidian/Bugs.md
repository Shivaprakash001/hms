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

### Cron renewal activation produced SIGNED agreements with no rent obligations

- **Status:** fixed
- **Found:** 2026-07-19
- **Area:** [[Backend]] — `agreement-lifecycle-service.ts` (`AgreementLifecycleService.activateScheduledRenewals`)
- **Symptom:** A renewal agreement activated by the daily lifecycle cron (effective-date-triggered, as opposed to tenant-signed) ended up `SIGNED` with zero `rent_obligations` rows — no rent was ever billed for that agreement until someone noticed and ran a manual repair script.
- **Root cause:** Two independent paths can transition a renewal draft `DRAFT → SIGNED`: `AgreementRenewalSigningService.signRenewalAgreement` (manual, tenant e-signs) and `AgreementLifecycleService.activateScheduledRenewals` (cron, effective-date arrives with no signature required). Only the manual path called `agreementRentScheduleService.generateForAgreementInTx` after marking the agreement `SIGNED`; the cron path never did, so it silently produced an agreement with no billing schedule.
- **Fix:** `activateScheduledRenewals` now calls `agreementRentScheduleService.generateForAgreementInTx(tx, draft.id)` inside the same transaction as the status transition (mirroring the manual path exactly), and calls `financialLifecycleService.notifyActivated(...)` post-commit for cache/SSE parity. The class-level doc-comment claiming the cron "must never create obligations" was narrowed to describe only the expiry-tracking walk, not `activateScheduledRenewals`, which intentionally mirrors manual signing's financial writes.
- **Tests:** `tests/agreement-renewal-activation.test.ts` — new case `"generates the rent schedule for the activated draft inside the same transaction"`.
- **Related:** [[Business-Rules]], [[Decisions]]

### Manual renewal signing did not enforce the unpaid security deposit check that cron activation already had

- **Status:** fixed
- **Found:** 2026-07-19
- **Area:** [[Backend]] — `agreement-renewal-signing-service.ts` (`AgreementRenewalSigningService.signRenewalAgreement`)
- **Symptom:** A tenant could e-sign a renewal agreement (manual path) even when the renewal's `SECURITY_DEPOSIT` top-up obligation was still `PENDING`/`PARTIAL` — the cron activation path already blocked this exact scenario (`RENEWAL_ACTIVATION_BLOCKED` event), but the manual signing path had no equivalent check.
- **Root cause:** The two activation paths (manual signing vs. cron) were built with different validation coverage — cron's `activateScheduledRenewals` queries for an unpaid `SECURITY_DEPOSIT` obligation on the draft before activating; `signRenewalAgreement` never did the equivalent query.
- **Fix:** Added the same `rent_obligations.findFirst({ obligation_type: "SECURITY_DEPOSIT", status: {in:["PENDING","PARTIAL"]}, is_superseded:false, agreement_id })` check inside `signRenewalAgreement`'s transaction, right after the existing move-out check. Throws a new `SECURITY_DEPOSIT_UNPAID` (409) `AgreementRenewalSigningError` before any status mutation, matching the structured-error pattern already used for the other five precondition checks in this method.
- **Tests:** `tests/agreement-renewal-signing-service.test.ts` — new cases `"blocks signing when an unpaid security deposit obligation exists..."` and `"allows signing when there is no unpaid security deposit obligation"`. Also fixed a latent gap in `tests/agreement-rules-snapshot.test.ts`'s separate `mockPrisma` (missing a `rent_obligations` mock entirely — surfaced by this change since it's the first test to exercise that code path against that particular mock).
- **Related:** [[Business-Rules]], [[Decisions]]

### Cron renewal activation had no transition safeguards, and two renewal chain-mutation call sites could race into an inconsistent state

- **Status:** fixed
- **Found:** 2026-07-19
- **Area:** [[Backend]] — `agreement-lifecycle-service.ts` (`activateScheduledRenewals`), `renewal-offer-service.ts` (`acceptOffer`)
- **Symptom:** Cron activation (`activateScheduledRenewals`) could activate a renewal draft even when its predecessor was no longer in a renewable status (e.g. `TERMINATED`/`VOID`), even when the tenant had an active move-out request in progress, or even when the draft's own lifecycle metadata (rent/duration/dates) was incomplete — none of these were checked, even though the sibling manual-signing and manual-draft-creation services already enforce all three. Separately, `RenewalOfferService.acceptOffer` checked `offer.status !== "SENT"` *before* opening its transaction (a stale read) and linked the predecessor → successor via an `updateMany` whose `.count` was never checked — a losing concurrent acceptance would silently create an orphaned, unlinked successor `Agreement` instead of failing.
- **Root cause:** Both `activateScheduledRenewals` and `acceptOffer` were the two remaining call sites in this subsystem that predate the locked-read + conditional-`updateMany`-with-count-check pattern already established by `agreement-renewal-signing-service.ts` and `agreement-renewal-service.ts` (`SELECT ... FOR UPDATE`, then a conditional `updateMany`, then a count check that throws on mismatch). Both used unconditional `update()` calls or an unchecked `updateMany()`, so a concurrent writer touching the same predecessor/draft pair between the initial read and the write could silently corrupt the renewal chain.
- **Fix:** `activateScheduledRenewals` now checks (in order) predecessor renewability (`isCurrentAgreementStatus`), an active move-out request, and `assertAgreementLifecycleComplete` on the draft — logging `RENEWAL_ACTIVATION_BLOCKED` and skipping, same as the existing unpaid-deposit block, rather than throwing. Its transaction now acquires `SELECT ... FOR UPDATE` locks on both the predecessor and draft rows, and both status-mutating writes became conditional `updateMany` calls with a `.count !== 1` check that throws (rolling back the transaction) if the chain changed since the pre-transaction read. `RenewalOfferService.acceptOffer` now acquires the same lock on the predecessor, re-reads the offer status fresh inside the transaction (closing the TOCTOU window), and checks the predecessor-link `updateMany`'s count, throwing `CONFLICT: A renewal was already accepted for this agreement` on a losing race instead of silently proceeding.
- **Tests:** `tests/agreement-renewal-activation.test.ts` — new cases for predecessor-not-renewable, active-move-out, and concurrent-chain-change (updateMany count 0). `tests/renewal-offer-service.test.ts` — new cases for the orphaned-successor race and the in-transaction status re-check.
- **Related:** [[Business-Rules]], [[Decisions]]

## Open / known issues

> See also `docs/known-issues.md` for the maintained list of known drift/gaps in `docs/`.

- **Manual ledger POST route validates against the wrong enum values.** `/api/tenants/[id]/financial-ledger` only accepts `DEPOSIT/TOPUP/DEDUCTION/REFUND/CORRECTION`, none of which exist in the real `FinancialLedgerReason` Prisma enum. Left untouched as out-of-scope during the 2026-07 financial workspace redesign — worth fixing if that route is ever actually exercised.
- **No live-database audit done** for tenants with simultaneous Outstanding + Future Credit predating the future-credit-auto-consumption fix (`cf88ce94`). Needs an explicit user-run query.

## See also
- [[Features]] for which feature each bug affected
- [[Changelog]] for when fixes shipped
