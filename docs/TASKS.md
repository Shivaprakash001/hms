# TASKS.md

> Detected issues derived from the codebase. Each item includes the observable
> signal and the exact location. These are **not** speculative — they are
> grounded in code / migration text.

---

## P0 — Runtime-breaking drift

### T-001. `complaints` table dropped but code still queries it

**Detected Issue:** `prisma.complaint.*` calls will fail at runtime on any
database where migration 025 has been applied.

**Signals:**
- `migrations/025_drop_complaints_system.sql` contains
  `DROP TABLE IF EXISTS complaints CASCADE`.
- Prisma still defines model `Complaint`
  (`backend-next/prisma/schema.prisma:396-413`).
- Routes live in `backend-next/app/api/complaints/route.ts` and
  `backend-next/app/api/complaints/[id]/route.ts`.
- `backend-next/lib/services/complaint-service.ts:5-50` calls `prisma.complaint`.
- Frontend pages `frontend/src/pages/owner/Complaints.jsx`,
  `frontend/src/pages/tenant/TenantComplaints.jsx` call these endpoints.

**SOURCE:** files listed above.

**CONFIDENCE:** HIGH

---

### T-002. `complaints.POST` uses `session.sub` as `tenant_id`

**Detected Issue:** `tenant_id` in the `complaints` table is a `tenants.id`
UUID, but the POST handler passes `session.sub` — which is the **profile
id** (JWT payload’s `sub` is the `profiles.id`, per `auth-service.ts:64-68`
and `generateToken` callers). `ComplaintService.createComplaint` then runs
`prisma.tenant.findUnique({ where: { id: data.tenant_id } })`, which will
almost always return null because `tenants.id != profiles.id`.

**Signals:**
- `backend-next/app/api/complaints/route.ts:48-51` (`tenant_id: session.sub`).
- `backend-next/lib/services/complaint-service.ts:35-42` (lookup by
  `tenants.id`).
- `backend-next/prisma/schema.prisma:49-50` shows `Tenant.id` and
  `Tenant.profile_id` are distinct UUIDs.

**SOURCE:** files above.

**CONFIDENCE:** HIGH

---

### T-003. Python backend writes to `students`, but database has `tenants`

**Detected Issue:** `backend/app/api/routes/student_router.py` (21 KB) and
related FastAPI services still operate against `students`. After
`backend-next/prisma/migrations_manual/008_student_to_tenant_rename.sql`
renames `students → tenants`, the Python backend will error on any
Supabase query that references `students`.

**Signals:**
- `backend/app/main.py:12` imports `student_router`.
- `backend-next/prisma/migrations_manual/008_student_to_tenant_rename.sql`
  renames the core table and all `student_id → tenant_id` FK columns.
- Frontend axios base URL points at Next.js deployment, but the Python
  backend is still started/deployed.

**SOURCE:** files above.

**CONFIDENCE:** HIGH

---

### T-004. Conflicting `gender` migrations against renamed table

**Detected Issue:** `migrations/045_add_gender_to_students.sql` targets
`students`, but `backend-next/prisma/migrations_manual/008_student_to_tenant_rename.sql`
renames the table to `tenants`. If 045 runs after 008, it fails silently
(the `IF NOT EXISTS` guards column, not table existence). The
`backend-next/prisma/migrations_manual/add_gender.sql` duplicates the intent
but still uses the old `students` name:
`ALTER TABLE students ADD COLUMN IF NOT EXISTS gender TEXT`.

**Signals:**
- `migrations/045_add_gender_to_students.sql:1-2`
- `backend-next/prisma/migrations_manual/add_gender.sql:1`
- Runtime fallback `backend-next/lib/services/tenant-service.ts:245-256`
  strips `gender` from the payload when a message containing `tenants.gender`
  surfaces — direct evidence the drift has been hit in production.

**SOURCE:** files above.

**CONFIDENCE:** HIGH

---

## P1 — Partial / stubbed implementations

### T-005. `/api/plans` ignores the seeded `plans` table

**Detected Issue:** Migration 031 seeds three plans
(`STARTER`, `PRO`, `BUSINESS`) into `plans`. The endpoint
`backend-next/app/api/plans/route.ts:8-32` returns a hard-coded JS array with
only two items, and the Prisma schema has no `Plan` model.

