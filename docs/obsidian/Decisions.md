---
tags: [adr, decisions]
---

# Decisions (ADR Log)

Related: [[Architecture]] · [[Changelog]] · [[Business-Rules]] · [[Database]] · [[APIs]]

Architecture Decision Records — each entry below was **inferred from code evidence** (migration names, in-code comments, static invariant checks, schema shape), not from any design doc, since none was found for these. Where the original rationale isn't stated in the code, that's marked explicitly rather than invented. Append new entries at the top with real dates once you're recording live decisions going forward.

## ADR template

```markdown
## ADR-NNN: <short title>
- **Date:** YYYY-MM-DD
- **Status:** proposed / accepted / superseded by ADR-NNN / deprecated
- **Context:** What problem or forces led to this decision?
- **Decision:** What was decided?
- **Alternatives considered:** What else was on the table, and why not?
- **Consequences:** What becomes easier/harder as a result?
- **Related:** [[links]]
```

---

## ADR-001: Financial read model composes rather than recalculates

- **Date:** 2026-07 (per project memory of the redesign that produced it; exact commit not re-verified in this pass)
- **Status:** accepted
- **Evidence:** `backend-next/src/services/payments/financial-read-model-service.ts` header comment explicitly states the goal — fixing a bug class where "~6 independent calculators" for outstanding/overdue/future-credit disagreed between owner and tenant screens, referencing `docs/business-logic/financial-consistency-investigation-report.md`.
- **Decision:** Any new financial-summary surface must be built as a read model that composes existing services (`financialService.getTenantDues()` + `tenantFinancialLedgerService.getBalance()`), never recalculate independently.
- **Alternatives considered:** Not stated in code; the natural alternative (shared utility functions called from each surface) would not have prevented drift the same way, per the investigation report's framing.
- **Consequences:** New financial UI work must locate the right existing service rather than writing new SQL/aggregation; slower to build, but keeps owner/tenant numbers in sync by construction.
- **Related:** [[Business-Rules]], [[Database]] (`rent_obligations` three-status model this composes over)

## ADR-002: Obligations are audit-first / immutable — corrections via cancel-or-waive, not edit

