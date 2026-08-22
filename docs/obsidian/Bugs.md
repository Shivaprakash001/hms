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

### Owner "Revise" button was dead on declined renewal offers, and expired offers had no action at all

- **Status:** fixed
- **Found:** 2026-08-22
- **Area:** [[Backend]] / [[Frontend]]
- **Symptom:** Two dead ends in the owner Renewal Pipeline's Offers tab. (1) An offer the tenant let expire rendered **no action buttons whatsoever** — once `expireStaleOffers` flipped it to `EXPIRED`, the owner's only way forward was generating a brand-new offer from the Expiring Stays tab. (2) `RenewalOffersList.tsx` had always rendered **Revise** on `DECLINED` offers, but clicking it failed with `BAD_REQUEST: Cannot revise offer in status DECLINED`.
- **Root cause:** (1) The offer row's action block only handled `DRAFT` (Send), `DRAFT|SENT|DECLINED` (Revise) and the Workspace link — `EXPIRED` matched nothing, and no resend path existed in the service or API at all. (2) `reviseOffer`'s status guard allowed only `["DRAFT", "SENT"]`, which never matched the statuses the UI actually offered the button on. The two halves of the same feature were written against different status sets.
- **Fix:** New `renewalOfferService.resendOffer` + `POST /api/agreements/renewal-offers/[id]/resend` — re-sends the same offer row on the same terms with a fresh window (see [[Business-Rules]] — *Agreement renewal — resending a lapsed offer*). `reviseOffer`'s guard widened to `["DRAFT", "SENT", "DECLINED", "EXPIRED"]`, which is what the UI has always assumed. Owner UI gained a **Resend Offer** button (Offers Pipeline list *and* the Renewal Workspace's Offer History tab), an explicit expiry/respond-by line on each offer row, and an `Expired` pipeline filter chip — `EXPIRED` was already flowing through `computePipelineStatus` into the counts, but had no chip to select it. 12 regression tests in `tests/renewal-offer-service.test.ts`.
- **Note on scope:** the resend guard also treats an offer past `offer_expires_at` but still marked `DRAFT`/`SENT` as expired, because `expireStaleOffers` runs only on the daily lifecycle job — such an offer is already rejected by `acceptOffer`, so it was a third (time-window-dependent) way to reach the same dead end.
- **Related:** [[Features]] (Resend Expired Renewal Offer) · [[APIs]] · [[Business-Rules]] · [[Changelog]]

### Owner "Send Reminder" silently reached nobody for tenants with an older cancelled charge

- **Status:** fixed
- **Found:** 2026-08-05 (owner report: "not able to send reminders, neither are cron reminders reaching tenants and their guardians")
- **Area:** [[Backend]] — `src/services/payments/reminder-service.ts::sendManualReminder`
- **Symptom:** For certain tenants the owner's one-tap reminder reported success — the API returned `success: true`, an in-app `reminder_logs` row was written, and the dashboard toast said the reminder was sent — but **no WhatsApp message ever reached the tenant or their guardian**. Reproduced live on 7 of 57 tenants with outstanding dues (e.g. tenant `shiva`, ₹8,500 overdue since 2026-07-05, whose guardian had never been reachable).
- **Root cause:** A filter mismatch between obligation *selection* and delivery *acceptance*. `sendManualReminder` picked the target with `status: { notIn: ["PAID","WAIVED"] }` ordered by `due_date asc`, and did not filter `is_superseded`. `PaymentStatus` also includes `CANCELLED` and `DRAFT`, so any older cancelled/draft/superseded charge won that ordering and became "the oldest unpaid obligation". `whatsappReminderDeliveryService.sendRentReminder` then re-checks the obligation against its own stop rule (`PAID`/`SETTLED`/`CANCELLED`/`WAIVED`/`is_superseded`) and correctly refuses, returning `skipped: true, reason: "SETTLED_OR_CANCELLED"`. Because the reminder's `sent` count is computed from `in_app.sent || email.sent || whatsapp.sent`, the in-app log alone made the whole call report success — the WhatsApp skip never surfaced to the owner. The condition is permanent, not transient: a stale ₹100 cancelled charge from 2026-07-01 shadowed the real dues on every attempt, so those tenants and their guardians could never be reminded.
- **Why guardians were hit hardest:** guardian escalation lives *inside* the WhatsApp delivery path (`whatsapp-reminder-delivery.ts`, tenant + guardian on `daysOverdue >= 3`) and there is no guardian email or SMS channel. Any failure that stops the WhatsApp send therefore removes the guardian's only route entirely.
- **Fix:** Selection now mirrors the delivery-side stop rule — `status: { notIn: ["PAID","WAIVED","CANCELLED","DRAFT"] }` plus `is_superseded: false` — with a comment tying the two together so they aren't allowed to drift again. Regression test in `tests/manual-reminder-service.test.ts` asserts the selection filter, so a future loosening fails the suite.
- **Related:** [[Business-Rules]] (reminder escalation), [[Backend]], [[Changelog]]

