# FINANCIAL_OPERATIONS_AUDIT.md

**Scope:** HMS (Apna Ghar) — internal financial operations layer audit
**Author:** Cascade (acting as Principal Fintech Systems Architect)
**Status:** Phase 1 deliverable — **observation only**, no code or schema changes
**Date:** 2026-05-15

---

## 1. Executive Summary

HMS today operates a **pooled-merchant** payment topology:

- **Owner → HMS** (subscriptions, addons): money lands in HMS PhonePe merchant → HMS revenue. Correct.
- **Tenant → HMS** (rent, advance): *intended* to land in HMS PhonePe merchant pool → HMS holds money as **owner liability** until manual payout. *In code*, the only configured PhonePe credential set is the HMS platform one (`getOwnerLevelProviderConfig`), and the rent-collection path is currently **hard-blocked** by `blockRentCollectionPhonePePlatformLeak` (`@/home/sp/Desktop/hms/backend-next/lib/services/payment-service.ts:84-109`). So online rent collection is *off* in production; only offline/manual/UPI-reference rent recording flows. This is a critical context mismatch with the brief (see §6 Finding F-01).

The system already has strong building blocks:

- Append-only `payment_attempt_status_events` with `operational_owner_id` vs `financial_owner_id` split (`@/home/sp/Desktop/hms/backend-next/prisma/schema.prisma:491-510`).
- `paymentAttempt` carries `payment_domain` / `scope_type` / `flow_type` / `merchant_context_type` (`@/home/sp/Desktop/hms/backend-next/prisma/schema.prisma:539-545`).
- Domain enums `PLATFORM_BILLING` vs `RENT_COLLECTION`, `SETTLEMENT_STATUS` (`@/home/sp/Desktop/hms/backend-next/lib/services/payments/financial-domain.ts:1-30`).
- Reconciliation scaffolding tables: `payment_reconciliation_runs`, `payment_reconciliation_items`, `payment_operational_anomalies`, `payment_provider_verification_snapshots`.
- Hostel isolation: every payment-bearing row carries `hostel_id`.

What is **missing** (the gap this initiative must close):

1. No **OwnerSettlementLedger** — payable balance owed by HMS to each owner does not exist as a first-class entity.
2. No **payout batch / payout item** entities — manual settlement operations have nowhere to land.
3. No **HMS internal treasury dashboard** — admins cannot see unsettled liabilities, only owner-scoped dashboards exist.
4. The `paymentAttempt.settlement_status = SETTLED` flag is **semantically wrong** for rent collection — it currently means "ledger row written" not "HMS paid the owner" (see Finding F-02).
5. No owner-facing payout history surface.
6. No reconciliation engine for ledger-vs-payments drift (the existing reconciliation tables target provider↔attempt mismatches only).
7. No payment-provider adapter abstraction at the service-call layer (PhonePe is reached through a factory but there is no clean seam for split-settlement migration).

Severity ranking and remediation phasing are in §7.

---

## 2. Current Architecture — Money Flow Map

### 2.1 Owner → HMS (Platform Billing)

```
Owner
  ↓ pay subscription / addon
PhonePe (HMS merchant) ──webhook──▶ /api/webhooks/payments/phonepe
                                      │
                                      ▼
                          paymentService.handlePaymentWebhook
                                      │
                          domain=PLATFORM_BILLING
                                      ▼
                paymentService.finalizePaymentAttempt
                    ├─ ADDON path  → addonUsage + addonTransactions
                    └─ INVOICE path → ownerInvoice.status=PAID
                                       owner_subscriptions upsert
                                      ▼
                  paymentAttempt.settlement_status = SETTLED   ✅ correct
                  financial_owner_id = HMS_FINANCIAL_OWNER_ID  ✅ correct
```

**Verdict:** This flow is semantically correct. HMS *is* the financial owner. `SETTLED` here means "HMS holds the money, no further movement expected."

Files:
- `@/home/sp/Desktop/hms/backend-next/lib/services/payment-service.ts:1448-1910` (finalize: ADDON + BILLING branches)
- `@/home/sp/Desktop/hms/backend-next/app/api/webhooks/payments/phonepe/route.ts:1-155`

### 2.2 Tenant → HMS (Rent Collection)