- **Date:** Unknown — predates this vault; "Financial Architecture v2" migration (061) introduced the `lifecycle_status`/`settlement_status` columns this decision now runs on.
- **Status:** accepted
- **Evidence:** Confirmed by grep — zero `PATCH`/`PUT` handlers exist anywhere under `app/api/payments/obligations/`. `obligation-engine.ts::cancelObligationInTx` explicitly rejects cancelling an obligation with payments ("Use waiver instead"), and `waiveObligationInTx` always generates a `LEDGER_CORRECTION` ledger entry rather than mutating the obligation amount.
- **Decision:** `rent_obligations` has no edit endpoint. Corrections happen via cancel (pre-payment, no money involved) or waive (post-payment, generates an audit-trail ledger correction).
- **Alternatives considered:** Not stated in code. A "create-replacement + cancel-original" pattern is used ad hoc by the frontend (see the Owner Financial Workspace's Edit Obligation flow) but **is not itself a backend-enforced atomic operation** — no combined endpoint exists. This is worth deciding on formally if the pattern is going to keep being used.
- **Consequences:** Every correction is visible in the data as an audit trail (waived-with-reason, or cancelled-with-zero-payments) rather than silently overwritten. Frontend flows that want "replace" semantics must orchestrate two separate API calls themselves.
- **Related:** [[Business-Rules]], [[Database]]

## ADR-003: `hostelId` must be required, never optional, in operational code — no "first hostel" fallback

- **Date:** Unknown (the invariant-check script exists; the incident it responds to is not documented in-repo beyond CLAUDE.md's own note)
- **Status:** accepted, enforced by CI
- **Evidence:** `backend-next/scripts/architectural-invariants-check.ts`, checks 3 and 4 — static regex scan forbidding optional `hostelId?` parameters and `hostels[0]`/`findFirst`-implying-first-hostel patterns in operational scope (`lib/services`, `app/api/{dashboard,analytics,rooms,tenants,payments,expenses}`), each with a small named-file exception list.
- **Decision:** Every operational service/route must take `hostelId` as a required parameter and must never silently default to "the owner's first hostel."
- **Alternatives considered:** Not stated; the named exceptions in the script suggest some genuinely single-hostel-scoped code paths were grandfathered in rather than redesigned.
- **Consequences:** Multi-hostel owners can't have data silently misattributed to the wrong property. New code touching these areas must thread `hostelId` explicitly through every call, which is more verbose but closes a documented bug class.
- **Related:** [[Architecture]], [[Backend]]

## ADR-004: Settled payments are immutable — corrections happen via ledger, not by editing the payment row

- **Date:** Unknown
- **Status:** accepted, enforced by CI
- **Evidence:** `architectural-invariants-check.ts` check 6 — forbids `prisma.payment.(update|updateMany|upsert|delete|deleteMany)` (and the `tx.payment.*` equivalents) anywhere in `lib/services`/`app/api`, no exceptions besides the checker itself. Consistent with `settlement-engine.ts` only ever calling `payments.create`, never `.update`.
- **Decision:** Once a `payments` row is created, it is never mutated or deleted by application code. Any downstream correction (refund, waiver, dispute resolution) happens through `tenant_financial_ledger` entries, not by touching the original payment record.
- **Alternatives considered:** Not stated.
- **Consequences:** `payments` functions as a reliable, append-only audit trail of money actually collected — any "what did we think happened" question can trust this table completely. Refund/correction logic necessarily lives elsewhere (the ledger), which is more indirection but preserves the audit guarantee.
- **Related:** [[Database]], [[Business-Rules]]

## ADR-005: Payment allocation is priority-tiered, not pure chronological FIFO

- **Date:** Unknown
- **Status:** accepted
- **Evidence:** `src/services/payments/settlement-planner.ts::SETTLEMENT_PRIORITY` — obligations are sorted `SECURITY_DEPOSIT(1) → ADMISSION(2) → MAINTENANCE(3) → RENT(4) → LATE_FEE/FINE(5) → EXTRA_CHARGE/DAMAGE/UTILITY/ADDITIONAL_CHARGE(6) → OTHER(7)`, then by due date within each tier.
- **Decision:** When a tenant pays, money is applied first to security deposit/admission/maintenance obligation types regardless of age, then to rent (oldest-first within that tier), then fees, then everything else.
- **Alternatives considered:** Not stated; a pure date-FIFO policy (oldest obligation of any type first) was evidently rejected in favor of type-priority.
- **Consequences:** A hostel is guaranteed to collect deposits/admission/maintenance before rent arrears, which likely reflects a business priority (deposits are collateral, maintenance keeps operations running) over strict chronological fairness. The priority order is duplicated by hand in a SQL `CASE` clause in `settlement-engine.ts` for locking purposes — a real maintenance risk (the planner's own comment flags this) if one is changed without the other.
- **Related:** [[Business-Rules]]

## ADR-006: The multi-hostel SaaS billing/subscription model was removed in favor of a single-business model

- **Date:** Unknown — inferred from migration name `20260517000000_decommission_saas_tables` and 37 tombstoned (`410 Gone`) API routes
- **Status:** accepted
- **Evidence:** `app/api/{addons,billing,plans,subscription,usage}*`, `app/api/admin/settlements/*`, `app/api/owner/finance/*`, `app/api/owner/me/{subscription,usage,activation}` all unconditionally return 410 with messages referencing a "single-business migration," and code comments explicitly say "Do not add this route back to vercel.json without a new design." The `usage_tracking` table (per-owner tenant/hostel counts) remains in the schema but has no active consumer found — likely a vestige.
- **Decision:** Stop treating HMS as a subscription/plan/add-on-metered SaaS product for multiple owner-businesses; operate as a single-business system instead. Old routes were tombstoned rather than deleted outright, so any stale caller/cron fails loudly (410) instead of silently 404ing.
- **Alternatives considered:** Not stated; full deletion of the routes was evidently rejected in favor of leaving loud stubs.
- **Consequences:** A large amount of billing/plan/usage-quota code is dead weight in the schema and route tree (37 files) that a future cleanup could remove outright once confidence is high nothing depends on the 410 behavior itself. New features must not assume subscription-tier or usage-quota concepts exist.
- **Related:** [[APIs]], [[Database]], [[Architecture]]

## ADR-007: Obligation status is modeled as two independent columns (`lifecycle_status` × `settlement_status`), not one combined enum

- **Date:** Migration 061, "Financial Architecture v2" per the schema's own field comment
- **Status:** accepted (with a legacy single `status` column dual-written for compatibility, deprecation-status of that column not stated)
- **Evidence:** `prisma/schema.prisma` — `rent_obligations.lifecycle_status: obligation_lifecycle` and `settlement_status: settlement_state` both carry the comment "Financial Architecture v2 columns (migration 061)," alongside the older `status: PaymentStatus` column.
- **Decision:** Represent "is this obligation still active/waived/cancelled" and "how much of it has been paid" as two orthogonal dimensions, with a third, never-persisted `PresentationStatus` derived from both plus the due date for display.
- **Alternatives considered:** The prior single-column model (`DRAFT → PENDING → PARTIAL → PAID → WAIVED/CANCELLED`, still described in a stale doc-comment inside `obligation-engine.ts`) conflated lifecycle and payment-progress into one state space, which the v2 model explicitly replaces.
- **Consequences:** More columns to reason about, but a waived-after-partial-payment obligation can now correctly represent "terminated AND partially paid" simultaneously, which the old single-enum model couldn't express cleanly.
- **Related:** [[Database]], [[Business-Rules]]

## ADR-008: `ResponsiveDialog` as the shared desktop-Dialog/mobile-Drawer split, introduced during the Expenses Workspace redesign

- **Date:** 2026-07-18
- **Status:** accepted
- **Context:** Every modal in `frontend-v2` that needs different desktop (centered dialog) vs. mobile (bottom sheet) presentation previously hand-rolled the split with Tailwind breakpoint classes directly in the component's JSX (e.g. `items-end sm:items-center`, `rounded-t-2xl sm:rounded-2xl`), duplicated per modal. The Expenses Workspace redesign's Add/Edit modal needed a materially wider desktop layout (fixing a narrow `max-w-lg` container that read as "poor modal sizing"), which made the duplication cost of the old pattern more visible.
- **Decision:** Introduce `frontend-v2/src/app/components/ui/responsive-dialog.tsx`, built on the already-installed but previously-unused shadcn `Dialog` + `Drawer` primitives and the existing `useIsMobile()` hook, exposing one JSX API (`ResponsiveDialog`, `*Content`, `*Header`, `*Title`, `*Description`, `*Body`, `*Footer`) that resolves to the right underlying primitive. Applied to `AddExpenseModal` and `ExpenseDetailsModal`; not yet retrofitted onto other existing modals (e.g. `TenantPaymentModal`, `ReceiptGenerationModal`) — this was scoped to the Expenses redesign, not a repo-wide sweep.
- **Alternatives considered:** Keep the ad hoc per-modal breakpoint-class pattern; rejected since it was the direct cause of the modal-sizing complaint being fixed, and duplicating the fix once more (a third variant of the same pattern) would compound the problem rather than resolve it.
- **Consequences:** New modals needing this split have one primitive to reach for instead of re-deriving the breakpoint logic. Existing modals using the old pattern are not automatically consistent with it — a future pass would need to migrate them deliberately.
- **Related:** [[Frontend]], [[Changelog]]

## ADR-009: Expense export is a decoupled service (not route-embedded logic), built on a shared query builder, with format-specific streaming strategies

- **Date:** 2026-07-18
- **Status:** accepted
- **Context:** The Expense Export feature requires CSV/XLSX/PDF output that is guaranteed to match whatever filters the owner has applied in the UI, must not load unbounded record sets into memory, and needs to stay extensible toward future scheduled exports / saved report templates without a later redesign.
- **Decision:**
  1. Extract the expenses list WHERE-clause construction out of `expense-service.ts::getAllExpenses` into a standalone exported function, `buildExpenseLedgerWhere()`, and have both the list endpoint and the new export service call it — one filtering implementation, not two that can drift.
  2. Put all export logic in a new `lib/services/expense-export-service.ts` that takes/returns plain data (no `NextRequest`/`Response`), so the HTTP route (`app/api/expenses/export/route.ts`) is a thin adapter; a future cron or template runner can call the same functions directly.
  3. Pick the streaming strategy per format rather than one-size-fits-all: CSV is hand-rolled (trivial to stream correctly, no library needed), XLSX uses `exceljs`'s `WorkbookWriter` (true incremental zip writing — the existing `xlsx`/SheetJS dependency can't stream writes in its free edition), and PDF (`pdf-lib`, matching the existing receipt-PDF convention) is treated as a capped-row business report rather than an unbounded stream, since PDF isn't a practical format for arbitrary-size tabular dumps.
- **Alternatives considered:** Reusing the `xlsx` package for XLSX export (rejected — would require buffering the full row set in memory before writing, defeating the memory-bounded requirement for large exports). Embedding export logic directly in the route handler (rejected — the explicit "modular, no redesign for future scheduled exports" requirement argues for a decoupled service from the start).
- **Consequences:** One more npm dependency (`exceljs`, moderate-severity transitive `uuid` advisory, no direct vulnerability) in exchange for correct streaming behavior. Any future change to expense filtering must go through `buildExpenseLedgerWhere()` — a filter added only to the list route's inline logic would silently not apply to exports, so this is now a single deliberate touch-point to keep in mind.
- **Related:** [[APIs]], [[Changelog]], [[Frontend]]

## See also
- [[Changelog]] for the chronological record of what shipped
- [[Architecture]] for the system these decisions govern
- [[Bugs]] for issues that prompted some of these decisions
