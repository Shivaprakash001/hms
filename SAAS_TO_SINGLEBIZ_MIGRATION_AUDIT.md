# HMS → Single-Business Migration Audit
**Apna Ghar / Trishul Solutions**
**Date:** May 2026 | **Status:** Pre-execution

---

## 1. Executive Summary

HMS is currently engineered as a multi-owner SaaS platform. The pivot collapses the
"many owners" dimension while keeping "many hostels → many tenants" intact.

**What changes:** Owner treasury settlement, SaaS billing, owner onboarding, plan gating,
owner self-registration, owner finance UX.

**What stays:** Hostel isolation, payment verification, webhook idempotency, rent generation,
reconciliation, receipts, reminders, policy engine, move-out workflow, bulk import.

---

## 2. Systems Inventory

### 2A — REMOVE (SaaS infrastructure, no operational value)

| System | Files | DB Tables | Risk |
|--------|-------|-----------|------|
| Owner settlement ledger | `settlement-ledger-service.ts` | `owner_settlement_ledger` | HIGH — coupled inside `payment-service.ts` |
| Settlement batches | `settlement-batch-service.ts` | `settlement_batches`, `settlement_batch_items` | MEDIUM — admin UI only |
| SaaS billing / invoices | `billing-service.ts`, `billing-validation.ts`, `invoice-service.ts` | `owner_invoices`, `owner_subscriptions` | HIGH — plan gates deeply coupled |
| Plan enforcement | `plan-enforcement-service.ts`, `plan-gate-service.ts` | `plans`, `overflow_ledger`, `owner_usage_snapshots` | HIGH — gates receipts, automation, analytics |
| Overflow billing | `overflow-billing-service.ts` | `overflow_ledger` | MEDIUM — cron job |
| Owner activation/onboarding | `activation-service.ts`, `activation-analytics-service.ts` | `owner_onboarding_states` | LOW — isolated |
| Owner abandonment tracking | `abandonment-service.ts` | none (reads only) | LOW — cron job |
| Autopay | `autopay-service.ts` | `autopay_attempts` | LOW — subscription only |
| Owner financial views | `owner-financial-view-service.ts` | — | MEDIUM — references settlement ledger |
| Message packs (addon) | `addon` routes | `addon_transactions`, `addonUsage`, `message_packs` | LOW — isolated |
| Google form prompt | `google-form-prompt-service.ts` | — | LOW — isolated |
| Owner finance dashboard | `OwnerFinance.jsx`, `OwnerFinanceTransfers.jsx` | — | LOW — UI only |
| Billing UI | `BillingPlans.jsx` | — | LOW — UI only |
| Onboarding UI | 19 pages in `/pages/onboarding/` | — | LOW — UI only |
| Owner registration | `Signup.jsx`, `/api/auth/register` | — | MEDIUM — public endpoint |
| Admin settlement API | `/api/admin/settlements/` (13 routes) | — | LOW — admin UI only |
| Admin activation analytics | `/api/admin/activation-analytics/` | — | LOW — isolated |

### 2B — PRESERVE (operational core)

| System | Files | Notes |
|--------|-------|-------|
| Payment processing | `payment-service.ts` | Needs settlement ledger write removed |
| Financial calculations | `financial-service.ts` | Safe, hostel-scoped |
| Reconciliation engine | `financial-reconciliation-service.ts` | Scope narrows: remove owner payout detectors |
| Financial invariants | `financial-invariant-service.ts` | Keep all detectors |
| Rent generation | `rent-generation-service.ts` | Fully hostel-scoped |
| Receipts | `receipt-service.ts` | Keep — remove plan gate |
| Reminders | `reminder-service.ts` | Keep — remove addon-credit gate |
| Policy engine | `hostel-policy-service.ts` | Keep entirely |
| Collection strategy | `collection-strategy-service.ts` | Keep entirely |
| Hostel daily snapshots | `hostel-daily-snapshot-service.ts` | Keep — becomes portfolio basis |
| Dashboard service | `dashboard-service.ts` | Keep — remove owner-settlement stats |
| Tenant service | `tenant-service.ts` | Keep — remove plan limit checks |
| Property service | `property-service.ts` | Keep — remove hostel_limit checks |
| Move-out workflow | `move-out-service.ts` | Keep entirely |
| Bulk import | `bulk-import-validation-service.ts` | Keep — remove plan gate |
| Analytics | `analytics-service.ts` | Keep — remove analytics plan gate |
| Invitation service | `invitation-service.ts` | Keep — remove tenant_limit gate |
| Advance ledger | `tenant-advance-service.ts` | Keep entirely |
| Auth service | `auth-service.ts` | Keep — OWNER role handling needs cleanup |
| Email / message | `email-service.ts`, `message-service.ts` | Keep entirely |