> [!note] Still open, found during the same investigation
> - `renewal_offer_sent_v1` fails at Meta with error `132001` — *"Template name does not exist in the translation"* (3 failures on 2026-08-05). Renewal offers, not rent reminders. The template is referenced in code but appears not to be approved/published on the WhatsApp Business account. See [[TODO]].
> - The `sent` count in `sendManualReminder` treats an in-app log as success, so a total WhatsApp failure can still surface to the owner as "reminder sent". The channel detail *is* returned in `channels`, but the summary figure masks it. Not changed here — it would alter the owner-facing success semantics of the endpoint.

### Tenant got a 409 on every attempt to sign an accepted renewal (`AGREEMENT_LIFECYCLE_INCOMPLETE`)

- **Status:** fixed
- **Found:** 2026-07-31 (direct user report: "409 on the tenant side while accepting the renewal agreement")
- **Area:** [[Backend]] — `renewal-offer-service.ts::acceptOffer` / `::generateOffer` / `::generateBulkOffers`
- **Symptom:** The tenant could accept a renewal offer fine, but the next step — **Sign & Finalize Renewal** on `/tenant/renewal` — always failed with HTTP 409. The renewal was then permanently stuck: nothing in either the tenant or owner UI could clear it. Confirmed on live data (`Agreement 78e37b20`, predecessor `7c15aa18`).
- **Root cause:** `acceptOffer` built the successor agreement by copying the offer's `proposed_*` columns straight onto the new row, and **no code path ever populated `proposed_payment_frequency`** — `generateOffer` defaulted it to `null` (no caller sends it; the owner UI has no such field) and `generateBulkOffers` hardcoded `proposed_payment_frequency: null`. The successor was therefore created with `contract_payment_frequency = NULL`. Nothing validated that at accept time, so acceptance succeeded. Signing then re-validated the successor through `renewal-readiness-engine.evaluateActivationReadiness` → `checkLifecycleComplete` → `assertAgreementLifecycleComplete`, which requires `contract_payment_frequency` — producing `AgreementRenewalSigningError("AGREEMENT_LIFECYCLE_INCOMPLETE")`, whose `status = 409`. Deterministic, not a race: **every** offer-accepted renewal hit it. The same NULL also silently blocked cron auto-activation, which logs `RENEWAL_ACTIVATION_BLOCKED` and skips (`agreement-lifecycle-service.ts`), so the renewal would not have self-healed on its effective date either.
- **Why it only bit the offer path:** the parallel manual-draft path (`agreement-renewal-service.ts::createRenewalDraft`) resolves the same terms via `resolveContractSnapshot` — inheriting from the predecessor agreement and its `content_snapshot` — *and* validates completeness at creation time via `evaluateCreationReadiness`. The offer path did neither. See [[Business-Rules]] for the inheritance rule this establishes.
- **Fix:** Three layers.
  1. `getAgreementContract` now also returns `maintenance_type` / `payment_frequency` (with `content_snapshot` fallbacks, mirroring `resolveContractSnapshot`), and both `generateOffer` and `generateBulkOffers` inherit them from the predecessor when the owner doesn't propose new ones.
  2. `acceptOffer` resolves the successor's terms from the offer *falling back to the predecessor*, then runs `getMissingAgreementLifecycleFields` **before** creating the row — so a lifecycle-incomplete successor can no longer be created at all. If a term genuinely can't be resolved, acceptance now fails with a `CONFLICT:` message naming the missing field, instead of deferring an unactionable 409 to the signing step. This layer also repairs already-issued offers still sitting in `SENT`.
  3. `app/api/tenant/renewal-offer/[id]/accept/route.ts` maps `CONFLICT:` → 409 (it previously fell through to a 500, so the pre-existing "A renewal was already accepted for this agreement" guard was also reporting the wrong status).
- **Data repair:** `migrations/062_backfill_renewal_successor_contract_terms.sql` backfills already-created **DRAFT** successors from their predecessor. Signed/active agreements are deliberately untouched. Verified read-only against live data: the stuck draft goes from `missing: [contract_payment_frequency]` → `[]`, i.e. 409 → signs OK.
- **Regression tests:** `tests/renewal-offer-service.test.ts` — offer generation (single + bulk) inherits both terms; `acceptOffer` produces a successor that passes `getMissingAgreementLifecycleFields`; a legacy NULL-term offer still yields a complete successor; an unresolvable offer is refused rather than accepted. Confirmed all four fail against the pre-fix service.
- **Related:** [[Business-Rules]], [[Changelog]], [[APIs]], [[Features]], [[Decisions]] ADR-028

### Repeated frequency switches crashed with a unique-constraint error, and (once fixed) could leave a mixed-cadence schedule live

