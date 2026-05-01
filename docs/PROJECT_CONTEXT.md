# PROJECT_CONTEXT.md

> Forensic audit. Every fact below is derived from explicit code. Unverified
> behavior is marked `[UNKNOWN — NOT FOUND IN CODE]` or `[INSUFFICIENT EVIDENCE]`.

---

## 1. Repository layout (top level)

**FACT:** The repository contains three active code trees plus SQL migrations.

**SOURCE:**
- `backend/` — Python FastAPI service (`backend/app/main.py`)
- `backend-next/` — Next.js 14 App Router API (`backend-next/app/api/`, `backend-next/package.json`)
- `frontend/` — Vite + React 19 SPA (`frontend/package.json`, `frontend/src/App.jsx`)
- `migrations/` — 51 raw `.sql` files applied against Supabase (`migrations/*.sql`)
- `backend-next/prisma/migrations_manual/` — 14 additional manual SQL files

**CONFIDENCE:** HIGH

---

## 2. Which backend the frontend talks to

**FACT:** The SPA hard-codes its production API base URL to
`https://hms-r68g.vercel.app/api` and ignores `VITE_API_URL` outside `localhost`.
In localhost it defaults to `http://localhost:3000/api` (the Next.js dev port).

**SOURCE:** `frontend/src/api/axios.js:6-14`

**CONFIDENCE:** HIGH

**FACT:** Next.js routes live under `backend-next/app/api/**/route.ts` (87
route files). The Python FastAPI backend under `backend/` has its own router
tree but is not referenced by the frontend axios config.

**SOURCE:** `backend-next/app/api/` (enumerated via `find … -name route.ts`),
`backend/app/main.py:91-101`

**CONFIDENCE:** HIGH

---

## 3. Feature inventory (visible in code)

Only features with matching frontend pages AND backend services are listed.
Partial / orphaned items are flagged.

### 3.1 Authentication

**FACT:** Email/password login, registration for owners, Google OAuth callback,
password change, logout, and a JWT-cookie session are implemented.

**SOURCE:**
- `backend-next/lib/services/auth-service.ts:30-80, 81-159, 161-184, 186-194, 208-280`
- `backend-next/app/api/auth/{login,register,logout,change-password,google-callback,me}/route.ts`
- `frontend/src/pages/auth/{Login,Register,GoogleCallback,ActivateAccount,CompleteProfile}.jsx`

**CONFIDENCE:** HIGH

**FACT:** JWT is issued by `jose` with `HS256`, 7-day expiry, stored as an
HTTP-only cookie named `hms_session` and also returned in JSON (`access_token`).

**SOURCE:** `backend-next/lib/auth-edge.ts:19-25`, `backend-next/app/api/auth/login/route.ts:29-35`

**CONFIDENCE:** HIGH

**FACT:** Tenants with `status = "INVITED"` are explicitly blocked from login.

**SOURCE:** `backend-next/lib/services/auth-service.ts:58-60`

**CONFIDENCE:** HIGH

### 3.2 Tenant management (aka "Student" in legacy code)

**FACT:** Owners can list, invite, activate, view, update, reactivate, and
soft-delete tenants. Tenants can view/edit their own profile, upload ID
documents, request reactivation.

**SOURCE:**
- `backend-next/lib/services/tenant-service.ts` (all methods)
- `backend-next/app/api/tenants/**` (22 route files)
- `frontend/src/pages/owner/ManageTenants.jsx`, `frontend/src/pages/owner/TenantProfilePage.jsx`
- `frontend/src/pages/tenant/TenantProfile.jsx`, `frontend/src/components/TenantManagement/`

**CONFIDENCE:** HIGH

**FACT:** `status = "LEFT"` is treated as the soft-delete state; active
allocations are automatically ended when a tenant is deleted or marked LEFT.

**SOURCE:** `backend-next/lib/services/tenant-service.ts:495-529`

**CONFIDENCE:** HIGH

### 3.3 Room & allocation management

**FACT:** Rooms have CRUD endpoints; allocations can be created, ended,
and shifted. A tenant can fetch `my-room`.

