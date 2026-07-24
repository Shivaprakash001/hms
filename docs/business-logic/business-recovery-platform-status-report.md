# Business Recovery Platform — Progress & Status Report

**Date:** 2026-07-20
**Type:** Engineering & Product Status Report (no implementation performed in producing this document)
**Sources reviewed:** `docs/business-logic/operation-recovery-undo-system-proposal.md`, `docs/business-logic/financial-corrections-framework-proposal.md`, `docs/business-logic/business-recovery-platform-architecture.md`, `docs/superpowers/plans/2026-07-20-business-recovery-platform-phase1.md`, `docs/obsidian/Database.md` / `Changelog.md`, and the actual code state in git (main branch + the `worktree-business-recovery-platform-phase1` branch).

---

## 1. Original Problem Statement

Hostel owners regularly make operational mistakes across nearly every module: a payment recorded against the wrong tenant, a room shift entered incorrectly, an admission created in error, an expense logged twice, a draft agreement or renewal offer created by mistake, settings changed accidentally. Today there is no reliable, audited way to correct any of these.

The audit behind these docs found the underlying reasons a simple "Undo" button doesn't work here:

- **Financial records must never be silently reverted.** `payments` rows are immutable by design (enforced — imperfectly, see §3) — a mistake found in a payment can't be "undone" by deleting or editing the row; it has to be corrected the way accounting corrects a ledger: by posting new, explicit, linked entries against the original.
- **Mistakes are often discovered well after any reasonable time window.** The Financial Corrections doc cites a "Scenario 1" (transfer payment, corrected a day later) as the reason a 15–30 minute undo window is the wrong model for money — a correction must be possible whenever discovered, always previewed, always reasoned.
- **Audit trail was already fragmented and unreliable.** Five overlapping, inconsistent log tables were found in the audit (`activity_logs`, `actionLog`, `systemEventLog`, `admin_financial_audit_log`, plus domain-specific logs), and the most-used one (`activity_logs`) writes **after** the business transaction commits, in a swallowed try/catch — meaning it can silently drop or drift from what actually happened. No single one of these could be trusted as "what really happened to this payment/tenant/room."
- **A live example of the danger of ad-hoc undo already existed in production**: the WhatsApp owner assistant's "UNDO EXPENSE" feature is a hard delete with no compensating record and no audit trail — the exact anti-pattern this whole effort exists to replace.
- **Not every mistake has the same blast radius.** Reversing a same-day room shift is safe and cheap; reversing a completed Move-Out or an activated Renewal is not — those require governance, not a one-click undo.

This is why the effort could not simply be "add an Undo button" — it required an audit-first, accounting-style correction model whose mechanism (self-service, timed) differs by how dangerous and how time-sensitive the correction is.

---

## 2. Final Vision

The design went through four stages, each documented and each superseding the previous one's *schema*, while explicitly preserving the previous one's *domain audit findings and mechanics*:

**Simple Undo** *(rejected as the starting frame)* — a generic timed "ctrl-Z" was recognized early as wrong for financial data (§1) and too coarse for high-blast-radius lifecycle actions.

**↓**

**Three-Tier Recovery Model** — recovery was split by risk profile and mechanism:
| Tier | Covers | Mechanism |
|---|---|---|
| 1. Operational Undo | Room Shift, Admission (pre-activation), Reservation, draft Agreement, pending Renewal Offer, Settings, Document Upload, KYC (pre-consumption) | Self-service, timed window (15–30 min), compensating operation |
| 2. Financial Corrections | Payments, allocations, ledger, deposits, future credits | Reason + preview required, never time-boxed; reversal/forward rows, never mutation |
| 3. Administrative Reversal | Completed Move-Out, activated Renewal, post-activation KYC | Routed through the existing governed-approval `change_requests` pipeline, not self-service |

**↓**

**Business Recovery Platform** — the three tiers were then recognized as three *instances of one shape* (a stateful, previewed, audited correction with a lifecycle) rather than three separate systems. The umbrella architecture doc explicitly states: "instead of two independent systems plus a bolt-on Tier 3, there is one platform, one core object, one lifecycle, one self-registering handler seam."

