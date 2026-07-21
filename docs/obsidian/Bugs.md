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

### iPhone Safari auto-zoomed into every form field (Add Expense / Add Tenant / others)

- **Status:** fixed
- **Found:** 2026-07-21
- **Area:** [[Frontend]] — `src/styles/globals.css`
- **Symptom:** On an iPhone, tapping any input in Add Expense / Add Tenant (and other forms) zoomed the page in and would not zoom back out, so every field entry left the owner pinch-zooming out repeatedly and the mobile layout felt broken.
- **Root cause:** iOS Safari auto-zooms into any focused `input`/`select`/`textarea` whose *computed* font-size is below 16px, and does not restore the zoom afterward. Our form fields default to Tailwind `text-sm` (14px), so every field triggered it. (The modal being a bottom-sheet vs full-screen is unrelated — the trigger is font-size, not modal size.)
- **Fix:** An **unlayered** `@media (max-width: 639.98px)` rule in `globals.css` forces `input`/`select`/`textarea` (except checkbox/radio/range) to 16px below the `sm` breakpoint. Being unlayered, it outranks Tailwind's layered `text-sm`/`text-xs` utilities without `!important`. Fixes every form app-wide; desktop keeps its denser 14px.
- **Related:** [[Frontend]], [[Changelog]]

### Payment reversals were tagged "Payment Received" in the activity feed

- **Status:** fixed
- **Found:** 2026-07-21
- **Area:** [[Backend]] — `financial-timeline-service.ts` / [[Frontend]] — `financialColors.ts`, `FinancialActivityCard.tsx`
- **Symptom:** After reversing a payment (Correct Payment → Reverse), the reversal showed in the tenant Activity feed with the same "Payment Received" tag (green, banknote icon) as a real payment, and its body read `₹-8,500 paid via ADVANCE_ADJUSTMENT` — a negative amount next to the word "paid." A reversal was visually indistinguishable from money coming in.
- **Root cause:** A reversal is written as a `payments` row with negative `amount_paid` and `reference_number = "REVERSAL:<originalId>"`, but the timeline emitted it as an ordinary `PAYMENT_RECORDED` event carrying no reversal signal, and `getEventDisplay` mapped every `PAYMENT_RECORDED` → "Payment Received" regardless of sign. The card also showed `Math.abs(amount)`, hiding the negative.
- **Fix:** `financial-timeline-service.ts` now classifies reversal rows (via the `REVERSAL:` reference / negative amount) and emits `metadata.is_reversal` + `reverses_payment_id` with a "Reversal of ₹X payment" summary, on both the tenant and obligation timelines. `getEventDisplay` branches to a distinct "Payment Reversed" tag (red tone, `RotateCcw` undo icon) and `FinancialActivityCard.tsx` renders the amount as signed `-₹X`. New test `tests/integration/timeline-reversal-tag.test.ts`.
- **Related:** [[Features]] (Correct Payment (Reverse / Transfer)), [[Changelog]]

### Change Rent left `tenants.monthly_rent` stale after a successful change

- **Status:** fixed
- **Found:** 2026-07-21 (task review of the Change Rent feature)
- **Area:** [[Backend]] — `rent-change-service.ts` / [[Frontend]] — `ChangeRentModal.tsx`
- **Symptom:** After a successful Change Rent, reopening the modal showed the OLD rent as "Current rent" even though the change had succeeded server-side (agreement was correctly repriced).
- **Root cause:** `applyRentChangeInTx` updated `agreement.contract_rent` but never touched `tenants.monthly_rent`, and the frontend's "Current rent" display is sourced from `tenant.monthly_rent` (the page never loads `agreement.contract_rent`).
- **Fix:** `applyRentChangeInTx` now also updates `tenants.monthly_rent` in the same transaction, reusing the `tenantContractSync` pattern already established by renewal activation (`renewal-activation-engine.ts`). New test in `tests/integration/rent-change-service.test.ts` asserts `tenants.monthly_rent` reflects the new rent after the call.
- **Related:** [[Features]] (Change Rent), [[Business-Rules]]

### Change Rent's frontend affected-count preview can silently diverge from the backend's real repricing count