### 2C — REFACTOR (keep but simplify)

| System | Change Needed |
|--------|---------------|
| `payment-service.ts` | Remove `settlementLedgerService` write, `planEnforcementService` receipt gate, `abandonmentService` calls |
| `middleware.ts` | Remove OWNER-specific owner_id validation (line 86–91) |
| `auth-service.ts` | Register endpoint: disable or make ADMIN-only |
| `hostel-context.ts` | Remove owner_id propagation assumptions |
| `financial-reconciliation-service.ts` | Remove owner payout / settlement batch detectors |
| `dashboard-service.ts` | Remove settlement balance stats |
| `reminder-service.ts` | Remove addon-credit gating, keep rate limiting |
| `property-service.ts` | Remove hostel_limit plan gate |
| `tenant-service.ts` | Remove tenant_limit plan gate |
| `analytics-service.ts` | Remove analytics plan gate |
| Role enum | Add STAFF (or reuse WARDEN), eventually remove OWNER |
| Frontend `App.jsx` | Remove onboarding routes, billing/finance routes |
| Frontend `ProtectedOwnerRoute` | Accept ADMIN role |

---

## 3. Database Risk Map

### 3A — Tables to EVENTUALLY decommission (DO NOT DELETE YET)
```
owner_settlement_ledger      — append-only; keep for audit trail, stop writing
settlement_batches           — batch payout history; keep read-only
settlement_batch_items       — same
owner_invoices               — HMS billing history; keep read-only
owner_subscriptions          — plan history; keep read-only
plans                        — plan definitions; keep read-only (gate removal refs this)
overflow_ledger              — keep read-only
owner_usage_snapshots        — keep read-only
owner_onboarding_states      — can be soft-dropped once confirmed unused
autopay_attempts             — keep read-only
addonTransactions / addonUsage / message_packs — keep read-only
```

### 3B — owner_id on OPERATIONAL tables (DO NOT REMOVE - make nullable progressively)

| Table | owner_id | Current nullability | Action |
|-------|----------|-------------------|--------|
| `hostels` | FK to profiles | NOT NULL | Long-term: reassign to admin profile ID |
| `paymentAttempt` | owner attribution | NOT NULL | Make nullable — was sourced from session |
| `complaints` | owner routing | NOT NULL | Make nullable |
| `rent_generation_ledgers` | idempotency key | NOT NULL (unique constraint includes it) | CAREFUL — unique key change |
| `move_out_requests` | owner routing | NOT NULL | Make nullable |
| `exit_settlement_transactions` | audit trail | NOT NULL | Make nullable |
| `tenants` | owner attribution | NULLABLE | Safe — already nullable |
| `payments` | attribution | NULLABLE | Safe — already nullable |
| `receipts` | attribution | NULLABLE | Safe — already nullable |
| `rent_obligations` | attribution | NULLABLE | Safe — already nullable |

### 3C — Role Enum Change

Current: `ADMIN | OWNER | WARDEN | TENANT`
Target: `ADMIN | STAFF | TENANT` (WARDEN → STAFF, OWNER → ADMIN)

**Risk:** Role is stored in JWT + DB `profiles.role` column. Any enum removal requires:
1. Migrate all `role='OWNER'` rows to `role='ADMIN'`  
2. Migrate all `role='WARDEN'` rows to `role='STAFF'`  
3. Add STAFF to enum (additive — safe)
4. Only remove OWNER/WARDEN after all JWTs expire (~24h)

---

## 4. Dangerous Coupling Points

### CP-1 — `payment-service.ts` → `settlementLedgerService` (CRITICAL)
**Location:** `lib/services/payment-service.ts` line 23 import + call inside payment confirmation  
**Risk:** Removing without patching breaks payment confirmation flow  
**Fix:** Comment out settlement write; payment still confirms correctly without ledger  

### CP-2 — `payment-service.ts` → `planEnforcementService` (HIGH)
**Location:** `payment-service.ts` line 14 — receipt generation plan gate  
**Risk:** Removing gate without replacement means no receipt generated for any plan  
**Fix:** Replace `planEnforcementService.assertReceiptGeneration()` with unconditional allow  

### CP-3 — `middleware.ts` — OWNER role validation (HIGH)
**Location:** `middleware.ts` lines 86–91  
**Risk:** Every ADMIN/OWNER API call passes `x-owner-id` header. If OWNER role is removed
but admin users still have `role='OWNER'` in DB, all their requests get 401.  
**Fix:** Remove the OWNER-specific guard first, then migrate roles  