**SOURCE:**
- `backend-next/app/api/rooms/{route.ts,[id]/route.ts,[id]/overview/route.ts}`
- `backend-next/app/api/allocations/{route.ts,my-room/route.ts,shift/route.ts,[id]/end/route.ts}`
- `backend-next/lib/services/room-allocation-service.ts`
- `frontend/src/pages/owner/ManageRooms.jsx`

**CONFIDENCE:** HIGH

### 3.4 Rent, obligations & payments

**FACT:** Rent obligations are generated monthly (cron + manual trigger).
Payments are FIFO-allocated across obligations with row-level locks and
paisa-safe integer arithmetic.

**SOURCE:**
- `backend-next/lib/services/rent-generation-service.ts`
- `backend-next/lib/services/payment-service.ts:17-132, 135-600+`
- `backend-next/app/api/rent/generate/route.ts`
- `backend-next/app/api/cron/generate-rent/route.ts`
- `backend-next/app/api/payments/**` (15 route files)

**CONFIDENCE:** HIGH

**FACT:** PhonePe is the only integrated payment provider in `backend-next`.
The webhook endpoint is `/api/webhooks/payments/phonepe` and is publicly
whitelisted in middleware.

**SOURCE:**
- `backend-next/app/api/webhooks/payments/phonepe/route.ts:10-81`
- `backend-next/middleware.ts:4-12`
- `backend-next/lib/services/payments/providers/` (directory)

**CONFIDENCE:** HIGH

**FACT:** Late-fee calculation is a pure function engine supporting `flat`,
`per_day`, and `percentage` rules with grace days and an optional max cap.

**SOURCE:** `backend-next/lib/billing/engine.ts:65-139`

**CONFIDENCE:** HIGH

### 3.5 Receipts / invoices

**FACT:** Receipts are auto-created on every recorded payment (manual + UPI);
PDF generation uses `puppeteer-core` + `@sparticuz/chromium`, cached in
`receipts.invoice_pdf_url`.

**SOURCE:**
- `backend-next/lib/services/payment-service.ts:88-120`
- `backend-next/lib/services/receipt-service.ts`
- `backend-next/package.json:18,34`
- Migration: `migrations/040_add_receipt_pdf_caching.sql`

**CONFIDENCE:** HIGH

### 3.6 Dashboard & analytics

**FACT:** Owner dashboard aggregates tenants, rooms, payments (current
month), expenses, pending dues, and overdue counts.

**SOURCE:** `backend-next/lib/services/dashboard-service.ts:5-74`, `backend-next/app/api/dashboard/stats/route.ts`

**CONFIDENCE:** HIGH

### 3.7 Expenses

**FACT:** Owners can create/list/update/delete expense entries (title, amount,
date, category, status).

**SOURCE:**
- `backend-next/lib/services/expense-service.ts`
- `backend-next/app/api/expenses/{route.ts,[id]/route.ts}`
- `frontend/src/pages/owner/Expenses.jsx`
- Schema: `backend-next/prisma/schema.prisma:378-394`

**CONFIDENCE:** HIGH

### 3.8 Complaints  [PARTIAL IMPLEMENTATION]

**FACT:** Prisma model `Complaint`, API routes, service layer, and frontend
pages exist on both sides.

**SOURCE:**
- `backend-next/prisma/schema.prisma:396-413`
- `backend-next/app/api/complaints/{route.ts,[id]/route.ts}`
- `frontend/src/pages/owner/Complaints.jsx`, `frontend/src/pages/tenant/TenantComplaints.jsx`

**FACT:** Migration `migrations/025_drop_complaints_system.sql` executes
`DROP TABLE IF EXISTS complaints CASCADE;` — after migration 025 the table no
longer exists in the database but the code continues to query it.

**SOURCE:** `migrations/025_drop_complaints_system.sql` (full file)

**FLAG:** `[SCHEMA MISMATCH DETECTED]` — see `DATABASE_SCHEMA.md` and `TASKS.md`.

**CONFIDENCE:** HIGH

### 3.9 Activity / event log

**FACT:** An `activity_logs` table receives entries via an in-process
`EventEmitter` on `tenant_created`, `tenant_allocated_room`, `payment_recorded`,
`expense_created`, `document_uploaded`, `document_verified`.