- **Status:** fixed (surfaced, not prevented — see note)
- **Found:** 2026-07-21 (task review of the Change Rent feature)
- **Area:** [[Frontend]] — `ChangeRentModal.tsx`
- **Symptom:** None directly observable pre-fix — a silent undercount. The modal's pre-submit "N installments will change" preview is computed client-side by filtering `upcomingObligations` on net `paid === 0`. The backend's actual safety guard is stricter: zero payment *records* (`payments.length === 0`), not net-zero-paid. After a Payment Reversal correction (a different, already-shipped feature — reverses a payment via an offsetting second payment row, netting paid back to 0), an obligation can have net `paid === 0` while still carrying 2 payment rows. Such an obligation still shows up in the frontend's dropdown/preview count, but the backend correctly skips it — undercounting relative to what the owner was shown, with no visible discrepancy.
- **Root cause:** `getTenantDues()` (the source of `upcomingObligations`) only exposes net paid/outstanding, not raw payment-row counts, so the frontend cannot replicate the backend's exact guard.
- **Fix (scoped):** `ChangeRentModal.tsx` now captures the `RentChangeResult` returned by `tenantService.changeRent(...)` and shows the real server-reported `obligationsUpdated` count on its success screen, instead of only ever showing the pre-submit client-computed preview. This does not prevent the discrepancy (would require exposing raw payment-row counts through `getTenantDues()`, out of scope) — it makes any divergence visible to the owner after the fact.
- **Related:** [[Features]] (Change Rent, Correct Payment (Reverse / Transfer)), [[Business-Rules]]

### Change Rent modal was unsubmittable whenever a tenant had zero upcoming unpaid rent installments

- **Status:** fixed
- **Found:** 2026-07-21 (final whole-branch review)
- **Area:** [[Frontend]] — `ChangeRentModal.tsx`
- **Symptom:** For an ACTIVE tenant with zero upcoming, zero-payment RENT obligations, the modal's empty-state copy told the owner "Rent will still be updated on the agreement," but `effectiveFromMonth` initialized to `''` and there was no UI to set it in that case. `handleContinue`'s `if (!effectiveFromMonth)` guard (and the backend route's own required-field validation) meant the modal could never actually be submitted — a dead end that contradicted its own reassuring copy.
- **Root cause:** `effectiveFromMonth` was only ever derived from `upcomingObligations[0]?.rent_month`; when that list was empty there was no fallback, even though the backend (`applyRentChangeInTx`) always accepts a real month and is perfectly willing to update `agreement.contract_rent`/`tenants.monthly_rent` with zero obligations in scope.
- **Fix:** Added a `nextMonthStartIso()` helper that defaults `effectiveFromMonth` to the first day of next calendar month (UTC) when there are no upcoming obligations to derive it from, and corrected the empty-state copy to name that actual month instead of a vague promise. No new month-picker UI was added — the modal still always derives the month from a real obligation when one exists.
- **Related:** [[Features]] (Change Rent), [[Business-Rules]]

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

### "Correct Payment" button could reverse only a fraction of a grouped settlement card's amount

- **Status:** fixed
- **Found:** 2026-07-20 (task review of the new Correct Payment (Reverse) UI)
- **Area:** [[Frontend]] — `FinancialActivityCard.tsx`, `groupFinancialActivity.ts`
- **Symptom:** For a `PAYMENT_GROUP_SETTLED` Financial Activity card (one tenant payment/settlement split across several obligations via FIFO allocation, folded into a single card), clicking "Correct Payment" would reverse only the first underlying `payments` row, while the modal's copy ("Reverses this payment and re-opens the obligation it settled") implied the whole amount shown on the card was undone.
- **Root cause:** `groupFinancialActivity.ts` sets a grouped entry's `receiptPaymentId` to `payments[0]?.references.payment_id` — an arbitrary first payment id, used so "View Receipt" has *some* valid receipt to open. The "Correct Payment" button reused the same `receiptPaymentId` truthiness check as "View Receipt," but the backend's `PAYMENT_REVERSAL` handler operates on exactly one `payments.id` and its one `obligation_id` — it has no concept of "the whole group." Traced the settlement path (`backend-next/src/services/payments/settlement-engine.ts`, `financial-timeline-service.ts`) and confirmed a FIFO settlement across N obligations creates N genuinely distinct `payments` rows sharing one `payment_group_id`, so `payments.length > 1` reliably means `receiptPaymentId` covers only part of the card's total.
- **Fix:** Gated the "Correct Payment" button on a new `canCorrectPayment = payments.length <= 1` condition (in addition to the existing `receiptPaymentId && onCorrectPayment` check) in `frontend-v2/src/features/tenants/components/financial/FinancialActivityCard.tsx`. "View Receipt" is unchanged — a receipt for any one payment id in the group remains valid to view. Correcting a multi-payment/grouped settlement (whole-group or per-row) is out of scope for this fix and remains a fast-follow; there is currently no UI path to correct such a card at all (by design — no misleading partial reversal is offered in its place).
- **Related:** [[Features]] (Correct Payment (Reverse / Transfer)), [[Business-Rules]]

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

### `RenewalOfferService.expireStaleOffers()` was fully implemented but never called from anywhere

- **Status:** fixed
- **Found:** 2026-07-19
- **Area:** [[Backend]] — `renewal-offer-service.ts` (`expireStaleOffers`), `agreement-lifecycle-service.ts` (`processDailyLifecycle`)
- **Symptom:** Renewal offers past their `offer_expires_at` never transitioned to `EXPIRED` — they stayed `DRAFT`/`SENT` indefinitely. The method's own docstring claimed "Called by lifecycle cron," but grep confirmed zero callers anywhere in the codebase.
- **Root cause:** The method was implemented (bulk `updateMany` marking stale `DRAFT`/`SENT` offers `EXPIRED`) but never wired into `AgreementLifecycleService.processDailyLifecycle`, the one cron entry point this subsystem has.
- **Fix:** `processDailyLifecycle` now calls `renewalOfferService.expireStaleOffers()` once per run (wrapped in try/catch, non-fatal, consistent with the existing WhatsApp-template-health-check error handling in the same method), and records the count on a new `AgreementLifecycleSummary.offers_expired` field.
- **Also fixed while touching this test file:** `tests/agreement-renewal-activation.test.ts` had two `vi.mock(...)` calls using paths relative to the *test* file (`"./agreement-renewal-notification-service"`) instead of the actual module's location (`src/services/tenants/`) — Vitest resolves relative mock paths against the file calling `vi.mock`, so neither mock ever intercepted the real module. `processDailyLifecycle` tests were silently making real WhatsApp Business API calls (visible as `whatsapp.template_health.fetch_failed` errors in stderr, swallowed by the method's own try/catch) instead of using the mocked no-op. Fixed both to use the `@/src/services/tenants/...` path alias, matching every other correctly-working mock in the same file.
- **Tests:** `tests/agreement-renewal-activation.test.ts` — new case `"expires stale renewal offers as part of the daily lifecycle run"`.
- **Related:** [[Business-Rules]]