```
Tenant
  ↓ rent / advance
PhonePe (HMS merchant — current reality)
                  ↓
  ── blocked by guard ──   ⚠️ blockRentCollectionPhonePePlatformLeak throws
                  ↓
  In current prod: only offline / manual UPI reference is recorded
                  ↓
  paymentService.recordPayment / recordOfflinePaymentWithToken
                  ↓
  payments row written      (owner_id, hostel_id, tenant_id, obligation_id)
  rent_obligations.status = PAID | PARTIAL
  receipts row created
                  ↓
            ⛔ NOTHING HAPPENS NEXT
  - No ledger entry crediting the owner
  - No "HMS owes owner X" liability tracking
  - No payout batch
  - No reconciliation between collected-into-HMS-merchant vs payable-to-owner
```

Files:
- `@/home/sp/Desktop/hms/backend-next/lib/services/payment-service.ts:154-247` (`_applyPaymentInTx`)
- `@/home/sp/Desktop/hms/backend-next/lib/services/payment-service.ts:362-459` (`recordPayment` side-effects)
- `@/home/sp/Desktop/hms/backend-next/lib/services/payment-service.ts:1912-2147` (RENT finalize path — currently unreachable for online PhonePe)

**Verdict:** The `payments` row is the *only* record of money movement. There is no liability ledger. From an accounting standpoint, HMS treats successful tenant payments identically to settled platform-billing — the **"who owes whom"** dimension is missing entirely.

### 2.3 Aggregation Surfaces (Where Mixing Risk Lives)

- `dashboard-service.ts:55-110` aggregates `payments.amount_paid` per `(owner_id, hostel_id)` as `rent_collected_this_month` and `revenue`. This is shown only on the **owner's** dashboard, so the label `revenue` is correct *for the owner*. But there is no equivalent **HMS-internal** aggregation that frames this same number as **HMS-held custodial liability**.
- `analytics-service.ts:280-300, 400-430` also aggregates `SUM(amount_paid)` per owner — same property: correct for owner, missing for HMS treasury.
- No global query joins `payments` across all owners → there is no current code path that *accidentally* treats tenant rent as HMS revenue. Risk is **latent**, not realized — but the architectural firewall is informal (no DB constraint, no service-layer assertion).

---

## 3. Data Model Inventory

Existing entities relevant to financial operations:

| Entity | Role | Owner-isolation | Hostel-isolation | Append-only |
|---|---|---|---|---|
| `payments` | Tenant→Obligation money applied | `owner_id` (nullable) | `hostel_id` NOT NULL | No (status implicit) |
| `paymentAttempt` | Gateway intent | `owner_id` NOT NULL | `hostel_id` nullable | Status mutable |
| `payment_attempt_status_events` | Immutable status transitions | both | yes | ✅ yes |
| `rent_obligations` | Receivable from tenant | `owner_id` | `hostel_id` | No (status mutable) |
| `receipts` | Tenant-facing artifact | `owner_id` | `hostel_id` | Effectively yes |
| `ownerInvoice` | HMS→Owner platform bill | `owner_id` | n/a | Status mutable |
| `owner_subscriptions` | HMS plan state | `owner_id` | n/a | Mutable |
| `overflow_ledger` | Per-billing-month overage | `owner_id` | n/a | append-only |
| `payment_reconciliation_runs/items` | Attempt-vs-provider reconciliation | yes | yes | append-only |
| `payment_operational_anomalies` | Anomaly stream | yes | yes | append-only |
| `financial_invariant_failures` | Invariant check failures | n/a | n/a | append-only |

**Missing entities (to be designed in Phase 2 — not now):**

- `OwnerSettlementLedger` — append-only credits/debits between HMS and each owner per hostel.
- `SettlementBatch` + `SettlementBatchItem` — manual payout operations.
- `FinancialReconciliationIssue` — ledger-level drift (distinct from provider-level `payment_reconciliation_items`).
- `AdminFinancialAuditLog` — HMS-internal admin actions (settlement approvals, overrides).

---

## 4. Service Layer Inventory

