# TASKS.md

> Documented issues and technical debt in the HMS system.
> Last updated: May 2026 (Phase 1 Complete)

---

## Phase 1 Stabilization (COMPLETED ✅)

### ✅ T-001. Python Backend Removed
- **Status:** COMPLETED
- **Action:** Deleted `backend/` directory, cleaned frontend references
- **Files:** `.venv`, `.pytest_cache` removed; frontend axios points only to `backend-next/`

### ✅ T-002. Complaints Feature Removed
- **Status:** COMPLETED
- **Action:** Deleted API routes, service, Prisma model, frontend pages
- **Files:** `backend-next/app/api/complaints/`, `complaint-service.ts`, Prisma `Complaint` model, `Complaints.jsx`

### ✅ T-003. Migrations Consolidated
- **Status:** COMPLETED
- **Action:** Raw SQL moved to archive folders
- **Files:** `migrations/archive/`, `backend-next/prisma/migrations_manual/archive/`
- **Source of Truth:** `backend-next/prisma/schema.prisma`

### ✅ T-004. Auth Refresh Implemented
- **Status:** COMPLETED
- **Action:** Created 2-token system
- **Files:** 
  - New: `app/api/auth/refresh/route.ts`, `RefreshToken` Prisma model
  - Updated: `login/route.ts`, `logout/route.ts`, `auth-service.ts`
  - Security: Token rotation, reuse detection (epoch marker), session revocation

### ✅ T-005. Payment Webhook Hardened
- **Status:** COMPLETED
- **Action:** Replaced O(N) loop with O(1) direct lookup
- **Files:** `payment-service.ts:handlePaymentWebhook`
- **Security:** Idempotency check, atomic DB update with `where: { status: "PENDING" }`

### ✅ T-006. Webhook Spoofing Prevention
- **Status:** COMPLETED
- **Action:** Added provider API verification (source of truth)
- **Files:** `payment-service.ts:handlePaymentWebhook`
- **Security:** Always calls `fetchStatus()` to verify against PhonePe API directly

### ✅ T-007. Race Condition Prevention
- **Status:** COMPLETED
- **Action:** Optimistic concurrency control + pessimistic locking
- **Files:** `payment-service.ts:finalizePaymentAttempt`, `recordPayment`
- **Mechanism:** `where: { status: "PENDING" }` + `SELECT ... FOR UPDATE`

### ✅ T-008. PhonePe API Timeout Handling
- **Status:** COMPLETED
- **Action:** Added abort signals
- **Files:** `payments/providers/phonepe.ts`
- **Timeouts:** OAuth (5s), Create Order (8s), Fetch Status (5s)

### ✅ T-009. Refresh Token Reuse Detection
- **Status:** COMPLETED
- **Action:** Epoch marker + session revocation
- **Files:** `app/api/auth/refresh/route.ts`
- **Behavior:** If reused token detected → DELETE ALL user sessions

### ✅ T-010. Webhook Data Loss Prevention
- **Status:** COMPLETED
- **Action:** Persist raw payload on API failure
- **Files:** `payment-service.ts:handlePaymentWebhook`
- **Behavior:** Saves `raw_webhook_payload` before re-throwing

### ✅ T-011. Reconciliation Cron Job
- **Status:** COMPLETED
- **Action:** Created hourly reconcile job
- **Files:** `app/api/cron/reconcile-payments/route.ts`, `vercel.json`
- **Schedule:** Hourly (`0 * * * *`)

### ✅ T-012. Logging & Metrics
- **Status:** COMPLETED
- **Action:** Structured logging + metrics endpoint
- **Files:** `lib/logger.ts`, `lib/metrics.ts`, `app/api/metrics/route.ts`

---

## Remaining Technical Debt

| ID | Issue | Status | Priority |
|----|-------|--------|----------|
| T-013 | Plans/Subscription tables unused | KNOWN | LOW |
| T-014 | ESLint config missing | KNOWN | LOW |

---

## Resolved Issues (Summary)

| ID | Issue | Status |
|----|-------|--------|
| T-001 | Python backend legacy | ✅ RESOLVED |
| T-002 | Complaints feature | ✅ RESOLVED |
| T-003 | Migration conflict | ✅ RESOLVED |
| T-004 | Auth refresh missing | ✅ RESOLVED |
| T-005 | Webhook O(N) lookup | ✅ RESOLVED |
| T-006 | Webhook spoofing | ✅ RESOLVED |
| T-007 | Race conditions | ✅ RESOLVED |
| T-008 | API timeouts | ✅ RESOLVED |
| T-009 | Token reuse | ✅ RESOLVED |
| T-010 | Webhook data loss | ✅ RESOLVED |
| T-011 | No reconciliation | ✅ RESOLVED |
| T-012 | Missing observability | ✅ RESOLVED |

**Last Updated:** May 2026