### Renewal WhatsApp reminders permanently skip a stage if the daily cron misses its exact trigger day

- **Status:** fixed
- **Found:** 2026-07-19
- **Area:** [[Backend]] — `renewal-status-service.ts` (`determineRenewalStage`)
- **Symptom:** If the daily lifecycle cron didn't run on the exact day an agreement hit 30/15 days-until-expiry or 7/`grace_period_days` days-overdue (an outage, a deploy window, a transient failure), that reminder stage was never sent for that agreement — by the next cron run, the day counter had moved past the exact value the equality check required.
- **Root cause:** `determineRenewalStage` used `===` exact-day matching for all four milestone stages, with no notion of "already past this point but haven't sent it yet."
- **Fix:** Converted the four milestone checks to inclusive threshold bands (`30_DAY_REMINDER`: 16-30 days left, `15_DAY_REMINDER`: 1-15, `7_DAY_OVERDUE`: ≥7 days overdue, `30_DAY_CRITICAL`: ≥grace-period days overdue, checked first). Safe because delivery-layer idempotency (`whatsapp_logs.idempotency_key`, unique per `(stage, agreementId)`) already guarantees exactly-once send even if a stage matches on several consecutive runs. `EXPIRY_DAY_ALERT` and `EXPIRED_RENT_OVERDUE` were deliberately left as exact/state checks — see [[Decisions]] ADR-014 for why broadening them would have collided with the existing `EXPIRED_RENT_OVERDUE` fallback.
- **Tests:** `tests/whatsapp-renewal-notification.test.ts` — new cases for a caught-up 30-day reminder, 15-day-over-30-day priority once inside the tighter window, and a caught-up 7-day-overdue alert.
- **Related:** [[Business-Rules]], [[Decisions]]

### Tenant Financials "Payment Due Soon" card showed the amount from one obligation and the due date from a different, already-paid one