| Service | Responsibility | Gaps for new initiative |
|---|---|---|
| `payment-service.ts` | Webhook + finalize + record | No ledger emission post-success; `SETTLED` flag overloaded |
| `financial-service.ts` | Read-side queries: dues, outstanding, summaries | Owner-facing only; no HMS treasury views |
| `receipt-service.ts` | Receipt PDF + numbering | OK as-is |
| `payment-webhook-event-service.ts` | Webhook idempotency | OK as-is |
| `payment-operational-anomaly-service.ts` | Anomaly emission | OK as-is, reuse for ledger anomalies |
| `payment-status-event-service.ts` | Status transition audit | OK as-is |
| `tenant-advance-service.ts` | Advance ledger (per-tenant) | Pattern can be mirrored for owner ledger |
| `dashboard-service.ts` | Owner dashboard | Mixes "collected" with "revenue" terminology |
| `analytics-service.ts` | Owner analytics | Same as above |
| `migration-audit-service.ts` | Historical migration accounting | Inspect for drift baseline |

**No existing service is responsible for:** settlement ledger, payout batches, HMS treasury reporting, ledger-vs-payments reconciliation. All Phase 3+ work creates new services.

---

## 5. Frontend Inventory (relevant surfaces)

- **Owner billing**: `frontend/src/...` (legacy React app) + `backend-next/app/(dashboard)/...` (new Next surface). Owner sees plan status and platform invoices.
- **Owner payment dashboards**: existing rent-collection dashboards consume `dashboard-service.getOwnerStats` and `analytics-service.*`. None of these expose HMS-side payout history, because none exists.
- **Admin dashboards**: there is no HMS-internal admin financial dashboard. Existing admin routes (search for `app/api/admin/`, none found in this audit) do not include treasury operations.

**Phase 5 will need to build the admin surface from scratch — it does not exist today.**

---

## 6. Findings — Where Tenant Money Is Treated Incorrectly

Each finding includes: severity (Critical / High / Medium / Low), location, current behavior, correct behavior, blast radius.

### F-01 — Critical — Codebase contradicts stated production reality

- **Location:** `@/home/sp/Desktop/hms/backend-next/lib/services/payment-service.ts:84-109`, `:65-82`.
- **Current behavior:** Any rent-collection PhonePe attempt unconditionally throws `CONFIG_ERROR: Online PhonePe rent collection is disabled until owner merchant onboarding is implemented.` and writes a `RENT_COLLECTION_PLATFORM_MERCHANT_BLOCKED` anomaly.
- **Stated reality (per brief):** Tenant payments *are* collected into HMS PhonePe merchant.
- **Implication:** Either (a) online rent collection is genuinely disabled today and the brief describes intent, or (b) there is a separate codepath / env-flag override not seen in this audit. **Must be clarified before Phase 3.** The internal settlement system being built only has economic value if money actually flows through HMS merchant.
- **Action:** Confirm with stakeholders. The simplest fix when greenlit: remove (or env-gate) the unconditional guard so the platform-merchant provider config is acceptable for `RENT_COLLECTION` attempts, while preserving the financial-domain split. This is **not** something to "just remove" — it deliberately prevents accidental routing. Replacement must be intentional and policy-gated.

### F-02 — High — `paymentAttempt.settlement_status = SETTLED` is semantically overloaded

- **Location:** `@/home/sp/Desktop/hms/backend-next/lib/services/payment-service.ts:2104-2108`, `:1690`, `:1876`, `:2002`.
- **Current behavior:** On rent webhook success, the rent path sets `settlement_status: SETTLED` and `settled_at: now()`. On platform billing the same is done.
- **Correct behavior:** For `RENT_COLLECTION`, "settled" must mean "HMS has paid the owner". The current state should be `PROVIDER_SETTLED_TO_HMS` (or `NOT_SETTLED`) until a payout batch closes. For `PLATFORM_BILLING`, `SETTLED` is correct.
- **Blast radius:** Any downstream reporting that filters `settlement_status = SETTLED` will incorrectly count tenant rent as "fully settled" the moment the webhook fires. Today no such report exists (because no treasury dashboard exists), so this is a **latent** correctness defect — but Phase 5 must not be built on top of this flag.
- **Phase 2 action:** Introduce a new domain-aware enum or a separate `OwnerSettlementLedger.settlement_status`. Do **not** retroactively rewrite historical `paymentAttempt.settlement_status` values (append-only principle).

### F-03 — High — `payments` table has no owner-liability dimension

- **Location:** `@/home/sp/Desktop/hms/backend-next/prisma/schema.prisma:696-730`.
- **Current behavior:** `payments` records money applied to an obligation. There is no FK to a settlement ledger, no payout batch id, no payout reference.
- **Correct behavior:** Each `payments` row in the `RENT_COLLECTION` domain must have exactly one corresponding `OwnerSettlementLedger` CREDIT entry (HMS-owes-owner +amount). The payout batch later writes a DEBIT entry.
- **Constraint:** Cannot add NOT NULL FK to a new ledger table without backfill. Phase 2 must use an additive nullable column + backfill migration to populate ledger from history.