**Signals:**
- `migrations/031_create_billing_and_plans_tables.sql` (seed block).
- `backend-next/app/api/plans/route.ts` (static response).
- `backend-next/prisma/schema.prisma` (no Plan/Subscription/Invoice models).

**SOURCE:** files above.

**CONFIDENCE:** HIGH

---

### T-006. `BillingService` returns hard-coded usage limits & subscription

**Detected Issue:** `getOwnerUsage` hard-codes limits
`{ rooms: 50, hostels: 1, tenants: Infinity }`. `getSubscriptionDetails`
returns a literal STARTER plan with empty `billing_history`. No DB read of
`owner_subscriptions` or `owner_invoices`.

**SOURCE:** `backend-next/lib/services/billing-service.ts:11-42`.

**CONFIDENCE:** HIGH

---

### T-007. `/api/auth/refresh` is whitelisted but no route file exists

**Detected Issue:** `middleware.ts` includes `/api/auth/refresh` in
`PUBLIC_ROUTES`, but `find … -name route.ts` returns no
`app/api/auth/refresh/route.ts`. Any refresh request will 404.

**Signals:**
- `backend-next/middleware.ts:8` (`"/api/auth/refresh"`).
- Directory listing of `backend-next/app/api/auth/` contains six files
  (`change-password`, `google-callback`, `login`, `logout`, `me`, `register`),
  no `refresh`.

**SOURCE:** files above.

**CONFIDENCE:** HIGH

---

### T-008. Dashboard variable typo `undpaidObligations`

**Detected Issue:** Typo in variable name inside owner stats computation.
Not a functional bug, but indicates the code has not been reviewed carefully;
paired with the `rent_collected_this_month` being set to `currentRevenue`
(already counted in `revenue`), suggests a potential double-surface of the
same number.

**Signals:** `backend-next/lib/services/dashboard-service.ts:37, 70`.

**SOURCE:** file above.

**CONFIDENCE:** HIGH (typo), LOW (whether it's intended that
`rent_collected_this_month == revenue`).

---

### T-009. Frontend hard-codes production API base URL

**Detected Issue:** `frontend/src/api/axios.js:6-14` always sets
`baseURL = 'https://hms-r68g.vercel.app/api'` in non-localhost environments,
overriding `VITE_API_URL`. Any self-hosted / staging / preview deploy of the
SPA still calls the production API.

**SOURCE:** `frontend/src/api/axios.js:3-14`.

**CONFIDENCE:** HIGH

---

### T-010. Two auth storage strategies coexist

**Detected Issue:** Backend issues both an HTTP-only `hms_session` cookie
*and* returns `access_token` in JSON. Frontend axios interceptor puts the
token into `Authorization: Bearer …` from `localStorage.ownerUser` /
`tenantUser` while also sending `withCredentials: true`. Either storage
alone would be enough; having both broadens the XSS surface.

**Signals:**
- `backend-next/app/api/auth/login/route.ts:26-35`.
- `frontend/src/api/axios.js:19, 38-50`.

**SOURCE:** files above.

**CONFIDENCE:** HIGH

---

### T-011. PhonePe webhook always returns 200, even on internal error

**Detected Issue:** Errors inside `handlePaymentWebhook` are caught and the
route returns `{ success: true, status: "acknowledged_with_internal_error" }`
with status 200. This hides real failures from PhonePe and from monitoring.

**Signals:** `backend-next/app/api/webhooks/payments/phonepe/route.ts:70-80`.

**SOURCE:** file above.

**CONFIDENCE:** HIGH (existence); design-choice caveat per inline comment.

---

### T-012. Webhook verification iterates up to 20 pending attempts per provider

**Detected Issue:** `paymentService.handlePaymentWebhook` fetches the 20
most recent `PENDING` attempts and loops, calling `instance.verifyWebhook`
on each to find a match. Under high load this is O(N) per webhook and can
miss attempts older than the top 20.

**Signals:** `backend-next/lib/services/payment-service.ts:602-651`.

**SOURCE:** file above.

**CONFIDENCE:** HIGH

---

## P2 — Inconsistencies / dead code / weak signals