**↓**

**Correction Case architecture** — the final, current abstraction. A **Correction Case** is a first-class stateful entity (not a log row) with its own lifecycle, timeline, audit history, and execution record — intended to become "the primary artifact support staff and owners look at to answer 'what happened to this payment/tenant/room, and what did we do about it,'" replacing the five overlapping log tables from §1.

**Platform philosophy** (explicitly stated, and the load-bearing design constraint for everything downstream):

1. **Compose, don't reimplement.** The platform never contains domain logic — it calls into existing services (`settlement-engine.ts`, `financial-correction-gateway.ts`, `room-allocation-service.ts`, `obligation-engine.ts`) exactly the way `financial-read-model-service.ts` already composes rather than recalculates elsewhere in this codebase.
2. **One table, not one-per-domain.** A `case_detail` JSON payload (validated per-`case_type` by the owning handler, not the platform) keeps new domains pluggable without a schema migration — mirroring the existing `change_requests.before/diff` JSON-snapshot convention already used elsewhere.
3. **Platform code contains zero business rules.** Every "is this allowed right now" question lives behind a `CorrectionPolicy` object owned by the domain, never in the generic lifecycle engine.
4. **No redo.** Once `COMPLETED`, a case is never reopened — consistent across all three prior docs' stance.

---

## 3. Architecture Completed

### ✅ Finalized

- **Correction Case core abstraction** — `correction_cases` (one row per correction) + `correction_case_events` (append-only timeline), superseding the earlier separate `recoverable_operations` (Tier 1) and `payment_corrections` (Tier 2) schemas before either shipped.
- **Recovery Tiers** — `OPERATIONAL_UNDO | FINANCIAL_CORRECTION | ADMINISTRATIVE_REVERSAL`, now a `tier` column on the one object rather than three separate systems.
- **Lifecycle state machine** — `DRAFT → PREVIEW → VALIDATED → EXECUTING → COMPLETED/FAILED`, with `CANCELLED` (from DRAFT) and `EXPIRED` (from PREVIEW/VALIDATED, undo-window only) as the only other exits. `COMPLETED` is the sole true terminal state. `FAILED` is retry-eligible, not terminal.
- **Platform / domain-policy boundary** — `CorrectionPolicy<TDetail>` (`canPreview`, `canExecute`, optional `windowFor`) holds every business rule; the platform's `validate()` is purely mechanical (load case, resolve handler, call policy, row-lock, check dependencies).
- **Validation & Preview Engine** — one domain-agnostic service producing an `ImpactReport` (balance/obligation/ledger changes, affected reports, notifications, warnings) for *any* correction type, rendered through one shared UI component regardless of domain.
- **Correction Handler architecture** — the full interface (`caseType`, `domain`, `tier`, `policy`, `createCase`, `computeImpact`, `execute`, `affectedEntities`) is specified and implemented in code (see below).
- **Self-registering Registry** — plugin-style `correctionRegistry.register()` instead of a hand-maintained switch/map; each domain module registers itself as a side effect of import, mirroring the existing `lib/events/index.ts` pattern.
- **Recovery dependencies** — `depends_on: Uuid[]` makes cross-domain prerequisites (e.g. Admission Undo depending on Room Allocation Undo) explicit and platform-enforced without the platform knowing *why*.
- **Idempotency & safe retry** — unique `idempotency_key` on every case (dedupes double-submit); deterministic per-write idempotency keys (`correction:{caseId}:...`) for the payments table's existing `idempotency_key` column, so a retried `execute()` can't double-write.
- **Event-driven integration** — the platform never calls notification/analytics/WhatsApp directly; every transition publishes through the existing `eventSystem` (`correction_case_transitioned`, plus domain-flavored events like `payment_corrected`).
- **Timeline / Audit model** — one unified `correction_case_events` table replaces the previously-proposed separate `recovery_events` + `payment_correction_events` tables.
- **Transaction model** — recovery record writes happen inside the same `$transaction` as the business mutation they describe (fixing the drift risk identified in the original activity-log audit).
- **Financial integrity principles** — `payments` rows are never mutated or deleted, ever; every correction is new rows only; this is stated as "the one absolute rule; violating it anywhere is a blocking defect, not a style note" in the Phase 1 plan's Global Constraints.
- **Recovery Center** — conceptual UI architecture is finalized (see §8); not yet built.