- **Status:** fixed
- **Found:** 2026-07-22 (direct user report, live testing on tenant "shiva": switching Quarterly → Monthly → Quarterly again crashed with `Unique constraint failed on the fields: (agreement_id, rent_month, obligation_type)`)
- **Area:** [[Backend]] — `billing-transition-service.ts::ownerInitiateChange`
- **Symptom:** A third frequency switch on the same tenant, landing back on a `rent_month` already used by an earlier (now superseded) switch, threw a raw Prisma constraint error instead of succeeding.
- **Root cause:** `(agreement_id, rent_month, obligation_type)` is a hard unique index with no `is_superseded` filter — a dead, already-superseded row still permanently blocks a fresh `create()` for that same month. Once fixed by reviving the stale row instead of inserting a new one, a second latent bug surfaced: the supersede step only cleared obligations with `due_date >= effectiveFrom`, so a prior switch to a shorter cadence (with an earlier `effectiveFrom`) could leave its earliest rows un-superseded when switching to a longer cadence — live obligations ended up mixing two different cadences' amounts.
- **Fix:** See ADR-027 — check for and revive (not blindly insert over) an existing row at each target `rent_month`; and supersede every live `UPCOMING` `RENT` row unconditionally (not filtered by `due_date`) before regenerating, since `UPCOMING` rows can never have real payments against them. New regression test exercises the exact reported 3-switch sequence.
- **Related:** [[Backend]], [[Changelog]], ADR-027

### Switching a tenant's billing frequency back to a shorter cadence failed with UNCLEAN_BILLING_PERIOD even when a later period was clean