### T-013. Two parallel migration directories with overlapping numbering

**Signals:** `migrations/*.sql` (51 files) vs.
`backend-next/prisma/migrations_manual/*.sql` (14 files). No documented apply
order.

**SOURCE:** directory listings.

**CONFIDENCE:** HIGH (fact), LOW (whether it is actually a bug — no declarative
order exists in code).

---

### T-014. Python backend has its own `reconcile` loop that may duplicate Next.js work

**Signals:** `backend/app/main.py:82-89` starts an asyncio loop that calls
`payment_service.reconcile_pending_payment_attempts()` every 900s. The
Next.js side exposes `/api/payments/reconcile` (manual) — `[INSUFFICIENT
EVIDENCE]` whether both are still wired to the same database.

**SOURCE:** file above.

**CONFIDENCE:** HIGH for existence; MEDIUM for impact.

---

### T-015. `profile_type` defaults to `"STUDENT"` despite rename

**Signals:** `backend-next/prisma/schema.prisma:51` —
`profile_type String @default("STUDENT")`. The surrounding enums and code now
use `TENANT`.

**SOURCE:** file above.

**CONFIDENCE:** HIGH (fact), MEDIUM (severity).

---

### T-016. `dashboard-service.getTenantStats` returns `"Not Assigned"` string in a numeric-friendly payload

**Signals:** `backend-next/lib/services/dashboard-service.ts:143` sets
`room_no` to the string `"Not Assigned"` when no active allocation exists,
mixing string/enum-like signal into what otherwise appears to be a
real `room_no` string. Consumers must treat this as a sentinel.

**SOURCE:** file above.

**CONFIDENCE:** HIGH

---

### T-017. `invoices/[id]` response shape undocumented

**Signal:** `backend-next/app/api/invoices/[id]/route.ts` plus a 15 KB
`invoice-service.ts` — not read in full for this audit.

**Status:** `[RESPONSE STRUCTURE UNKNOWN]`.

---

### T-018. Cron scheduling mechanism unknown

**Signal:** Three `/api/cron/*` routes but no `crons` section verified in
`backend-next/vercel.json` (only 191 bytes).

**Status:** `[INSUFFICIENT EVIDENCE]` — may be scheduled externally, via
GitHub Actions (`.github/workflows/db-backup.yml` exists but is for DB
backup, not rent generation).

---

### T-019. Legacy role `STUDENT` still referenced in comments

**Signals:** Comments in `backend-next/lib/services/auth-service.ts:251`
("default to OWNER/ADMIN for now as per Python") and `profile_type` default
indicate that some code paths still reflect the pre-rename model.

---

### T-020. `db-backup.yml` references pre-rename `students` table and stale `payments` columns

**Detected Issue:** The GitHub Actions workflow that runs daily backups:
1. Exports a payments CSV using columns that no longer exist
   (`p.student_id`, `p.amount`, `p.status`, `p.month`, `p.year`) — current
   schema uses `tenant_id`, `amount_paid`, no top-level `status`, and no
   `month`/`year` columns (Prisma model `Payment`,
   `backend-next/prisma/schema.prisma:248-274`).
2. The weekly restore-verification step counts `students` as a critical
   table — renamed to `tenants` by
   `backend-next/prisma/migrations_manual/008_student_to_tenant_rename.sql`.

Both steps will fail on the current production database, silently
degrading the backup safety net.

**Signals:**
- `.github/workflows/db-backup.yml:246-261` (CSV `SELECT`).
- `.github/workflows/db-backup.yml:421` (`tables=(payments payment_attempts payment_webhook_events rent_obligations profiles students rooms hostels)`).
- `backend-next/prisma/schema.prisma:248-274` (current payments columns).

**SOURCE:** files above.

**CONFIDENCE:** HIGH

---

## Appendix — TODO / FIXME scan

`grep -rE "TODO|FIXME|HACK"` across `backend-next/` (excluding `node_modules`)
returned no in-source TODOs; the only matches were in vendored dependencies.
The repo's explicit TODO list lives in top-level `progress.txt`
(`HMS Project Progress` — marks Phase 1-4 as COMPLETED).

**SOURCE:** `progress.txt:1-22`.

**CONFIDENCE:** HIGH