### CP-4 — `plan-gate-service.ts` gates reminder credits (MEDIUM)
**Location:** `reminder-service.ts` calls `planGateService.assertReminderCredits()`  
**Risk:** Removing plan gates unconditionally enables reminders — desired outcome, but
the addon credit deduction logic must also be removed cleanly  
**Fix:** Replace gate check with no-op; remove `addonUsage` deduction call  

### CP-5 — `rent_generation_ledgers` unique key includes `owner_id` (HIGH)  
**Location:** `@@unique([owner_id, hostel_id, rent_month, obligation_type])`  
**Risk:** Making `owner_id` nullable changes the unique constraint semantics (NULLs don't
participate in unique constraints in PostgreSQL) → potential duplicate rent generation  
**Fix:** Do NOT make `owner_id` nullable here. Use a system admin ID for new records.  

### CP-6 — `paymentAttempt.owner_id` is NOT NULL (HIGH)
**Location:** `schema.prisma` — `paymentAttempt.owner_id String @db.Uuid` (no `?`)  
**Risk:** Every payment initiation reads `x-owner-id` from JWT header. After role migration,
ADMIN users must still produce an `owner_id` value (their own profile ID is fine)  
**Fix:** Phase this — keep owner_id populated from `req.headers["x-owner-id"]` or
fallback to user_id, then make nullable in a later DB migration  

### CP-7 — `hostel.owner_id` FK (MEDIUM)
**Location:** `hostels.owner_id` → `profiles.id` FK  
**Risk:** All hostel reads join or filter by `owner_id`. Multi-hostel access control
currently relies on owner_id match between hostel and JWT.  
**Fix:** Keep FK temporarily. After OWNER→ADMIN role migration, hostel.owner_id
will point to the single admin profile. Access control moves to role-based.  

### CP-8 — `financial-reconciliation-service.ts` owner settlement detectors (MEDIUM)
**Location:** `financial-reconciliation-service.ts` — detects ledger drift, batch failures  
**Risk:** Removing settlement infrastructure while reconciliation still queries it  
**Fix:** Remove owner-settlement detector classes only; keep payment integrity detectors  

---

## 5. Payment Integrity Checklist (MUST NOT REGRESS)

- [ ] `payments` table remains append-only (no UPDATE/DELETE)  
- [ ] `payment_webhook_events.event_hash` uniqueness still enforced  
- [ ] `paymentAttempt.merchant_txn_id` uniqueness still enforced  
- [ ] `payments.idempotency_key` uniqueness still enforced  
- [ ] Webhook signature verification unchanged  
- [ ] PhonePe/Razorpay provider config remains hostel-scoped  
- [ ] Receipt generation triggers on payment confirmation  
- [ ] `financial_invariant_failures` detection still runs  

---

## 6. Auth Risk Summary

| Risk | Severity | Mitigation |
|------|----------|------------|
| OWNER role in JWT after role removed from enum | CRITICAL | Migrate DB first, wait for token expiry before removing enum value |
| `x-owner-id` header absent for admin-role users | HIGH | Keep populating it from profile.id for ADMIN role |
| Owner self-registration endpoint public | HIGH | Disable or gate behind ADMIN auth immediately |
| WARDEN role access | LOW | WARDEN still works; rename to STAFF later |

---

## 7. Reconciliation Impact

### Remove these detectors:
- `LEDGER_DRIFT` — settlement ledger balance vs payments sum
- `BATCH_FAILURE` — settlement batch items stuck PENDING
- `OWNER_PAYOUT_MISSING` — owner owed but no batch created

### Keep these detectors:
- `DUPLICATE_PAYMENT` — duplicate payments on same obligation
- `WEBHOOK_MISMATCH` — webhook status vs DB status
- `ORPHAN_OBLIGATION` — obligation with no allocation
- `BALANCE_DRIFT` — hostel financial drift
- `FAILED_RECEIPT` — receipt generation failures
- `HOSTEL_CONTAMINATION` — payment pointing to wrong hostel

---

## 8. Frontend Impact Map

### Remove entirely:
- `/onboarding/*` (all 19 pages) — owner sign-up wizard
- `/dashboard/billing` → `BillingPlans.jsx`
- `/dashboard/finance` → `OwnerFinance.jsx`
- `/dashboard/finance/transfers` → `OwnerFinanceTransfers.jsx`
- `Portfolio.jsx` → redesign as business portfolio (aggregate across all hostels)

### Rename/refactor:
- `ProtectedOwnerRoute` → accept ADMIN role (rename to `ProtectedAdminRoute`)
- `PortfolioLayout` → `AdminLayout` (top-level nav; remove billing/finance links)
- Owner terminology in sidebar/nav → "Management" or "Admin"
- `OwnerSettings.jsx` → `AdminSettings.jsx` / `BusinessSettings.jsx`