**SOURCE:** `backend-next/lib/events/index.ts:28-99`, schema `schema.prisma:364-376`, `backend-next/app/api/activity/{route.ts,list/route.ts}`

**CONFIDENCE:** HIGH

### 3.10 Notifications

**FACT:** In-app notifications stored in `notifications` table; routes for
list and mark-as-read. A `test-reminder` endpoint exists.

**SOURCE:**
- Schema: `schema.prisma:340-352`
- Routes: `backend-next/app/api/notifications/{route.ts,[id]/read/route.ts,test-reminder/route.ts}`
- Service: `backend-next/lib/services/notification-service.ts`

**CONFIDENCE:** MEDIUM (service file size 785 bytes — implementation is minimal;
not fully audited)

### 3.11 Billing / plans / subscriptions  [PARTIAL IMPLEMENTATION]

**FACT:** Migration 031 creates `plans`, `owner_subscriptions`, `owner_invoices`
tables and seeds three plans (STARTER, PRO, BUSINESS).

**SOURCE:** `migrations/031_create_billing_and_plans_tables.sql`

**FACT:** The Prisma schema does NOT include models for `plans`,
`owner_subscriptions`, or `owner_invoices`. The `/api/plans` route returns a
hard-coded array with only two plans ("free", "pro"). `BillingService` returns
a fixed "STARTER" plan with hard-coded limits (rooms 50, hostels 1, tenants ∞).

**SOURCE:**
- `backend-next/prisma/schema.prisma` (full file — no plan/subscription/invoice models)
- `backend-next/app/api/plans/route.ts:8-32`
- `backend-next/lib/services/billing-service.ts:11-42`

**FLAG:** `[REFERENCE FOUND — IMPLEMENTATION MISSING]` for DB-backed plans /
subscriptions; `[SCHEMA MISMATCH DETECTED]` between migration 031 and
Prisma schema.

**CONFIDENCE:** HIGH

### 3.12 Reminders (email)

**FACT:** `reminder-service.ts` and `reminder_logs` table exist; a cron route
`/api/cron/rent-reminders` dispatches them. Emails sent via Resend.

**SOURCE:**
- `backend-next/lib/services/reminder-service.ts`
- `backend-next/app/api/cron/rent-reminders/route.ts`
- `backend-next/package.json:37` (`resend`)

**CONFIDENCE:** HIGH

### 3.13 Real-time updates (SSE)

**FACT:** A Server-Sent Events endpoint `/api/events` broadcasts cache
invalidation / event notifications scoped by `owner_id`. A short-lived
(60s) token is issued via `/api/events-token` because EventSource cannot
attach auth headers.

**SOURCE:**
- `backend-next/app/api/events/route.ts`
- `backend-next/app/api/events-token/route.ts`
- `backend-next/middleware.ts:54-56`
- `backend-next/lib/auth-edge.ts:31-37`
- `backend-next/lib/events/index.ts:17-22` (`broadcast(data.owner_id, …)`)

**CONFIDENCE:** HIGH

---

## 4. Roles

**FACT:** Role enum values: `ADMIN`, `OWNER`, `WARDEN`, `TENANT`.

**SOURCE:** `backend-next/prisma/schema.prisma:452-459`

**FACT:** Legacy role `STUDENT` was migrated to `TENANT` via
`backend-next/prisma/migrations_manual/010_rename_student_role_to_tenant.sql`.

**CONFIDENCE:** HIGH

---

## 5. Environments / deployment hints

**FACT:** Production frontend points to `hms-r68g.vercel.app`; Google OAuth
default redirect is `https://hms-sand-five.vercel.app/callback`; FastAPI
origin list includes `trishul-hms.vercel.app` and `hms-sand-five.vercel.app`.

**SOURCE:**
- `frontend/src/api/axios.js:6`
- `backend-next/lib/services/auth-service.ts:211`
- `backend/app/main.py:35-37`

**CONFIDENCE:** HIGH

**FACT:** `backend-next/vercel.json` exists; database URL is read from
`DATABASE_URL` / `DIRECT_URL`.

**SOURCE:** `backend-next/vercel.json`, `backend-next/prisma/schema.prisma:6-10`

**CONFIDENCE:** HIGH