### F-04 — High — Owner-facing dashboards label tenant collections as "revenue"

- **Location:** `@/home/sp/Desktop/hms/backend-next/lib/services/dashboard-service.ts:85-110`, multiple call sites; `analytics-service.ts` revenue fields.
- **Current behavior:** `revenue: currentRevenue` and `rent_collected_this_month` both = `SUM(payments.amount_paid WHERE owner_id, hostel_id)`. Returned to owner dashboard.
- **Correctness:** From the **owner's** P&L this *is* revenue. But the same number from the **HMS** perspective is custodial liability. There is no current API that surfaces it as the latter.
- **Action (Phase 5):** Build HMS-internal endpoints that treat this number as `outstanding_payable_to_owners`. **Do not rename or alter the owner-facing label.** Maintain two distinct mental models behind two distinct surfaces.

### F-05 — Medium — No payment-provider abstraction at service-call seam

- **Location:** `@/home/sp/Desktop/hms/backend-next/lib/services/payments/provider-factory.ts` (PaymentProviderFactory). Adapters exist but `payment-service.ts` reaches into them directly with PhonePe-shaped contracts (`verifyWebhook`, `fetchStatus`, `createPayment`).
- **Current behavior:** Adapter pattern is partial — provider config is owner-level vs platform-level, but the **financial-domain-aware routing** (rent vs platform billing, sub-merchant vs platform merchant) is hard-coded in `payment-service.ts`.
- **Phase 8 action:** Introduce `payment-provider-adapter.ts` as a stable interface (`createPayment`, `verifyWebhook`, `refundPayment`, `getPaymentStatus`, `getSettlementInfo`) so that future split-settlement / sub-merchant providers can plug in without touching `payment-service.ts`.

### F-06 — Medium — Reconciliation tables exist but cover provider↔attempt only

- **Location:** `payment_reconciliation_runs`, `payment_reconciliation_items` (`schema.prisma:622-659`).
- **Current behavior:** These detect when provider truth disagrees with `paymentAttempt`. They do NOT detect ledger drift (payment without ledger, ledger without payment, double settlement, negative balance).
- **Phase 7 action:** Build `financial-reconciliation-service.ts` as a sibling. Reuse the existing `payment_operational_anomalies` stream for emission.

### F-07 — Medium — `payments.owner_id` is nullable

- **Location:** `@/home/sp/Desktop/hms/backend-next/prisma/schema.prisma:701`.
- **Current behavior:** `owner_id String? @db.Uuid` — nullable. Code sets it from obligation, but the DB doesn't enforce it.
- **Risk:** A NULL `owner_id` on a payment makes ledger attribution ambiguous.
- **Action:** Phase 2 ledger schema must require `owner_id NOT NULL` on every ledger row regardless of source `payments.owner_id`. Adding a CHECK constraint to `payments` is a separate hardening task (additive, not destructive).

### F-08 — Medium — Webhook `idempotency_key` on `payments` is per `payment_attempt + obligation`, not per provider txn

- **Location:** `@/home/sp/Desktop/hms/backend-next/lib/services/payment-service.ts:225-227`.
- **Current behavior:** `idempotency_key = pay:${paymentAttemptId}:${obligationId}` — fine for current single-merchant flow.
- **Future risk:** When sub-merchants land, the provider's settlement ref must also be idempotency-bound to prevent a second provider settlement event from double-crediting the ledger. Phase 2 ledger schema must use **provider_reference_id + payment_id** as a unique key, not just `payment_id`.

### F-09 — Low — `paymentAttempt.hostel_id` is nullable

- **Location:** `@/home/sp/Desktop/hms/backend-next/prisma/schema.prisma:538`.
- **Current behavior:** Nullable because `PLATFORM_BILLING` attempts have no hostel. Existing `requireFinancialHostelId` enforces non-null at runtime for RENT_COLLECTION. Acceptable.
- **Action:** None. Documented for awareness — settlement ledger rows must enforce `(domain = RENT_COLLECTION) ⇒ hostel_id NOT NULL` via partial CHECK or service-layer assertion.

### F-10 — Low — No structured event taxonomy for settlement lifecycle

