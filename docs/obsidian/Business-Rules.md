---
tags: [business-rules, domain]
---

# Business Rules

Related: [[Database]] · [[APIs]] · [[Backend]] · [[Features]]

Everything below was extracted by reading the actual implementation (not types, not doc-comments alone) in `backend-next/`. File:line references point at the evidence. Anything not verifiable in code is explicitly marked **Unknown**.

## Late fee / billing calculation

**File:** `lib/billing/engine.ts` (pure functions, no DB/side effects).

- **Modes** (`LateFeeRule.type`): `flat` (fixed amount), `percentage` (`round(rentAmount × pct / 100)`, computed against whatever `rentAmount` the caller passes — see below, not necessarily the original full rent), `per_day` (`dailyAmount × activeDays`).
- **Grace days**: `effectiveDelay = max(daysDelayed − graceDays, 0)` — subtracted uniformly before any rule evaluates.
- **Rules stack**: enabled rules sorted by `after_days` ascending, applied cumulatively (not first-match-wins).
- **Cap**: `max_late_fee` (0 = uncapped) enforced against the *running cumulative total across all rules* — once adding a fee would exceed the cap, it's clipped and flagged `capped: true`.
- **Legacy config normalization**: `resolveRules()` handles both the old single-field config (`late_fee_type`/`late_fee_amount`/etc.) and the newer `late_fee_rules[]` array.

**Actual per-day accrual happens in `src/services/payments/reminder-service.ts::processDailyReminders`**, not in `calculateLateFees` itself (which has zero production callers beyond its own test — it appears to exist for a possible frontend "what-if" preview, not verified here):

- Computes `accumulatedFees` per obligation by summing existing `LATE_FEE` rows for the same allocation+rent_month; skips all rules entirely once `accumulatedFees >= maxCap`.
- **`per_day` rules create one new `LATE_FEE` obligation row per calendar day** (idempotent via same-day existence check + DB unique-constraint fallback) — late fees compound as a sequence of discrete obligation rows, not by mutating the original rent obligation.
- **`flat`/`percentage` rules fire once per rule per rent_month.**
- **Base amount for percentage/per-day fees is the outstanding remainder** (`ob.remaining_amount ?? ob.amount`), not the original obligation amount — a partially-paid obligation accrues late fees on the remainder only.
- Each new late-fee obligation is immediately routed through `financialLifecycleService.activatePayableObligations` so it's payable right away.
- **Possible doc/code drift**: `financial-service.ts`'s own header comment claims late fees are applied "by incrementing `late_fee`/`total_amount` on the base RENT obligation" — the actual runtime behavior (separate `LATE_FEE` obligation rows) contradicts this. Flagging as **Unknown/needs clarification** which description is authoritative; don't assume the header comment over the executed code path.
- **Proration** for partial-month billing: not found in `lib/billing/engine.ts`. **Unknown** whether `agreement-rent-schedule-service.ts` handles this elsewhere — not examined.

## Obligation lifecycle

**Files:** `src/services/payments/obligation-engine.ts`, `financial-obligation.types.ts`, `financial-lifecycle-service.ts`.

**Two-column state model** (the actual current model, despite an older doc-comment in `obligation-engine.ts` describing a single-column `DRAFT → PENDING → PARTIAL → PAID → WAIVED/CANCELLED` chain that no longer matches the schema):

- `lifecycle_status`: `ACTIVE → WAIVED | CANCELLED` — terminal once non-ACTIVE.
- `settlement_status`: `UNPAID → PARTIAL → PAID` — tracked independently.
- A `PresentationStatus` (`OVERDUE|UPCOMING|PENDING|PARTIAL|PAID|WAIVED|CANCELLED`) is **derived only, never persisted**, via `derivePresentationStatus(lifecycle, settlement, dueDate, now)`.
- A legacy single `status` column is still dual-written for compatibility via `toLegacyStatus()`.