- **Status:** fixed
- **Found:** 2026-07-22 (direct user report: switching tenant "shiva" (Sri Adithya Boys Hostel-1) from Quarterly back to Monthly failed — DevTools showed `UNCLEAN_BILLING_PERIOD` from `POST /tenants/:id/change-frequency`)
- **Area:** [[Backend]] — `billing-transition-service.ts::ownerInitiateChange`
- **Symptom:** The frequency change failed outright with no way to retry successfully, even though the underlying conflict (this month's rent already activated) would resolve itself the following month.
- **Root cause:** `getNextCleanBillingPeriodDate` computes exactly one candidate effective date — the next calendar boundary aligned to the requested frequency — with zero awareness of the tenant's actual obligations. `ownerInitiateChange` checked only that single candidate for overlap (ADR-023) and gave up immediately if it collided, even though later candidates might easily be clean.
- **Fix:** New `findCleanEffectiveFrom()` walks forward (same 36-month horizon as the existing date-picker) and actually tests each candidate period start against the real overlap check, returning the first one that's genuinely clean instead of just the first one chronologically. See ADR-026. New test confirms a colliding first candidate no longer fails the whole operation — it resolves to a later period instead.
- **Related:** [[Backend]], [[Changelog]], ADR-026

### Owner changed a tenant's billing frequency to Quarterly but the Charges tab kept showing unchanged monthly obligations

- **Status:** fixed
- **Found:** 2026-07-22 (direct user report with a screenshot: owner Tenant Profile Charges tab still listing "Jul 2026 rent (2)", "Aug 2026 rent (3)", "Sept 2026 rent (4)"... individually, ₹8,500 each, after the billing frequency had been changed to Quarterly)
- **Area:** [[Backend]] — `billing-transition-service.ts::ownerInitiateChange`
- **Symptom:** ADR-021 shipped owner-direct frequency changes with a disclosed limitation for agreement-based tenants (the change updates a setting but the already-generated monthly `rent_obligations` don't regroup). This report is that limitation actually being hit in practice — confusing, since the modal reported success.
- **Root cause:** `agreement-rent-schedule-service.ts::generateForAgreementInTx` pre-generates one `RENT` obligation per month for the tenant's full agreement duration, all at once, at signing time — `ownerInitiateChange` only updated `tenants.payment_frequency`/`tenant_billing_plans`, never touching those already-created rows.
- **Fix:** `ownerInitiateChange` now checks for an active agreement; if found, computes enough of the new frequency's periods to cover the remaining agreement term (`agreement.agreement_end_date`), and in the same transaction supersedes the not-yet-due `UPCOMING` `RENT` obligations and creates the new grouped ones — see ADR-024 for why this is safe (the generator it bypasses never re-runs for an already-signed agreement). New tests in `tests/billing-frequency-owner-initiate.test.ts` cover both the regrouping (6 monthly rows → grouped quarterly rows, old ones superseded) and the non-agreement no-op case (rolling generator already handles it, nothing to supersede).
- **Related:** [[Backend]], [[Changelog]], ADR-024

### Waive button silently disappeared (and Cancel wrongly appeared) for partially-paid obligations on the owner Tenant Profile

- **Status:** fixed
- **Found:** 2026-07-22 (direct user report with a screenshot: clicking Cancel on a `PARTIAL` ₹8,500 obligation with ₹5,000 remaining failed with "Cannot cancel an obligation that has payments. Use waiver instead" — but no Waive button was visible to use instead)
- **Area:** [[Frontend]] — `ObligationCard.tsx`
- **Symptom:** A regression introduced by the same-day Cancel/Waive dedup fix (see the changelog entry "stop showing both Cancel and Waive on the same obligation"). That fix made `canCancel`/`canWaive` mutually exclusive based on a computed `hasPayments` flag. On the owner Tenant Profile's Charges tab specifically, `hasPayments` always evaluated `false` regardless of the obligation's real payment history — so every `PARTIAL` obligation showed Cancel (wrong — it has payments, the backend correctly rejects it) and hid Waive (wrong — Waive was exactly the right, and only, valid action).
- **Root cause:** `hasPayments` was computed purely from `Boolean(o.payments && o.payments.length > 0)`. That's correct wherever the obligation object carries a full `payments[]` array — but the Charges tab's obligations come from `financial-service.ts::getTenantDues()`'s `TenantDueItem`, which only ever exposed an aggregate `paid: number`, never a raw `payments` array. `o.payments` was `undefined` on this data path from the start, silently defaulting `hasPayments` to `false` regardless of the obligation's actual state.
- **Fix:** `hasPayments` now falls back to `Number(o.paid_amount ?? o.paid ?? 0) > 0` when no `payments[]` array is present — the same signal the backend itself effectively uses (a `PARTIAL` obligation is definitionally one with `paid > 0`). No backend change needed; this was purely a frontend data-shape assumption that didn't hold across all of `ObligationCard`'s call sites.
- **Related:** [[Frontend]], [[Changelog]]

### Settlement allocation could pay a superseded (dead) obligation — real money, not just a display glitch

- **Status:** fixed
- **Found:** 2026-07-22 (direct user report: tenant "Harsha" at Sri Adithya Boys Hostel-1 showed two separate "Jun 2026 Rent" line items — ₹5,000 and ₹8,500 — in the Collect Now settlement preview; confirmed via psql against `rent_obligations`)
- **Area:** [[Backend]] — `financial-payment-facade.ts` (`receivePayment`, `applyAvailableCredits`, `previewSettlement`)
- **Symptom:** The settlement preview for a real payment showed two "Jun 2026 Rent" rows for the same tenant/month with different outstanding amounts, both being allocated toward and marked "Fully Paid." Only one of these represented real, current debt.
- **Root cause:** The tenant's June obligation had previously been corrected via the "Edit" flow (create replacement, mark original `is_superseded: true` — see [[Business-Rules]], Obligation Lifecycle). The replacement (`ee55a30e…`, ₹8,500, partially paid down to ₹5,000 outstanding) is the real, current obligation. The superseded original (`0dc30b10…`, ₹8,500, zero payments, `is_superseded: true`) should be permanently inert. Every other obligation-fetching query in the codebase filters `is_superseded: false` (13+ call sites across `billingRepository.ts`, `financial-service.ts`, `payment-service.ts`, `rent-change-service.ts`, `agreement-rent-schedule-service.ts`, `onboarding-financials-service.ts`, `onboarding-maintenance-repair-service.ts`) — but `financial-payment-facade.ts`'s three `rent_obligations.findMany` calls never did. Owner-facing totals (Outstanding/Overdue on the profile header) were unaffected — those go through `financialService.getTenantDues`, which does filter correctly — but **`receivePayment`, the function that actually executes a real payment allocation inside the transaction, did not**, meaning a real collected payment could be split across the live obligation and the dead superseded one, or the superseded one could independently be marked "PAID" for money that was never truly owed against it.
- **Fix:** Added `is_superseded: false` to all three `financial-payment-facade.ts` obligation queries, matching the established invariant everywhere else. New regression test in `tests/financial-engine-stabilization.test.ts` ("never allocates to a superseded obligation") creates exactly this fixture (a superseded PENDING obligation alongside a live one, both outstanding) and asserts a credit application allocates only to the live obligation. Ran `check:invariants` and `check:payment-production` (both clean) plus the full backend suite given this touches the core payment-allocation path.
- **Related:** [[Backend]], [[Business-Rules]], [[Changelog]]

### Public payment link pre-filled the entire remaining lease total (₹93,500 for 11 months) instead of what's actually due

- **Status:** fixed
- **Found:** 2026-07-22 (direct user report with a live screenshot of `sriadithyahostels.in/pay/<token>` showing "AMOUNT TO PAY ₹93500" with a breakdown listing all 11 remaining months of rent, Jul 2026 through May 2027)
- **Area:** [[Backend]] — `app/api/payments/pay/[token]/route.ts`
- **Symptom:** Opening a generic (not obligation-specific) payment link pre-filled the amount field with the tenant's entire remaining-lease rent total rather than what they actually owed right now, and the live "Payment Breakdown" preview then dutifully allocated that huge number across every future month, making the link look like it was demanding the whole lease paid upfront.
- **Root cause:** When the link wasn't hinted to one specific obligation (or that obligation was already `PAID`), the route fell back to `financialPaymentFacade.previewSettlement({..., amountRupees: 0}).total_outstanding` — which sums every obligation in `settlement-planner.ts`'s `PAYABLE_STATUSES` (`OVERDUE, PENDING, PARTIAL, UPCOMING`), i.e. literally every future month of rent through lease end, not just what's currently owed. This is the correct meaning for planner-internal use (settlement allocation needs to see everything payable) but wrong to pre-fill as "the amount you owe" on a payer-facing page.
- **Fix:** Replaced the fallback with `financialService.getTenantDues()`'s `items`, summing only obligations that are non-`UPCOMING` **and** due today or earlier — the same due-date-aware pattern used for the tenant portal's own "amount due now" fixes (see the two entries above). When nothing is actually due, the field now defaults to 0 instead of falling back to monthly rent, letting the payer type in whatever amount they intend to pay ahead. Added a regression test (`tests/payment-link-flow.test.ts`) asserting a tenant with one overdue and one early-activated-future obligation pre-fills only the overdue amount.
- **Related:** [[Backend]], [[Changelog]]

### Tenant Home page showed "Total to pay ₹17,000" while only one ₹8,500 rent installment was actually due

- **Status:** fixed
- **Found:** 2026-07-22 (direct user report against a live tenant: "shiva", Sri Adithya Boys Hostel-1 — verified against `rent_obligations` directly via psql)
- **Area:** [[Frontend]] — `TenantPriorityStrip.tsx`, `TenantFinancialsPage.tsx`
- **Symptom:** The Home page's red "Overdue by 17 days" card showed "Total to pay ₹17,000" and a "Pay ₹17,000" button, while the Money tab's own "Current Installment" section showed only one PENDING installment (Jul 2026 rent, ₹8,500) with the rest listed under "Upcoming Payments" as a future forecast, not something due now. A first attempted fix (same day, see [[Changelog]]) treated this as a copy/labeling problem and added an explanatory sentence — but the underlying ₹17,000 figure was itself wrong for the "how urgent is this" framing, so the explanation was confabulated on top of a bad number.
- **Root cause:** Confirmed against the live DB — the tenant had *two* non-UPCOMING rent obligations: Jul 2026 (due 5 Jul, genuinely 17 days overdue) and Aug 2026 (due 5 Aug, but already `PENDING` rather than `UPCOMING` — activated roughly a month early so the tenant *can* prepay it if they want). `financial-service.ts::getTenantDues`'s `current_payable_amount` is deliberately due-date-agnostic ("everything already activated, regardless of due date" — correct for owner-side "how much could I collect from this tenant" use cases) and sums both obligations to ₹17,000. The tenant Home page presented that figure as an urgent "Total to pay" under an overdue banner, which reads as "you're 17 days late on ₹17,000" when only ₹8,500 was actually late — the other ₹8,500 isn't due for another two weeks and was only "payable" in the sense of being available early.
- **Fix:** `TenantPriorityStrip.tsx` (Home) and `TenantFinancialsPage.tsx`'s `financialHealth` orange state (Money tab) now compute a due-date-aware `dueNowAmount`/`dueSoonAmount` from the read model's own `items[]` (which carries per-obligation `due_date`), summing only obligations that are non-upcoming **and** due today or earlier. The headline figure and Pay button on Home now reflect this corrected amount; any additional already-activated-but-not-yet-due balance is shown separately as a low-key "Plus ₹X for next month, already available if you'd like to pay ahead" note instead of being silently folded into the urgent total. The category breakdown (rent/deposit/maintenance/late fee) on Home is now also computed from the same due-now-filtered item set, so it can no longer disagree with the headline number the way "Rent ₹17,000" once did next to "Total to pay ₹17,000" while only ₹8,500 was actually overdue.
- **Related:** [[Frontend]], [[Business-Rules]], [[Changelog]]

### Tenant portal Payment History showed reversed payments as "Payment received" with a raw negative amount, and raw method enums like "ADVANCE_ADJUSTMENT"

- **Status:** fixed
- **Found:** 2026-07-22
- **Area:** [[Backend]] — `payment-service.ts::getTenantPaymentHistory` / [[Frontend]] — `TenantFinancialsPage.tsx`, `TenantPaymentDetailModal.tsx`
- **Symptom:** A tenant's Payment History list showed rows like "₹-1 · Payment received · UPI" and "₹-8,500 · Payment received · ADVANCE_ADJUSTMENT" — a reversal (negative `amount_paid`, the only source of negative amounts in this system) rendered with the same green "Payment received" label as a real incoming payment, with the currency formatter printing the raw negative number (`₹-1`) rather than a clearly-signed reversal. Payment method also rendered as the raw backend enum string instead of a readable label.
- **Root cause:** `getTenantPaymentHistory` passed `amount_paid`/`payment_method` straight through from the `payments` table with no reversal detection and no label mapping. The owner-side activity feed had already solved the identical problem (`financial-timeline-service.ts::describePaymentReversal`, shipped in commit `9fe984d2`) but that helper wasn't exported and wasn't reused by the tenant-facing payment-history path — same underlying data, two different code paths, only one of them fixed.
- **Fix:** Exported `describePaymentReversal` from `financial-timeline-service.ts` and reused it in `getTenantPaymentHistory` to set `is_reversal` on every payment row; added `backend-next/lib/payment-method-labels.ts` (`paymentMethodLabel()`) mapping known `payment_method` values (CASH/UPI/BANK_TRANSFER/CARD/CHEQUE/ONLINE/ADVANCE_ADJUSTMENT/etc.) to readable copy, with a title-cased fallback for anything unmapped. `TenantFinancialsPage.tsx` now shows reversals as "Payment Reversed" in red with an explicit `−` prefix (amount itself is `Math.abs`'d, so the currency formatter never prints a raw negative sign), and `TenantPaymentDetailModal.tsx` mirrors this in its detail view ("PAYMENT REVERSED" badge instead of "PAID SUCCESS"). Also fixed the advance-credit history entries, which showed "Future rent credit" as both the label and the method on the same row — method now reads "Advance Balance" for non-gateway credit.
- **Related:** [[Backend]], [[Frontend]], [[Changelog]]

### Owner Tenant Profile contradicted itself: "Agreement: Signed" next to "No active agreement", plus a hardcoded hostel name

- **Status:** fixed
- **Found:** 2026-07-22
- **Area:** [[Frontend]] — `TenantProfilePage.tsx`
- **Symptom:** On the owner-facing Tenant Profile page, the Risk & Compliance card's "Agreement" field said "Signed" while the page's own "Rent Agreement" summary chip (right next to "Hostel Location") said "No Active Contract" and the Financial Strip's Agreement card said "No active agreement" — three places on the *same page* disagreeing about the same fact. Separately, "Hostel Location" showed the literal hardcoded string "Hostel 2" for every tenant, regardless of which hostel they actually belonged to.
- **Root cause (initial pass):** Three different UI spots computed "does this tenant have an agreement" from `Boolean(allocations?.length > 0)` — i.e. "has this tenant ever been allocated a room" — a different fact from "does this tenant have a current signed agreement." The "Hostel Location" chip was never wired to real data at all — literally `<span>Hostel 2</span>`.
- **Root cause (real, found via a second live report — tenant BOJJA KAPIL, an independently-verified "Hostel Residency Agreement" document, still showed "Missing"/"No Active Contract"):** The first-pass fix unified all three spots onto `Boolean(agreementMonthsTotal)`, itself computed from `tenant?.agreement_duration_months ?? overview?.agreement_duration_months`. Neither field was ever actually present on `getOwnerTenantOverview`'s response — the function never queried the `agreement` table at all, only `tenant_invitations` (nested, not flattened) and `room_allocations`. So the "consistent" fix was consistently wrong: **every** tenant showed "no agreement," even ones with a real `SIGNED` agreement and a verified document, because the underlying field the whole page relied on genuinely didn't exist in the payload. Confirmed onboarding itself is not at fault — `activation-workflow-service.ts` correctly creates the `DRAFT` agreement and transitions it to `SIGNED` with real duration/start-date/contract terms on activation (`tests/activation-workflow.test.ts`, 6/6 passing); this was purely a read-side gap.
- **Fix:** `getOwnerTenantOverview` (`tenant-service.ts`) now queries the tenant's real current agreement (`prisma.agreement.findFirst({ status: currentAgreementWhere() })`, the same `SIGNED`/`EXPIRING_SOON`/`AGREEMENT_EXPIRED` set the renewal system already uses) and returns `has_active_agreement`, `current_agreement` (id/status/dates/contract terms/pdf_url), plus top-level `agreement_duration_months`/`agreement_start_date` sourced from it (falling back to the invitation snapshot only if no agreement exists). The frontend's three "has agreement" checks now read the new `has_active_agreement` boolean directly instead of inferring from duration presence. New tests: `tests/tenant-overview-agreement.test.ts` (3/3 — signed agreement reports true with real contract terms, no agreement reports false, a `TERMINATED` historical agreement correctly does not count as current). "Hostel Location" now resolves the real hostel name via the owner's hostels list (`ownerService.getHostels()`, matched by the route's `hostelId`).
- **Related:** [[Frontend]], [[Backend]], [[Changelog]]

### Expense/activity-log timestamps could silently show the wrong time on a non-IST server or browser

- **Status:** fixed
- **Found:** 2026-07-22
- **Area:** [[Backend]] — `expense-export-service.ts`, `activity-logs/route.ts` / [[Frontend]] — `ActivityLogsView.tsx`, expense components
- **Symptom:** Expense export "Generated at" timestamps (CSV/XLSX/PDF) and Activity Log entries were formatted with `.toLocaleString("en-IN")`/`.toLocaleDateString("en-IN")` but no explicit timezone. On the backend this resolves to the *server process's* timezone (commonly UTC on cloud hosts) — an export generated at 1:00 AM IST could show "Generated at: 7:30 PM" the previous day, correctly Indian-*formatted* (commas, DD/MM order) but not actually IST-*converted*. On the frontend the same issue depends on the viewer's device clock/timezone rather than true IST. Separately, editing or deleting an expense produced no visible trail in the Activity Log at all — the log only ever showed a live reconstruction of *current* expense rows, so an update silently changed the entry in place and a delete made it disappear entirely.
- **Root cause:** (1) `Intl`/`toLocaleString` defaults to the runtime's own timezone when none is passed — true both in Node (export service) and in a browser set to a non-IST timezone (activity log view). (2) The Activity Logs route's `activity_logs` query filtered `entity_type: { in: ['HOSTEL_POLICY', 'RENT'] }`, silently excluding `EXPENSE` rows (written correctly by `activityService.log()` on update/delete) and `AGREEMENT_TEMPLATE` rows (despite the mapper below already handling that type) — logs were being written but never read back.
- **Fix:** New `formatIST()` helper (`lib/timezone.ts`) used throughout `expense-export-service.ts`; `reportDateLabel()`'s month-range check switched from server-local to UTC date getters (matching the underlying `@db.Date` UTC-midnight encoding). `ActivityLogsView.tsx`'s three formatters gained explicit `timeZone: 'Asia/Kolkata'`, and "Today"/"Yesterday" grouping now compares IST calendar-day keys rather than the browser's local `toDateString()`. The activity-logs route's query was broadened to include `EXPENSE` (scoped to `UPDATE`/`DELETE` only — `CREATE` is already covered by the richer live-table reconstruction) and `AGREEMENT_TEMPLATE`. `ExpenseDetailsModal.tsx` gained a new "Added on" row (`created_at`, IST-formatted) alongside the existing expense-date row.
- **Related:** [[Backend]], [[Frontend]], [[Changelog]]

### Pausing a hostel gave no warning it stops rent generation for active tenants

- **Status:** fixed
- **Found:** 2026-07-22
- **Area:** [[Frontend]] — `PauseHostelModal.tsx`, `CloseHostelModal.tsx`
- **Symptom:** The "Temporarily Close" confirmation modal's own copy says "No new rent will be generated" once paused, but showed no indication of *how many* active tenants that affects, or their outstanding dues — an owner could pause a hostel with dozens of paying tenants with zero visibility into the impact. Separately, "Close Hostel" would let the owner fill in a reason and submit, only to be told by a backend trigger (`prevent_archive_with_active_allocations`) that active tenants block the close — a wasted round trip the frontend could have prevented from the start.
- **Root cause:** Both modals only ever received `{id, name}` for the hostel being acted on, even though the exact stats (`active_tenants`, `occupied_beds`, `pending_dues`) were already fetched and displayed on the hostel's own portfolio/list card one component up — they just weren't threaded through the click handlers into modal state.
- **Fix:** New shared `HostelImpactSummary.tsx` renders the real tenant/dues numbers in both modals, threaded through from the existing card data (no new fetch). `CloseHostelModal` now disables its submit button and shows "Move tenants out first" up front whenever active tenants exist, pointing the owner at "Temporarily Close" as the non-destructive alternative, instead of waiting for the backend to reject the request.
- **Related:** [[Frontend]], [[Changelog]]

### iPhone Safari auto-zoomed into every form field (Add Expense / Add Tenant / others)

- **Status:** fixed
- **Found:** 2026-07-21
- **Area:** [[Frontend]] — `src/styles/globals.css`
- **Symptom:** On an iPhone, tapping any input in Add Expense / Add Tenant (and other forms) zoomed the page in and would not zoom back out, so every field entry left the owner pinch-zooming out repeatedly and the mobile layout felt broken.
- **Root cause:** iOS Safari auto-zooms into any focused `input`/`select`/`textarea` whose *computed* font-size is below 16px, and does not restore the zoom afterward. Our form fields default to Tailwind `text-sm` (14px), so every field triggered it. (The modal being a bottom-sheet vs full-screen is unrelated — the trigger is font-size, not modal size.)
- **Fix:** An **unlayered** `@media (max-width: 639.98px)` rule in `globals.css` forces `input`/`select`/`textarea` (except checkbox/radio/range) to 16px below the `sm` breakpoint. Being unlayered, it outranks Tailwind's layered `text-sm`/`text-xs` utilities without `!important`. Fixes every form app-wide; desktop keeps its denser 14px.
- **Related:** [[Frontend]], [[Changelog]]

### Tenant had no way to actually finalize an accepted renewal

- **Status:** fixed
- **Found:** 2026-07-22
- **Area:** [[Frontend]] — `TenantDashboardPage.tsx` / [[Backend]] — `agreement-renewal-signing-service.ts`
- **Symptom:** After a tenant tapped "Accept Offer" on a renewal, nothing further happened in the UI. The tenant dashboard's two renewal cards both `return null` once a successor agreement exists (`TenantRenewalOfferCard` because the offer's status is no longer `SENT`/`DRAFT`; `TenantRenewalCard` because `evaluateAgreement()` resolves `decision_state` back to `"CURRENT"` once a successor exists) — so the tenant saw no indication a signature was still needed, and had no way to provide one. Backend support (`agreement-renewal-signing-service.ts`, `POST /api/agreements/[id]/sign-renewal`, already accepts `session.role === "TENANT"`) existed with zero frontend consumer.
- **Root cause:** The renewal UI was built around "offer accepted ⇒ done," but accept only creates a `DRAFT` successor agreement (`createRenewalDraft`) — activation still requires an explicit signature (`signRenewalAgreement`), which nothing in the frontend ever called for a tenant.
- **Fix:** New dedicated page `src/platforms/tenant/pages/TenantRenewalPage.tsx` (route `/tenant/renewal`) adds a "Sign Your Renewed Agreement" stage using the existing `SignaturePad` component plus a new session-authenticated upload route (`POST /api/tenants/me/renewal-signature`, mirrors the activation-token-based signature upload but resolves the tenant from session) and `agreementService.signRenewalAgreement()`. The dashboard's two large inline cards were replaced with one slim `TenantRenewalBanner` that correctly surfaces the previously-invisible "awaiting signature" and "signed" states. See [[Decisions]] ADR-019.
- **Related:** [[Backend]], [[Frontend]], [[Changelog]]

### Renewal queue always showed room type as "N/A"

- **Status:** fixed
- **Found:** 2026-07-21
- **Area:** [[Backend]] — `renewal-decision-service.ts`
- **Symptom:** Every row on the Renewal Pipeline queue showed `Room 401 (N/A)` — the room number was correct but the category in parentheses was always "N/A", visible in real device screenshots of the mobile rebuild.
- **Root cause:** `agreementDecisionInclude()`'s Prisma `room_allocations.room` select only listed `{ id: true, room_no: true }`, and `tenantPayload()`'s returned `room` object only echoed `id`/`room_no` — `room_type` was never fetched from the database in the first place, so the frontend's `tenant.room?.room_type` was always `undefined`. This was already flagged as a known gap in this session's earlier UX audit (it also blocks the Renewal Campaigns Wizard's per-category pricing strategy from auto-populating categories) but not yet fixed until real screenshots made the impact concrete.
- **Fix:** Added `room_type: true` to the Prisma select and to `tenantPayload()`'s returned shape. `tests/renewal-decision-service.test.ts` (10/10) still passes unchanged.
- **Related:** [[Backend]], [[Changelog]]

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

- **The 90-day frequency-change cooldown and minimum-commitment checks are currently disabled for the owner-direct path.** `ownerInitiateChange` no longer calls `validateCooldown()` or `validateCommitment()`; `ownerSetCustomSchedule` no longer calls `validateCooldown()` — all commented out per explicit request during testing (see ADR-025). An owner can currently thrash a tenant's billing frequency with no throttling or minimum-commitment enforcement at all. Re-enable (uncomment, one line each) once done testing, and reconsider whether the current defaults / global constants are still the right shape.
- **The pre-existing tenant-request→owner-`approve()` billing frequency flow still has no real effect on obligation generation for agreement-based tenants.** Fixed for the owner-*direct* path (`ownerInitiateChange`, ADR-024) and for Custom Dates (ADR-022, which never had this gap) — both now correctly supersede and regroup an agreement tenant's future rent. `BillingTransitionService.approve()` (the older flow: tenant submits a request, owner approves it) still only calls `writeBillingPlanTransition` — it updates `tenant_billing_plans`/`tenants.payment_frequency` but never touches `rent_obligations`, so a tenant with a signed agreement approved through *that specific flow* still keeps getting unchanged monthly obligations. Given `ownerInitiateChange` supersedes the entire need to wait for a tenant request, this legacy path may see little real use going forward, but it hasn't been fixed or removed — worth revisiting if it's still reachable from the UI.
- **Manual ledger POST route validates against the wrong enum values.** `/api/tenants/[id]/financial-ledger` only accepts `DEPOSIT/TOPUP/DEDUCTION/REFUND/CORRECTION`, none of which exist in the real `FinancialLedgerReason` Prisma enum. Left untouched as out-of-scope during the 2026-07 financial workspace redesign — worth fixing if that route is ever actually exercised.
- **No live-database audit done** for tenants with simultaneous Outstanding + Future Credit predating the future-credit-auto-consumption fix (`cf88ce94`). Needs an explicit user-run query.

## See also
- [[Features]] for which feature each bug affected
- [[Changelog]] for when fixes shipped
