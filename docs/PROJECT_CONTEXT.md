# PROJECT_CONTEXT.md

> Forensic audit. Every fact below is derived from explicit code.
> Last updated: May 2026

---

## 1. Repository Layout (Top Level)

**Current Active Components:**

| Tree | Runtime | Purpose |
|------|---------|---------|
| `backend-next/` | Next.js 14 App Router | **Active API** (`/api/*`) |
| `frontend/` | Vite + React 19 SPA | Owner & tenant dashboards |
| `backend-next/prisma/` | Prisma ORM | Schema source of truth |

**Historical / Dead Systems (Removed):**
- `backend/` — Python FastAPI (removed in Phase 1)
- `migrations/` — Raw SQL (moved to `archive/`)
- `backend-next/prisma/migrations_manual/` — Raw SQL (moved to `archive/`)

**CONFIDENCE:** HIGH

---

## 2. Frontend/Backend Coupling & Deployment Assumptions

**FACT:** The Vite SPA hard-codes the production API base URL to `https://hms-r68g.vercel.app/api` in production, completely ignoring `VITE_API_URL` unless on `localhost`.
**SOURCE:** `frontend/src/api/axios.js`

**FACT:** Next.js deployment assumes Vercel (via `backend-next/vercel.json`), reading `DATABASE_URL` and `DIRECT_URL` for Prisma Postgres connections.
**SOURCE:** `backend-next/vercel.json`, `backend-next/prisma/schema.prisma`

**CONFIDENCE:** HIGH

---

## 3. Feature Inventory (Code Evidence)

### 3.1 Authentication & Roles
- **FACT:** Role enum values: `ADMIN`, `OWNER`, `WARDEN`, `TENANT`. The `STUDENT` role was legacy and migrated to `TENANT`.
- **FACT:** Implements Email/password, Google OAuth, and password change. Authentication relies on a 2-token system: short-lived JWT (cookie `hms_session` / `access_token` JSON) and a DB-backed refresh token.
- **FACT:** Uses Supabase Auth (`supabase.auth.admin.createUser`) for underlying owner registration, but maintains a complete parallel `Profile` DB table which is the application's source of truth. If Supabase fails, it falls back to a local UUID.
**SOURCE:** `backend-next/lib/services/auth-service.ts`, `backend-next/app/api/auth/`
**CONFIDENCE:** HIGH

### 3.2 Tenant & Room Management
- **FACT:** Tenants (formerly students) can be invited, activated, and managed. `status = "LEFT"` acts as a soft-delete and automatically terminates active room allocations.
- **FACT:** Tenants are allocated to `Rooms`, which belong to `Hostels`. Allocations carry an immutable snapshot `hostel_id` for reporting/isolation.
**SOURCE:** `backend-next/lib/services/tenant-service.ts`, `backend-next/lib/services/room-allocation-service.ts`
**CONFIDENCE:** HIGH

### 3.3 Multi-Hostel Isolation
- **FACT:** Frontend tracks `activeHostel` state and passes it to queries. Backend enforces `hostel_id` boundaries strictly using scoped query keys and `resolveOwnerScope`/`resolveTenantScope` functions.
**SOURCE:** `backend-next/lib/auth/resolve-operational-scope.ts`, `frontend/src/lib/hostel/activeHostel.js`
**CONFIDENCE:** HIGH

### 3.4 Rent & Payment Engine
- **FACT:** Rent obligations are generated via a monthly idempotent cron/manual trigger (`rent-generation-service.ts`).
- **FACT:** Payments utilize aggressive locking (`SELECT ... FOR UPDATE` and `pg_advisory_xact_lock`) and FIFO allocation.
- **FACT:** The only integrated provider is PhonePe. Cash/offline payments are supported and can be protected via a single-use identity token.
**SOURCE:** `backend-next/lib/services/rent-generation-service.ts`, `backend-next/lib/services/payment-service.ts`
**CONFIDENCE:** HIGH

### 3.5 Billing & SaaS Subscriptions
- **FACT:** Owners have Subscriptions (`OwnerSubscription`, `Subscription`) to Plans (`FREE`, `STARTER`, etc.) which gate features like automation and messaging.
- **FACT:** The `Plan` model dictates `automation`, `messaging`, `multi_hostel`, and `analytics` boolean flags.
**SOURCE:** `backend-next/lib/services/plan-enforcement-service.ts`, `schema.prisma:757-781`
**CONFIDENCE:** HIGH

### 3.6 Realtime & Observability
- **FACT:** An SSE endpoint (`/api/events`) broadcasts cache invalidations to the frontend using a short-lived token (`/api/events-token`).
- **FACT:** A backend `EventEmitter` triggers audit logging (`eventLog.log`) asynchronously.
**SOURCE:** `backend-next/app/api/events/route.ts`, `backend-next/lib/events/index.ts`
**CONFIDENCE:** HIGH

### 3.7 Dead & Orphaned Features
- **DRIFT DETECTED:** `Complaint` Prisma model exists (`schema.prisma:643-664`), and routes/services may exist, but the SQL table was dropped in `migrations/025_drop_complaints_system.sql`.
**SOURCE:** `schema.prisma`, `migrations/025_drop_complaints_system.sql`
**CONFIDENCE:** HIGH