**Creation**: `createInitialObligations()` (called inside the tenant-invite transaction — creates RENT/SECURITY_DEPOSIT/one-time-MAINTENANCE idempotently) and `createObligationInTx()` (the universal manual-creation path behind `POST /api/payments/obligations`, validating against 10 canonical `OBLIGATION_TYPES`: RENT, SECURITY_DEPOSIT, ADMISSION, MAINTENANCE, LATE_FEE, FINE, EXTRA_CHARGE, DAMAGE, UTILITY, ADDITIONAL_CHARGE, OTHER).

**Activation**: `markObligationsPayableInTx()` transitions `UPCOMING → PENDING`, idempotent. Orchestrated by `FinancialLifecycleService.activatePayableObligations()`, which also sweeps available future-rent credit immediately after activation.

**Cancellation** (`cancelObligationInTx`): only allowed on actionable-status obligations (`OVERDUE|PENDING|PARTIAL|UPCOMING`) with **zero payments** — explicitly rejects with "Cannot cancel an obligation that has payments. Use waiver instead." No ledger correction is generated (no money was owed yet).

**Waiver** (`waiveObligationInTx`): allowed on actionable-status obligations with outstanding balance > 0. Creates a `LEDGER_CORRECTION` debit via `financialCorrectionGateway`. If the obligation had a partial payment, `settlement_status` stays `PARTIAL` (retains payment history) rather than resetting.

**No in-place edit endpoint — confirmed by grep**: zero `PATCH`/`PUT` handlers exist anywhere under `app/api/payments/obligations/`. The only correction paths are cancel (pre-payment) or waive (post-payment). **There is no dedicated "replace obligation" endpoint or transaction bundling cancel+create as one operation** — if a caller wants a "create replacement, cancel original" correction, that is two separate API calls, not a first-class supported operation. Treat "editing = create-replacement + cancel-original" as an *emergent manual pattern* used by the frontend (see `[[Features]]` — Owner Financial Workspace), not something the backend enforces atomically.

## Payment allocation

**File:** `src/services/payments/settlement-planner.ts` (planning) + `settlement-engine.ts` (execution — "pure execution module," never imports from the planner in the other direction).

**Not pure date-FIFO — priority-tiered, then chronological within tier.** Obligations are sorted by `SETTLEMENT_PRIORITY` first: `SECURITY_DEPOSIT(1) → ADMISSION(2) → MAINTENANCE(3) → RENT(4) → LATE_FEE/FINE(5) → EXTRA_CHARGE/DAMAGE/UTILITY/ADDITIONAL_CHARGE(6) → OTHER(7)`, then by `due_date` ascending. So within the RENT tier it's true oldest-first FIFO, but across types priority wins — e.g. a later-due security deposit settles before an older overdue rent.

- **Partial payments**: each allocation gets `PAID` if fully covered, else `PARTIAL`.
- **Overpayment**: leftover funds become `future_credit`, credited to `tenant_financial_ledger` with reason `FUTURE_RENT_CREDIT_TOPUP` — unless the funding source *is* existing credit being applied to new dues, in which case it's debited from the ledger instead (no overflow possible by construction in that path).
- **Full-tier policy**: if `policy.allow_partial` is false, the minimum acceptable payment equals the entire first incomplete tier (ONBOARDING → RECURRING → PENALTIES → ADHOC), not an arbitrary amount.
- **Chronology guard**: when a caller selects specific obligations to pay, the code enforces that no earlier unpaid RENT obligation can be skipped while a later one is selected.
- **Execution**: locks obligations `FOR UPDATE` in the same priority order via a **hand-duplicated SQL `CASE` clause** in `settlement-engine.ts` — explicitly commented as needing manual sync with the planner's priority constant (a real maintenance risk if one is changed without the other).

## Settlement (move-out)

**File:** `lib/services/move-out-service.ts::calculateSettlementPreview` (read-only, computed on demand until owner approval).

