# ARCHITECTURE.md

> Derived ONLY from actual folder structure, imports, and direct service usage.
> No assumed patterns.

---

## 1. Runtime Topology

- **Next.js 14 App Router** (`backend-next/`): Functions as the primary API server via Route Handlers (`app/api/**`). Executing in Node.js runtime (not Edge, despite middleware).
- **Vite SPA** (`frontend/`): React 19 single-page application served statically, heavily relying on React Query for data fetching and caching.
- **Postgres Database**: Relational datastore accessed exclusively via Prisma ORM (`@prisma/client`).
- **Supabase**: Used secondarily for `supabase.auth.admin` operations (user creation/password syncing), but the local DB holds the primary user identities.

---

## 2. Request Lifecycle & Middleware Flow

**FACT:** Every request to `/api/*` goes through Edge middleware (`backend-next/middleware.ts`).

1. **CORS:** Middleware handles `OPTIONS` requests, strictly setting `Access-Control-Allow-Origin` dynamically from the centralized frontend-origin allowlist (wildcard blocked for credentials).
2. **Whitelist Bypass:** Public routes (`/api/health`, `/api/auth/login`, `/api/webhooks/*`, `/api/cron/*`) skip JWT validation here.
3. **Auth Extraction:** Extracts JWT from `Authorization: Bearer` (priority 1), `hms_session` HTTP-only cookie (priority 2), or `?token=` query param (priority 3, for SSE).
4. **JWT Verification:** Uses `jose` (`lib/auth-edge.ts`) with `HS256`.
5. **Header Injection:** If valid, injects `x-user-id`, `x-user-role`, `x-owner-id`, `x-tenant-id` into the request headers.

Route Handlers then call `getSession(req)` to read these headers safely without hitting the DB.

---

## 3. Service Layer & Concurrency

**FACT:** The backend implements a classic "Fat Service, Thin Controller" pattern. Routes merely extract payload/params and delegate to singletons in `lib/services/`.

**Concurrency Patterns:**
- **Row-Level Locking:** Payment processing (`payment-service.ts`) uses raw SQL `SELECT ... FOR UPDATE` to lock obligation rows to prevent double payments.
- **Advisory Locks:** `payment-service.ts` uses Postgres advisory locks (`pg_advisory_xact_lock`) scoped to a tenant string to serialize multi-obligation intent creations.
- **Application Locks:** Rent generation (`rent-generation-service.ts`) uses an upsert on the `system_locks` table to ensure only one generation process runs per owner per month.

---

## 4. Event System & SSE

**FACT:** The system uses an in-memory `EventEmitter` (`lib/events/index.ts`).
When a domain event occurs (e.g., `payment_recorded`):
1. Side-effects like analytics calculation and milestone notification trigger asynchronously.
2. The SSE stream (`/api/events`) pushes cache invalidation instructions (`dashboard_updated`) to any connected Vite frontend listening via EventSource.

---

## 5. Cron Execution Model

**FACT:** Vercel Cron hits specific API endpoints via HTTP GET with a secret header.
Endpoints:
- `/api/cron/generate-rent`: Kicks off the rent generator for all active hostels.
- `/api/cron/rent-reminders`: Iterates and fires email reminders via Resend.
- `/api/cron/reconcile-payments`: Hourly check for hanging pending PhonePe attempts.
- `/api/cron/data-retention`: Unknown retention logic.

---

## 6. External Integrations

- **ImageKit:** For tenant document and owner logo uploads (via `@imagekit/nodejs` & `lib/imagekit.ts`).
- **Resend:** For transactional emails (e.g., `EmailService.sendReceipt`).
- **PhonePe:** The single integrated payment gateway (`lib/services/payments/providers/phonepe.ts`).
- **Puppeteer & pdf-lib:** For server-side dynamic PDF receipt and invoice generation (`lib/services/receipt-service.ts`).