### ⚠ Still Open

- Whether `case_detail`/policy validation schemas should live centrally or be fully owned by each handler module (Open Question #5 in the architecture doc).
- Retry attempt cap and backoff policy for `FAILED` cases — is retry owner-triggered only, or should anything auto-retry on a cron schedule (Open Question #6)? **Note:** the actual Task 7 implementation deviated from the architecture doc's own prose here — see §11's honesty note.
- Cross-domain dependency **direction** convention when two domains could plausibly depend on either way — a recommendation exists ("the handler owning the earlier action in the original transaction order owns the dependency") but is not confirmed (Open Question #7).
- All four open questions carried from the Financial Corrections doc (see §5/§9) — none has been resolved yet, and one of them (obligation balance representation) blocks the very next implementation task.

---

## 4. Domain Coverage

| Module | Status | Notes |
|---|---|---|
| Payments | **Designed** (Reverse, Transfer, Edit Reference/Notes — Phase 1 scope); Split/Merge/Reallocate designed but deferred to Phase 2 | Only domain with handler-level design detail; only domain in Phase 1's implementation scope |
| Rooms | **Designed** (Room Shift Undo, Room Allocation Undo — Tier 1) | Phase 2 handler; used as the canonical `depends_on` example |
| Admissions | **Designed** (FULL→PARTIAL by tenant status) | Phase 2 handler; discovers a Room Allocation dependency at `createCase()` time |
| Agreements | **Designed** (PARTIAL→NONE once signed) | Not a Phase 1 or explicitly-scheduled Phase 2 handler in the plan's task list |
| Renewals | **Designed** (Offer: Tier 1 FULL; accepted+activated: escalates to Tier 3) | Tier 3 policy formalization is explicit Phase 2 scope, not yet built |
| Expenses | **Designed**, blocked on a schema change | Requires new columns (`voided_at`, `voided_by`, `voided_reason`, `reversal_of_expense_id`) and retiring the current hard-delete path — not started |
| Settings | **Designed** (Tier 1 FULL) | Requires capturing a before-snapshot not currently stored |
| Documents | **Designed** (Tier 1 FULL) | Flip `is_active`; no asset deletion involved |
| Inventory | **Not Started** | Not mentioned in any design document reviewed |
| KYC | **Designed** (PARTIAL→Tier 3 once downstream-consumed) | Phase 2 handler |
| Reservations | **Designed** (Tier 1 FULL, shares executor family with Admission) | Phase 2 handler |
| Move-Out | **Designed** (pre-completion: Tier 1 via existing `cancelRequest()`; completed: Tier 3) | Design lesson explicitly noted: "undo doesn't always mean literally reversing every side effect" |
| Refunds | **Not Started / Not clearly scoped** | Only `refund_status` (gated to `SECURITY_DEPOSIT_REFUNDED`) was found as an existing mutable field; no dedicated correction handler designed |
| Deposits | **Partially Designed** | "Deposit Adjustment" was explicitly reassigned from Tier 1 to Tier 2 (Financial Corrections), but the Financial Corrections doc's own workflow matrix does not list a distinct Deposit workflow — it would fold into the generic obligation-scoped Reverse/Reallocate mechanism; this gap is not called out as an open question in the source docs, so flagging it here |
| Notices | **Not Applicable / Explicitly excluded** | No "Notice" backend entity exists today; doc explicitly flags this as needing product clarification before inclusion and excludes it from v1 |

---

## 5. Financial Corrections Progress

| Workflow | Status |
|---|---|
| **Reverse Payment** | Designed in full (mechanism, ledger impact, edge cases). Phase 1 scope. **Not yet implemented** — this is the platform's next unbuilt task (Task 8/9 of 17). |
| **Transfer Payment** | Designed in full; explicitly identified as "the hard case" (needs a reversal on Tenant A + fresh forward payment on Tenant B, since `tenant_id` can't be edited). Phase 1 scope. **Not yet implemented.** |
| **Split Payment** | Designed (reuses the existing multi-row-per-`payment_group_id` mechanic). **Deferred to Phase 2.** |
| **Merge Payment** | Designed ("batch reverse + single re-settle, not a DB-level merge"). **Deferred to Phase 2.** |
| **Reallocate Payment** | Designed (same-tenant, cross-obligation reversal+forward). **Deferred to Phase 2.** |
| **Edit Reference** | Designed, and **scope-corrected during Phase 1 planning**: covers `payment_groups.reference_number` + `.notes` only — no receipt-upload column exists on `payment_groups`, contradicting the original doc's assumption. Phase 1 scope, **not yet implemented.** |
| **Receipt Replacement** | **Explicitly out of scope** — flagged during Phase 1 planning as needing its own schema investigation; not designed in any detail beyond that flag. |
| **Ledger strategy** | Designed and finalized: every correction posts an explicit debit/credit pair using the long-declared-but-never-used `LEDGER_CORRECTION` reason; never touches an existing ledger entry. Reconciliation invariant defined: re-running `financial-read-model-service.ts`'s composed balance after any correction must match intent — this is the verification method, never a second independent calculation. |
| **Preview Engine** | Designed and **implemented at the platform level** — `recoveryService.preview()` is generic and calls `handler.computeImpact()` for any case type; confirmed working via passing tests in the current build (Task 5). |
| **Risk analysis** | Documented in both source docs' Risk Assessment sections. Top risk (obligation balance stored vs. derived — see §9) remains **open and unresolved**, and blocks writing correct reversal-row logic. |

**Designed but Deferred:** Split, Merge, Reallocate, Receipt Replacement.
**Open Questions specific to this area:** see §9, items 1 and 2.

---

## 6. Operational Undo Progress

All seven Tier 1 actions below were fully designed in the original Operation Recovery doc and remain valid; the umbrella architecture doc's §12 states explicitly that "nothing in either prior doc's domain audit changes" — only the schema/shell around them changed.

- **Room Shift Undo** — Designed (FULL, full window). Not implemented.
- **Admission Undo** — Designed (FULL while `INVITED`, downgrades to PARTIAL once `ACTIVE`). Not implemented; serves as the architecture doc's worked example for cross-case dependencies.
- **Expense Undo** — Designed, but blocked on a schema change (new columns, retiring hard-delete). Not implemented. This is also the path the existing WhatsApp "UNDO EXPENSE" hard-delete feature must eventually migrate onto.
- **Reservation Undo** — Designed (FULL, shares an executor family with Admission). Not implemented.
- **Settings Undo** — Designed (FULL, requires new before-snapshot capture). Not implemented.
- **Document Undo** — Designed (FULL). Not implemented.
- **KYC Undo** — Designed (PARTIAL, escalates to Tier 3 once a downstream activation has consumed the approval). Not implemented.

**Integration into the platform:** none of these are a separate "Recovery Engine" anymore — each becomes a `CorrectionHandler` with `tier: OPERATIONAL_UNDO`, registered on the same `correctionRegistry` as the payment handlers, using the same lifecycle, same `correction_cases` table, same Recovery Center UI. All are explicit Phase 2 scope in the current roadmap (§10) — none is in Phase 1.

---

## 7. Administrative Reversal

**Current design:** Tier 3 covers high-blast-radius, past-the-point-of-simple-undo lifecycle actions — a completed Move-Out, an activated Renewal, a post-activation KYC approval. Rather than inventing a new approval mechanism, it routes through the **existing** `change_requests`/`change_request_events` governed-approval pipeline — infrastructure that already exists in the codebase (`field-classification.ts` already classifies financial fields as "Category D — reversal only") but was never wired up for this purpose until now.

**Integration with the platform:** in the unified Correction Case model, Tier 3 is not a separate mechanism — a Tier 3 case's `validate()` step delegates to the `change_requests` pipeline as a sub-step before the case can reach `VALIDATED`. It uses the same `correction_cases` row, same lifecycle, same timeline as every other tier; only its policy is stricter.

**Finalized:**
- The decision to reuse `change_requests` rather than build a new approval mechanism.
- That completed Move-Out and activated Renewal are intentionally **not** instantly reversible — this is stated explicitly as "by design, not a phasing gap."
- The general shape: owner *requests* the reversal with a reason; it is applied only through the approval flow, never instant self-service.

**Still needs product decisions:**
- Whether routing through the existing `change_requests` pipeline is procedurally *sufficient*, or whether Tier 3 needs a genuinely new approval concept (e.g. a second admin login) that doesn't exist in the codebase today — this is an explicit open question (§9, item 3), unresolved.
- "Formalize Administrative Reversal policies (`canExecute()` → `change_requests` approval sub-step)" is listed as Phase 2 scope and has **not been started** — no code exists for this tier yet, only the conceptual routing decision above.

---

## 8. UI / UX Progress

All UI/UX work to date is **conceptual — ASCII wireframes and component descriptions in markdown design docs.** No visual design (Figma or otherwise) and no frontend code exists yet; the Phase 1 plan's frontend tasks (14–16: query keys, API wrapper, hooks, `RecoveryStatusBadge`, `CorrectionTimeline`, `RecoveryCenterView`) are all still unbuilt.

- **Recovery Dashboard** — Conceptual only. Designed as `/owner/recovery-center`: a filterable (by domain/tier/status) case list with status chips (`Undo Available · 12m left`, `Preview Ready`, `Completed`, `Failed — retry available`, `Blocked on dependency`).
- **Correction Timeline** — Conceptual only, but design intent is clear and consistent across all three source docs: **one shared component for every domain**, rendering `correction_case_events`. Two concrete wireframes exist (Tenant Activity timeline in the Tier 1 doc, Payment correction timeline in the Financial Corrections doc) that this component must satisfy.
- **Preview Screen** — Conceptual mockup exists (Financial Corrections doc §6): Current vs. After Correction diff, plus a Ledger Changes list. Reason field mandatory, Confirm disabled until filled.
- **Validation Screen** — **Not separately designed.** Validation is treated as a backend policy check with no dedicated UI step called out in any doc — it appears to fold into the same confirm dialog as the preview step, not a separate screen. This should be confirmed, not assumed, before UI work starts.
- **Recovery Details / Case History** — Conceptual only, covered by the Recovery Center's "Case detail" design (Timeline, Before/After snapshot, Reason/Performed By/Timestamp, Dependency chain, Original↔Correction linkage) and the separate System Audit Trail wireframe in the Tier 1 doc.

**Bottom line:** every UI surface is agreed at the wireframe/intent level; none is pixel-designed or built.

---

## 9. Open Product Decisions

These are carried verbatim from the source docs — no new ones have been invented for this report.

1. **Is `rent_obligations`'s paid/outstanding amount stored or derived?** Blocks all reversal-row design until confirmed — called out as the **highest-priority open question** across both the Financial Corrections doc and the architecture doc. Getting it wrong "silently corrupts obligation status."
2. **Should `payment_groups` be locked down to the same immutability standard as `payments`**, or intentionally kept as the one editable surface (reference/notes/receipt), as the current design assumes?
3. **What does Tier 3 (Administrative Reversal) actually require procedurally** — is routing through the existing `change_requests` pipeline sufficient, or does it need a genuinely new approval concept (e.g. a second admin login) that doesn't exist today?
4. **Confirm the three-phase financial rollout order** (Reverse/Edit → Reallocate/Split → Transfer/Merge) is acceptable, given Transfer was the original motivating scenario but is also the highest-complexity workflow.
5. **Should `case_detail`/policy validation schemas live centrally, or be fully owned by each handler module** with only a runtime-registered validator?
6. **Retry cap and backoff policy for `FAILED` cases** — owner-triggered "Retry" button only, or should anything auto-retry on a schedule (would need a new cron job)?
7. **Cross-domain dependency direction convention** — when two domains could plausibly depend on either direction, who decides? A convention is recommended (earlier-action-in-original-transaction owns the dependency) but not yet confirmed.
8. **Expense hard-delete retirement** — fully retire the current hard-delete path (including migrating the WhatsApp "UNDO EXPENSE" feature), or keep hard-delete available for non-undo manual edits while only undo-triggered reversals use the new voided/reversal-entry columns?
9. **"Notice Creation" scope** — no such distinct backend entity exists today; needs product clarification (tenant announcement? legal/eviction notice? reminder escalation tier?) before it can be added to any recovery matrix. Currently excluded from v1.
10. **Default undo window** — 15 vs. 20 vs. 30 minutes as the shipped default for Tier 1 (the clamped range 15–30 is agreed; the concrete default is not).
11. **Confirm Tier 1's 3-phase rollout order** (low-blast-radius first: Expense/Settings/Document/Room Shift/Reservation → Payment/Deposit → Admission/Renewal chain-unlink) is acceptable, or whether a specific action needs to move earlier despite higher risk.

---

## 10. Implementation Roadmap

### Phase 1 — **in progress (7 of 17 tasks complete)**
**Scope:** Core platform (schema, lifecycle, registry, idempotent execution, event publishing) + three payment handlers (Reverse, Transfer, Edit Reference) + Recovery Center UI (list + detail), scoped to whatever handlers exist.

**Deliverables completed:**
- `correction_cases` / `correction_case_events` schema + migration
- Payment-immutability invariant regex bug fixed (was silently not enforcing anything — see §11)
- Core platform types (`Actor`, `EntityRef`, `CorrectionPolicy`, `CorrectionHandler`, etc.)
- Self-registering `correction-registry.ts`
- `recoveryService.createCase()` + `preview()` (idempotent on double-submit)
- `recoveryService.validate()` (policy check + dependency gating)
- `recoveryService.execute()` (idempotent retry, event-bus publishing)

**Deliverables remaining:**
- Shared `reverseObligationPayment` helper
- Payment Reversal handler + policy
- Payment Transfer handler + policy
- Edit Reference/Notes handler + policy
- Bootstrap self-registration wiring
- API routes (`/api/recovery/cases/*`)
- Frontend: query keys, API wrapper, hooks
- `RecoveryStatusBadge` + `CorrectionTimeline` components
- `RecoveryCenterView` + route registration
- Final documentation pass

**Dependencies / blockers:** none technical — the platform core is done and unblocks handler work — but Open Question #1 (obligation balance representation) must be resolved before the very next task (the reversal-row helper) can be written correctly.

### Phase 2 — designed, not started
**Scope:** Split/Merge/Reallocate Payment handlers; formalize Administrative Reversal policies (the `change_requests` approval sub-step) for Move-Out, Renewal, KYC; bulk corrections (batch-executing multiple cases via `depends_on`); Tier 1 Operational Undo handlers (Room Shift, Admission, Expense, Settings, Document, Reservation) registered via the same self-registration pattern.
**Dependencies:** Phase 1's platform core and registry pattern (satisfied once Phase 1 ships); the Expense schema migration (new columns, hard-delete retirement) as a prerequisite for the Expense handler; Open Question #3 (Tier 3 procedural requirements) resolved before Administrative Reversal policies can be written correctly.

### Phase 3 — designed, not started
**Scope:** Analytics — correction frequency/pattern dashboards composed from `correction_cases`, following the "compose, don't reimplement" precedent; AI assistance — anomaly-triggered correction suggestions, and migrating the WhatsApp assistant's existing "UNDO EXPENSE" hard-delete onto this platform via the event bus instead of its own ad-hoc logic.
**Dependencies:** Phase 1 + Phase 2 in production, generating enough `correction_cases` data/event volume to be useful.

---

## 11. Overall Progress

An honest, evidence-based estimate, with one important caveat up front: **the implemented code described below exists in an isolated git worktree (`worktree-business-recovery-platform-phase1`, HEAD `3a1ad68f`) and has not been merged to `main`.** `main` currently has none of this — `git ls-tree -r HEAD | grep services/recovery` returns nothing on the branch this report was written from. Anyone resuming implementation needs to either continue in that worktree or merge it first.

| Dimension | Estimate | Basis |
|---|---|---|
| Architecture Progress | ~90% | Three full docs, one explicit refinement pass (6 named refinements), directionally approved per the architecture doc's own status line. Remaining gap is the 7 open questions in §9, not the shape of the system. |
| Backend Design Progress | ~85% | Handler/policy interfaces, lifecycle, registry, and event model are all fully specified and match what was actually implemented. Gap: schema-validation ownership (Q5) and retry policy (Q6) undecided. |
| Business Rules Progress | ~55% | Payment/ledger mechanics are thoroughly audited, but the single most load-bearing business rule — whether obligation balances are stored or derived — is **still unconfirmed**, and it blocks correctness of the very next handler to be built. Tier 3 procedural requirements and the Expense hard-delete question are also unresolved. |
| UI/UX Design Progress | ~30% | Wireframe-level intent is consistent and clear across all docs; zero visual design, zero components built. One screen (Validation) isn't even wireframed — its existence as a separate step is assumed, not confirmed. |
| Implementation Progress | ~15% of Phase 1 scope (7/17 tasks); low single digits of the full multi-phase platform | Platform core (schema, types, registry, full case lifecycle including execute/retry) is built and — per task reports — tested. Zero handlers, zero API routes, zero frontend code exist yet. Zero of Phase 2/3 exists. |
| Testing Progress | Reported passing per each task's completion report (Tasks 1, 4, 5, 6, 7 each added and reportedly passed integration tests) — **not independently re-run as part of producing this report.** Recommend re-running `npx vitest run tests/integration/recovery-cases.test.ts` in the worktree before trusting this. |
| **Overall Completion %** | **~20–25%** | Design-heavy stage essentially complete; implementation just started and not yet on `main`. |

**One additional finding worth flagging honestly:** the Task 7 implementation report notes a **deviation from the written architecture** — the retry cap was implemented as 2 prior `FAILED` attempts (blocking a 3rd), not the 3 attempts described in the architecture doc's prose, because the TDD test suite the implementer wrote/followed expected exactly 3 `execute()` calls total with the 3rd rejecting synchronously. This is a real discrepancy between docs and code that should be reconciled as part of Open Question #6, not silently left inconsistent.

---

## 12. Recommended Next Step

**Resolve Open Question #1 — confirm whether `rent_obligations`'s paid/outstanding amount is a stored, denormalized value or purely derived at read time from summed `payments` — before any further implementation work resumes.**

This is not a new recommendation invented for this report; it is the single item both the Financial Corrections doc and the architecture doc independently flag as the **highest-priority, implementation-blocking open question**, and it sits directly in front of the next unbuilt task (the shared `reverseObligationPayment` helper, Task 8 of 17) — every payment correction handler (Reverse, Transfer, and eventually Split/Merge/Reallocate) depends on getting this right. The Financial Corrections doc states plainly: getting this wrong "silently corrupts obligation status."

Answering it requires nothing more than reading `obligation-engine.ts` and the relevant Prisma schema fields to determine, definitively, how `rent_obligations` balances are computed and maintained today — a read-only investigation, not a design or implementation task, and a natural next action that doesn't require new product input to start (though the *answer* should be confirmed with whoever owns obligation correctness before Task 8 is written).