- Splits the tenant's ledger balance into a "security deposit portion" vs. "extra advance balance" by reconciling against paid SECURITY_DEPOSIT/ADVANCE obligation amounts.
- Pulls current dues (`rentDue`, `lateFeesDue`, derived `maintenanceAndOtherDues`) from `financialService.getTenantDues()`.
- Pulls inspection deductions (damages, cleaning, missing items, other) from `move_out_inspections`.
- **Formula**: `net = paidSecurityDeposit + extraAdvanceBalance − totalDues − totalDeductions`. `settlement_direction` = `OWNER_OWES_TENANT` (net > 0) / `TENANT_OWES_OWNER` (net < 0) / `SETTLED` (net = 0).
- **Owner can override** the computed net at approval time — no bound/sanity check against the computed value beyond `amount ≥ 0` and a valid direction enum.
- Transitions gated via `move-out-state-machine.ts::assertTransition()` — canonical graph: `REQUESTED → {SETTLEMENT_PENDING, REJECTED} → {SETTLEMENT_APPROVED, REJECTED} → PHYSICALLY_VACATED → {SETTLEMENT_PENDING_PAYMENT, COMPLETED} → COMPLETED`, both terminal. Also defines **capability freezes** per status — e.g. a tenant cannot transfer rooms, change rent, or edit their profile while a move-out is `REQUESTED`/`SETTLEMENT_PENDING`/`SETTLEMENT_APPROVED`.
- **Active disputes block completion** — `assertNoActiveDisputes()` throws if any dispute is `OPEN`/`UNDER_REVIEW`.
- **On completion**: remaining unpaid rent obligations are bulk-waived ("Move-out settlement confirmed — outstanding rent waived") rather than left outstanding, and the ledger balance is debited via `applyAdvanceSettlementInTx`, guarded against double-application.

## The Financial Read Model — "compose, don't reimplement"

**File:** `src/services/payments/financial-read-model-service.ts` (full file read).

Explicitly documented as a **presentation-only composition layer** fixing a historical bug class where ~6 independently duplicated outstanding/overdue calculators disagreed between owner and tenant screens (one used the wrong column, `o.amount` instead of `o.total_amount`, silently dropping late fees — see `docs/business-logic/financial-consistency-investigation-report.md` and [[Decisions]] ADR-001).

Composes exactly three existing sources, nothing recomputed beyond pure display math (day-diff, bucket splitting):
1. `financialService.getTenantDues()` — obligation-level dues breakdown.
2. `tenantFinancialLedgerService.getBalance()` / `getBalanceForTenant()` — ledger balance, future-rent credit, security deposit.
3. `settlement-planner.isOverdue()` — per-item overdue determination.

Two entry points: `getFinancialReadModel(tenantId, ownerId, hostelId)` (owner context) and `getFinancialReadModelForTenant(profileId)` (tenant self-service, backing `GET /api/tenants/me/financial-read-model`). **Any new financial-summary surface must follow this pattern** — see [[Decisions]] ADR-001.

### Same pattern, second domain: business-expense financials