- **Location:** `@/home/sp/Desktop/hms/backend-next/lib/events.ts` (eventSystem.trigger).
- **Current behavior:** `payment_recorded` fires post-payment. No `OWNER_SETTLEMENT_PENDING`, `OWNER_SETTLEMENT_COMPLETED`, `FINANCIAL_DRIFT_DETECTED`.
- **Phase 3 action:** Add these as structured emissions from `settlement-ledger-service` and `financial-reconciliation-service`.

---

## 7. Phase Plan (re-confirmed, with sequencing constraints)

| Phase | Deliverable | Blocks On |
|---|---|---|
| 1 | This document | — |
| 2 | Additive Prisma models + migration + Decimal-only columns | F-01 clarification |
| 3 | `settlement-ledger-service.ts` (append-only) + post-finalize hook | Phase 2 |
| 4 | Settlement batch + payout admin APIs | Phase 3 |
| 5 | HMS-internal admin dashboard | Phase 3, 4 |
| 6 | Owner read-only payout visibility | Phase 3, 4 |
| 7 | `financial-reconciliation-service.ts` + nightly job | Phase 3 |
| 8 | `payment-provider-adapter.ts` abstraction (no migration) | independent — last because lowest blast radius |

**Hard gates** (must not pass without explicit approval):
- Between Phase 2 and Phase 3: schema reviewed; backfill plan reviewed; no destructive change.
- Between Phase 4 and Phase 5: settlement engine has unit tests for concurrent payout, duplicate webhook, partial failure rollback.
- Between Phase 7 and production rollout: reconciliation engine baseline-runs against current production data without false positives.

---

## 8. Critical Open Questions (must be answered before Phase 2)

1. **F-01 resolution.** Is online tenant rent collection through HMS PhonePe merchant *actually live* in production, or is the brief describing intended state? This determines whether Phase 2 is greenfield modeling or whether Phase 2 also needs a historical backfill of `OwnerSettlementLedger` from every past `payments` row.
2. **HMS_FINANCIAL_OWNER_ID** — Confirm `process.env.HMS_FINANCIAL_OWNER_ID` is set in production (`@/home/sp/Desktop/hms/backend-next/lib/services/payment-service.ts:43-45`). Ledger DEBIT entries from HMS will need a non-null owner-side counterparty.
3. **Currency.** Confirm INR-only assumption. All ledger amounts will be `Decimal(14, 2)` paisa-stable. No FX in Phase 2.
4. **Payout method.** Manual NEFT/UPI from HMS bank → owner bank, with reference number captured. Confirm there is no integration with a payouts API (RazorpayX, Cashfree Payouts) being expected in this phase. Brief says manual — proceeding on that basis.
5. **GST / TDS.** None of the existing models carry GST or TDS withholding. Confirm out-of-scope for this initiative; if not, ledger schema must include those columns from day one (additive after the fact is painful).
6. **Backfill window.** If F-01 implies historical data exists, what date range must be backfilled into the ledger? All-time? Or a financial-year cutoff?

---

## 9. Risks & Non-Goals

**Risks:**

- **R-1** Backfilling ledger from `payments` without idempotency key collisions. Mitigation: include `payment_id` as a unique reference on every ledger CREDIT.
- **R-2** Concurrent payout batches double-debiting an owner. Mitigation: `(owner_id, hostel_id, payment_id)` unique constraint on CREDIT entries; per-owner FOR UPDATE lock on batch processing.
- **R-3** Owner balance becoming negative due to clawback / refund. Mitigation: Phase 2 ledger must support negative entries via signed amount + entry_type, with CHECK that `balance_after >= 0` is **soft** (warn, not block — refunds are real).
- **R-4** Reconciliation engine false positives during transition. Mitigation: dry-run mode in Phase 7 before alerting.

**Non-goals for this initiative:**

- Split settlement / marketplace topology.
- Real-time payout integration.
- Multi-currency.
- GST/TDS automation.
- Owner ability to *initiate* payout (read-only only).

---

## 10. Verification

This document is observation-only. No files modified, no migrations created.

```bash
# Verify no code change since Phase 1 started:
cd /home/sp/Desktop/hms && git status --short
# Expect: only FINANCIAL_OPERATIONS_AUDIT.md as untracked.
```

**Phase 1 status: COMPLETE.** Awaiting answers to §8 questions before proceeding to Phase 2.