### Keep intact:
- All `/dashboard/:hostelId/*` routes — fully operational
- All tenant routes
- `AdminReconciliation.jsx`

---

## 9. Proposed Migration Order (Phase Plan)

### PHASE 1 — Settlement Ledger Isolation (1–2 days)
**Goal:** Stop all new writes to owner_settlement_ledger without breaking payments.
- In `payment-service.ts`: comment out / feature-flag `settlementLedgerService` calls
- In `payment-service.ts`: remove `abandonmentService` calls
- Verify: payment confirmation still works, receipts still generate
- Do NOT delete tables

### PHASE 2 — Plan Gate Removal (1–2 days)
**Goal:** Replace all plan gates with unconditional operational access.
- Replace `planEnforcementService.assert*()` calls with no-ops in:
  - receipt generation
  - bulk import
  - analytics access
  - tenant limit checks in invitation/service
  - hostel limit checks in property-service
- Replace `planGateService.assertReminderCredits()` with simple rate limit
- Remove addon credit deduction from reminder flow
- Verify: reminders, receipts, analytics, bulk import all function without subscription

### PHASE 3 — Auth Simplification (1 day)
**Goal:** Remove OWNER-specific JWT constraints; add STAFF role.
- `middleware.ts`: remove lines 86–91 (OWNER must have owner_id guard)
- `auth-service.ts`: register endpoint → admin-only or disable public access
- DB migration: add STAFF to Role enum (additive, safe)
- DB migration: `UPDATE profiles SET role='ADMIN' WHERE role='OWNER'`
- Update `ProtectedOwnerRoute` → accept ADMIN role
- Update JWT generation: ADMIN role users set `owner_id = user_id` (temporary compat)

### PHASE 4 — UI Cleanup (2–3 days)
**Goal:** Remove SaaS-facing UI, rename owner → admin terminology.
- Remove onboarding routes from `App.jsx`
- Remove BillingPlans, OwnerFinance, OwnerFinanceTransfers routes
- Remove nav links to billing/finance in PortfolioLayout
- Redesign Portfolio.jsx as business-level aggregate dashboard
- Rename "Owner" labels in sidebar/nav

### PHASE 5 — Admin Routes Decommission (1 day)
**Goal:** Remove admin settlement management API.
- Remove `/api/admin/settlements/` routes
- Remove `/api/admin/activation-analytics/`
- Remove `/api/billing/` routes (message-quota, overflow, plans, upgrade)
- Remove `/api/usage/`, `/api/subscription/`, `/api/addons/`
- Remove `/api/owner/finance/` routes
- Keep `/api/plans/` public route stub (can return empty or 410 Gone)

### PHASE 6 — Reconciliation Scope Reduction (1 day)
**Goal:** Remove owner-settlement detectors from reconciliation engine.
- In `financial-reconciliation-service.ts`: remove/skip LEDGER_DRIFT, BATCH_FAILURE,
  OWNER_PAYOUT_MISSING detectors
- Keep all payment integrity detectors

### PHASE 7 — DB Schema Cleanup (deferred, 1 sprint)
**Goal:** Clean nullable owner_id columns. Decommission dead tables.
- Make `owner_id` nullable on: `complaints`, `move_out_requests`,
  `exit_settlement_transactions`, `paymentAttempt`, `room_activity_logs`
- CAREFUL: `rent_generation_ledgers` unique key — use system admin ID, not null
- After OWNER role fully migrated and no active sessions: remove OWNER from Role enum
- After 30+ days of zero writes: archive/drop settlement tables

---

## 10. Rollback Strategy Per Phase

| Phase | Rollback |
|-------|---------|
| Phase 1 | Re-enable `settlementLedgerService` import; no DB change |
| Phase 2 | Re-add plan gate assertions; no DB change |
| Phase 3 | Revert middleware; DB migration is additive (STAFF enum stays, harmless) |
| Phase 4 | Revert App.jsx routing; no backend impact |
| Phase 5 | Restore route files from git; no DB change |
| Phase 6 | Restore reconciliation detectors; no DB change |
| Phase 7 | DB schema changes need reverse migration; HIGH risk — plan carefully |

---

## 11. Execution Start: Phase 1

**Immediate next action:**  
In `payment-service.ts`, identify and comment-out all `settlementLedgerService` and
`abandonmentService` call sites. Then verify payment flow end-to-end.

**Verification command after Phase 1:**
```bash
grep -r "settlementLedgerService\|abandonmentService" backend-next/lib/services/payment-service.ts
# Should return zero active call sites
```

**Regression tests to run after each phase:**
```bash
cd backend-next && npx jest --testPathPattern="financial-reconciliation|settlement-ledger|payment-service|rent-generation"
```