- **Status:** fixed
- **Found:** 2026-07-20
- **Area:** [[Frontend]] — `frontend-v2/src/portal/pages/TenantFinancialsPage.tsx` (`financialHealth` useMemo, ORANGE state)
- **Symptom:** A tenant whose current billing cycle was fully paid, but who had a small early/extra payment land on a *future*, not-yet-due obligation (flipping it from `UPCOMING` to `PARTIAL`), saw the home dashboard's Rent Status card and the Financials page's hero card both report "payment pending" with an amount — expected, since that obligation genuinely has an outstanding balance — but the Financials page's due-date subtext ("Due 5 Jul 2026") referenced the already-fully-paid current cycle, not the obligation the displayed amount actually came from (which was due 5 Aug 2026). Confirmed against live data: `rent_obligations` showed June and July rent `PAID` in full, and August rent `PARTIAL` (₹1 of ₹8,500 paid, due 2026-08-05) — the ₹8,499 "Amount Due" was correctly August's, but the date shown belonged to July.
- **Root cause:** The ORANGE-state subtext sourced its due date from `currentInstallment` — a locally-computed match for "the installment whose `period_start`/`period_end` contains today" — while the amount above it came from `readModel.current_payable_amount` (the canonical `FinancialReadModelService` sum of all non-`UPCOMING` outstanding obligations, regardless of due date). These two are not the same obligation whenever today falls inside an already-settled cycle but a *different*, later obligation is the one actually carrying the outstanding balance — the code's own comment stated the card should be "sourced from the canonical FinancialReadModel... not recomputed from local due-date math," but the subtext line did exactly that.
- **Fix:** The subtext now finds the earliest `due_date` among `readModel.items` filtered to the same condition `current_payable_amount` itself is summed over (`legacy_status !== 'UPCOMING' && outstanding > 0`) — the date now always belongs to the same obligation(s) the displayed amount is drawn from.
- **Note:** The underlying "why is anything pending at all" business question — a `PARTIAL` obligation counts toward `current_payable_amount` "regardless of due date" per that field's own documented contract, even when the payment landing on it was for a small/incidental amount well before the obligation's due date — was left as-is; changing that semantic is a deliberate financial-logic call (it's a shared field consumed by both owner and tenant surfaces) and was out of scope for this display-only fix.
- **Related:** [[Business-Rules]]

### Gateway rent payments that allocate into a SECURITY_DEPOSIT/ADVANCE obligation false-positive a settlement invariant violation and roll back despite the provider having captured the charge

- **Status:** fixed
- **Found:** 2026-07-20
- **Area:** [[Backend]] — `payment-service.ts` (`validatePaymentAttemptSettlementInTx`), `settlement-engine.ts`
- **Symptom:** A tenant paid via Razorpay; Razorpay confirmed the charge (payment ID present, funds captured), but `POST /api/payments/verify` returned 500, and neither the tenant nor owner UI showed any record of the payment — because there genuinely was none: the settlement transaction had rolled back in full. Confirmed against live data (`payment_attempts` table): two attempts stuck in `PROCESSING` with real `provider_transaction_id`s and no corresponding `payments` or `tenant_financial_ledger` rows. Production runtime error logs (Vercel) pinpointed the exact exception both times: `INVARIANT_VIOLATION: Ledger balance inconsistency. ... Expected Ledger Change: ₹0.00, Actual Ledger Change: ₹100.00`.
- **Root cause:** `settlement-engine.ts` writes a ledger `CREDIT` in two structurally different situations that both count as "money credited for this attempt," but the transaction's own post-settlement self-check (`validatePaymentAttemptSettlementInTx`) only recognized one of them: (1) a future-rent-credit topup, keyed directly by `attemptId` (the `futureCredit > 0` branch) — the one the validator's query (`reference_id: attemptId`) actually found; and (2) a security-deposit/advance "collected" marker, deliberately keyed by the individual `payments` row it accompanies (`referenceType: "PAYMENT"`, `referenceId: payment.id`) — by design (per that branch's own comment: "the obligation being marked PAID/PARTIAL tracks that it was billed, while this credit tracks that it was collected"). The validator's single shared `totalLedgerCredited` sum only ever found shape (1), so shape (2) was invisible to it — a gateway payment that allocated into a deposit/advance obligation always produced `totalLedgerCredited = 0`, even though the tenant's real ledger balance had genuinely moved by the full captured amount, tripping invariant #3 and rolling back an otherwise entirely correct settlement.
- **Fix:** Split the single shared ledger-credit sum into two: `unallocatedLedgerCredited` (shape 1 only, `reference_id: attemptId`) feeds invariant #1 ("captured = obligation allocations + *unallocated* ledger credit" — shape 2 must NOT be added here, since it mirrors money already counted in `totalAllocated` via the same `payments` row, and adding both would double-count the same rupee), while `totalLedgerBalanceMovement` (shape 1 + shape 2) feeds invariant #3 ("ledger balance actually moved by X" — this one needs the deposit "collected" marker too, since it genuinely does move the real balance).
- **Tests:** `tests/payment-allocation-invariant.test.ts` — new case `"settles a gateway Rent payment that fully allocates into a SECURITY_DEPOSIT obligation without a false invariant violation"`; confirmed it fails with the pre-fix code (same `INVARIANT_VIOLATION: Ledger balance inconsistency` as production) and passes after. Also hardened the test file's `tenant_financial_ledger.findMany` mock to understand `OR`/`reference_id: { in: [...] }`, which the fixed query now uses.
- **Not yet done — needs a deliberate follow-up, not silently retried:** two real production attempts (₹100 each, `a59b3ab5-...` and `74b7a5e3-...` on tenant `f73ad88d-...`) are stuck `PROCESSING` with real Razorpay charges and zero internal record. `POST /api/payments/reconcile` (owner-only, `paymentService.reconcilePendingAttempts`) already has a "release stale PROCESSING lock" pass designed for exactly this — once this fix is deployed, an owner should trigger reconciliation for these two attempt IDs so they settle correctly instead of remaining stuck.
- **Related:** [[Business-Rules]]

### `reverseObligationPayment` (Reverse/Transfer Payment corrections) wrote a `LEDGER_CORRECTION` debit for RENT reversals with no matching original credit, eating into unrelated future-rent-credit

- **Status:** fixed
- **Found:** 2026-07-20 (final whole-branch review of the payment-corrections work)
- **Area:** [[Backend]] — `payment-correction-shared.ts` (`reverseObligationPayment`), used by both `payment-reversal-handler.ts` and `payment-transfer-handler.ts`
- **Symptom:** Reversing an ordinary RENT payment via the Reverse Payment or Transfer Payment correction handlers silently reduced the tenant's `tenant_financial_ledger` balance (and therefore `future_rent_credit`/`available_rent_advance`, see `tenant-financial-ledger-service.ts`'s `_buildBalanceResponse`) by the reversed amount — even when that RENT payment had never itself produced a ledger credit. A tenant who separately held real future-rent-credit from an unrelated transaction had that credit silently eaten into by the reversal.
- **Root cause:** `reverseObligationPayment` unconditionally wrote a `LEDGER_CORRECTION` debit for the full reversed amount regardless of the obligation's type. Per `settlement-engine.ts` (~line 332), a payment allocation only writes a ledger CREDIT (`reason: "DEPOSIT"`, `referenceType: "PAYMENT"`) when `obligation_type === "ADVANCE" || obligation_type === "SECURITY_DEPOSIT"` — a RENT (or any other type) allocation writes no ledger entry at all. So reversing a RENT payment had no matching original credit to undo; the debit was pure corruption of an unrelated balance.
- **Fix:** Added the identical `obligation_type === "ADVANCE" || obligation_type === "SECURITY_DEPOSIT"` gate around the debit in `reverseObligationPayment` (`obligation` was already loaded in-function, no new query needed) — RENT/other reversals now skip the ledger debit entirely, restoring only the obligation's outstanding balance. Also updated `computeImpact()` in both `payment-reversal-handler.ts` and `payment-transfer-handler.ts` with the same condition, so the correction preview no longer promises a ledger entry that execute won't actually create.
- **Tests:** `tests/integration/payment-reversal-handler.test.ts` — new/updated cases: RENT reversal asserts no ledger row is created; a SECURITY_DEPOSIT reversal still asserts the debit fires; a dedicated test credits a tenant with an unrelated future-rent-credit TOPUP, reverses an unrelated RENT payment, and asserts the balance is untouched. `tests/integration/payment-transfer-handler.test.ts`'s preview assertion updated to match (its test obligation is RENT-type, so the preview's `ledgerEntries` is now empty rather than length 1).
- **Related:** [[Business-Rules]] (Correction Cases — Payment corrections), [[Changelog]]

## Open / known issues

> See also `docs/known-issues.md` for the maintained list of known drift/gaps in `docs/`.

- **Manual ledger POST route validates against the wrong enum values.** `/api/tenants/[id]/financial-ledger` only accepts `DEPOSIT/TOPUP/DEDUCTION/REFUND/CORRECTION`, none of which exist in the real `FinancialLedgerReason` Prisma enum. Left untouched as out-of-scope during the 2026-07 financial workspace redesign — worth fixing if that route is ever actually exercised.
- **No live-database audit done** for tenants with simultaneous Outstanding + Future Credit predating the future-credit-auto-consumption fix (`cf88ce94`). Needs an explicit user-run query.

## See also
- [[Features]] for which feature each bug affected
- [[Changelog]] for when fixes shipped