`backend-next/lib/services/expense-service.ts` exports shared, period-parameterized functions — `getBusinessRevenue(ownerId, start, end, hostelId?)`, `computeNetProfit()`, `computeProfitMargin()`, `computeExpenseRatio()`, `withCategoryPercentages()` — used by both the Expenses dashboard (`getAllExpenses()`, called with a fixed "this month" window) and the expense export report (`expense-export-service.ts::getExportSummary()`, called with the export's own filtered date range). Same formulas and query shape in both places; only the date window and the expense total each caller supplies differ. See [[Decisions]] ADR-010.

A revenue-lookup failure in the export is isolated (try/catch around just that one call) so it degrades only the Financial Summary section (`revenue`/`netProfit`/`expenseRatio` become `null`, exposed to the UI/report as "unavailable") rather than failing the whole export — no partial/estimated figures are substituted.

## Notification triggers

**Files:** `src/services/payments/reminder-service.ts`, `lib/services/collection-strategy-service.ts`, `lib/services/notifications/whatsapp-webhook-event-service.ts`.

- **Configurable per-hostel schedule**, three presets plus custom:
  - **Gentle**: before-due `[2]`, after-due `[1, 7]`.
  - **Standard**: before-due `[3, 1]`, after-due `[1, 5, 10]`.
  - **Aggressive**: before-due `[5, 3, 1]`, after-due `[1, 2, 3, 5, 7, 10, 14]`.
- **Escalation**: first scheduled day → `DUE_SOON`; last scheduled day (only if ≥3 total steps) → `FINAL_NOTICE`; everything between → `WARNING`.
- **Reminders fire only on exact configured day-offsets**, not "≥ N days." Never repeats the same reminder type twice in a row; never re-sends after `FINAL_NOTICE` (terminal).
- Late-fee generation and reminders share the same daily cron but are independently toggleable per hostel (`auto_send_reminders`, `auto_apply_late_fees`).
- **Channels**: in-app (default on), email (if tenant has `personal_email`), WhatsApp (**default off** — `config.reminder_whatsapp ?? false`). WhatsApp is explicitly skipped for `LATE_FEE_ADDED` — no template exists yet for that type ("LATE_FEE_TEMPLATE_OUT_OF_SCOPE").
- **Manual one-tap reminder** (owner-triggered): always targets the tenant's single oldest unpaid+overdue obligation, always sends type `WARNING` regardless of actual overdue-day count.
- **Tenant-side WhatsApp bot commands** (exact match, trimmed+uppercased): `BAL`/`BALANCE`, `SWITCH`, `DUES`, `PAY`, `STATUS`, `HELP`. Owner-side assistant uses a separate, richer ID-based interactive-menu system (`owner-whatsapp-assistant.ts`, 7180 lines) rather than flat keywords — full command enumeration for the owner side was not completed; treat as **Unknown/partially explored** beyond `HELP`/`DUES`.

## Multi-hostel / `hostelId` invariants

**File:** `backend-next/scripts/architectural-invariants-check.ts` — a static regex-based scanner (not runtime), 9 checks, exit-1 on violation:

1. Frontend `HostelContext` isolation — `../frontend/src` can't call hostel-context helpers directly except from `context/HostelContext.jsx`.
2. No direct `invalidateDashboardCache(` calls outside `lib/cache/dashboard-cache.ts` itself.
3. **`hostelId` must be a required parameter**, never optional, in operational service/route signatures (with 6 named exceptions).
4. **No "first hostel" fallback** (`hostels[0]`, or `findFirst` chains implying it) in operational code (8 named exceptions) — this exists because past bugs silently picked the wrong hostel for multi-hostel owners.
5. No `$queryRawUnsafe` outside a fixed allowlist of invariant/audit-tooling files.
6. **Settled `payments` rows are immutable** — no `update`/`updateMany`/`upsert`/`delete`/`deleteMany` on the `payment` model anywhere in application code.
7. Payment-attempt status transitions must go through `payment-service.ts`/`payment-status-event-service.ts`, not direct writes.
8. `portfolio-service.ts` may not query raw transactional tables (payment/rentObligation/tenant) without a hostel-scoping proximity check.
9. Frontend `useQuery` hooks must include `hostelId` in their query key (6 named exceptions).

## Explicit "Unknown / needs clarification" items

- Whether/where rent is prorated for partial-month billing.
- The exact relationship between `mapLegacyReason()` (in `tenant-financial-ledger-service.ts`, not read in full) and the schema's `FinancialLedgerReason` enum values — the `credit()` method's literal type union (`DEPOSIT|TOPUP|SECURITY_DEPOSIT_COLLECTED|FUTURE_RENT_CREDIT_TOPUP`) doesn't obviously cover all 10 schema enum values.
- Full enumeration of owner-side WhatsApp assistant commands beyond `HELP`/`DUES`.
- Whether `rent_obligations.obligation_type` has a DB-level CHECK constraint or relies solely on the TypeScript `OBLIGATION_TYPES` array for validation.
- Which of the codebase's several overlapping "financial issue" tracking tables (`financial_invariant_failures`, `payment_operational_anomalies`, `payment_reconciliation_items`, `financial_reconciliation_issues`) is currently authoritative — see [[Database]].

## See also
- [[Database]] for the schema these rules operate on
- [[APIs]] for the endpoints that enforce them
- [[Decisions]] for the architectural decisions behind the "compose, don't reimplement" pattern and the obligation-immutability model
- [[Features]] for the user-facing surfaces built on top
