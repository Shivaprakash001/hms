# ARCHITECTURE.md

> Derived ONLY from folder structure, imports, and direct service usage.
> No assumed patterns.

---

## 1. Top-level components

| Tree | Runtime | Purpose |
|------|---------|---------|
| `backend-next/` | Next.js 14 App Router | **Active API** (`/api/*`) |
| `frontend/` | Vite + React 19 SPA | Owner & tenant dashboards |
| `backend-next/prisma/` | Prisma ORM | Schema + migrations source of truth |

**SOURCE:** `backend-next/package.json` (`next 14.2.16`), `backend-next/middleware.ts` (Edge), route files declare `export const runtime = "nodejs"`, `frontend/package.json` (Vite 7).

**NOTES:**
- Python FastAPI backend (`backend/`) has been **removed** (Phase 1).
- Raw SQL migrations moved to `migrations/archive/` and `backend-next/prisma/migrations_manual/archive/`.
- Prisma schema (`schema.prisma`) is now the single source of truth.
- Refresh token auth system implemented (2-token: short-lived JWT + DB-backed refresh token).
- Payment webhooks hardened with O(1) lookup, provider API verification, and idempotency.
- Structured logging and metrics via `lib/logger.ts` and `lib/metrics.ts`.

**CONFIDENCE:** HIGH

```
backend-next/
├── middleware.ts              ← Edge-runtime auth + CORS for /api/:path*
├── app/
│   ├── api/<feature>/route.ts ← HTTP handlers (GET/POST/PUT/PATCH/DELETE)
│   └── (dashboard)/owner/...  ← [UNKNOWN — only `tenants/` subdir exists; no page.tsx observed]
├── lib/
│   ├── auth-edge.ts           ← jose-based JWT verify (Edge-safe)
│   ├── auth.ts                ← re-exports (`apiResponse`, `apiError`, `getSession`)
│   ├── db.ts                  ← Prisma singleton + Supabase admin client
│   ├── services/<name>.ts     ← Domain services (class + singleton)
│   ├── services/payments/     ← Provider abstraction (base, factory, providers/)
│   ├── billing/engine.ts      ← Pure late-fee calc (+ test file)
│   ├── events/                ← in-process EventEmitter + SSE broadcast bus
│   ├── cache/                 ← dashboard-cache invalidation helpers
│   ├── pdf/                   ← puppeteer-based PDF rendering
│   ├── format.ts              ← currency/date formatters
│   ├── preferences.ts         ← owner preferences loader
│   └── validators/            ← zod schemas
└── prisma/schema.prisma       ← Data model
```

**SOURCE:** directory listing of `backend-next/lib/` and `backend-next/app/`.

**CONFIDENCE:** HIGH

---

## 3. Request flow (from code)

**FACT:** All `/api/*` requests pass through `middleware.ts` before reaching
route handlers.

**SOURCE:** `backend-next/middleware.ts:89-91` (`matcher: "/api/:path*"`).

**FACT:** `middleware.ts`:
1. Handles CORS preflight.
2. Allows a whitelist of public routes
   (`/api/health`, `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`,
   `/api/auth/google-callback`, `/api/webhooks/payments/phonepe`, `/api/plans`).
3. Extracts JWT from cookie `hms_session`, `Authorization: Bearer`, or `?token=`
   query param (only for `/api/events`).
4. Verifies with `jose` using `JWT_SECRET`.
5. Sets `x-user-id`, `x-user-role`, `x-user-email`, `x-owner-id` request headers
   and forwards.

**SOURCE:** `backend-next/middleware.ts:4-87`, `backend-next/lib/auth-edge.ts:42-68`.

**CONFIDENCE:** HIGH

**FACT:** Route handlers call `getSession(req)` which reads the headers set by
the middleware (no DB hit).

**SOURCE:** `backend-next/lib/auth-edge.ts:54-68`.

**CONFIDENCE:** HIGH

---

## 4. Service layer pattern (observed)

**FACT:** Each domain module is a class with methods that operate on
`prisma` + `eventSystem`, exported as a module-level singleton.

**Examples (SOURCE):**
- `backend-next/lib/services/tenant-service.ts`
- `backend-next/lib/services/payment-service.ts`
- `backend-next/lib/services/auth-service.ts`
- `backend-next/lib/services/dashboard-service.ts`
- `backend-next/lib/services/billing-service.ts`

**CONFIDENCE:** HIGH

**FACT:** Services throw `Error` objects whose message is prefixed with a
category token (`UNAUTHORIZED:`, `FORBIDDEN:`, `NOT_FOUND:`, `BAD_REQUEST:`,
`VALIDATION:`, `CONFIG_ERROR:`). Route handlers parse the prefix to map to
HTTP status codes.

**SOURCE:** `backend-next/lib/services/auth-service.ts:37,38,59,99`,
`backend-next/app/api/payments/create-intent/route.ts:44-49`,
`backend-next/app/api/auth/login/route.ts:51-53`.

**CONFIDENCE:** HIGH

---

## 5. Event system (in-process)

**FACT:** A single `HMSEventEmitter` (Node `events.EventEmitter`) is
instantiated in `lib/events/index.ts` and exported as `eventSystem`. When
`trigger()` is called with `data.owner_id`, it (a) invalidates the dashboard
cache for that owner, (b) SSE-broadcasts the payload, (c) emits the local
event for listener side-effects (activity log writes).

**SOURCE:** `backend-next/lib/events/index.ts`.

**CONFIDENCE:** HIGH

**Historical Note:** Python backend hook registry was removed in Phase 1.

---

## 6. Data access

**FACT:** Prisma is the primary ORM; Supabase JS client is used for
(a) admin user creation in `authService.registerOwner`, and (b) `RPC` calls are
referenced as a capability in `lib/db.ts` comment.

**SOURCE:** `backend-next/lib/db.ts:14-18`,
`backend-next/lib/services/auth-service.ts:108-115, 169-175`.

**CONFIDENCE:** HIGH

**FACT:** Raw SQL is used in `paymentService` for row-level locking:
`SELECT id FROM rent_obligations WHERE id = … FOR UPDATE`.

**SOURCE:** `backend-next/lib/services/payment-service.ts:27-30`.

**CONFIDENCE:** HIGH

---

## 7. Frontend architecture (observed)

**FACT:** React Router v7 with two protected route wrappers
(`ProtectedOwnerRoute`, `ProtectedTenantRoute`). Two layouts (`OwnerLayout`,
`TenantLayout`). Global state via `AuthContext` + `AppPreferencesContext`.
Auth tokens are stored in `localStorage` under keys `ownerUser` / `tenantUser`
and injected as `Authorization: Bearer` header; requests also use
`withCredentials: true`.

**SOURCE:**
- `frontend/src/App.jsx:1-88`
- `frontend/src/api/axios.js:17-56`
- `frontend/src/components/ProtectedOwnerRoute.jsx`, `…/ProtectedTenantRoute.jsx`
- `frontend/src/context/` (two files)

**CONFIDENCE:** HIGH

**FACT:** UI stack: TailwindCSS 4, shadcn-style `components/ui/`, Lucide icons,
framer-motion, recharts, react-hot-toast.

**SOURCE:** `frontend/package.json:14-32`.

**CONFIDENCE:** HIGH

---

## 8. External dependencies in use

| Capability | Package | Evidence |
|---|---|---|
| `JWT_SECRET` is verified with `jose` against `sub`, `role`, `email`, and optional
   `owner_id`. Access tokens expire in 1 hour; refresh tokens are stored in the
   database with a 30-day expiry.

| JWT | `jose` | `backend-next/lib/auth-edge.ts` |
| Password hashing | `bcryptjs` | `backend-next/package.json` |
| Refresh tokens | Prisma + httpOnly cookie | `RefreshToken` model, `app/api/auth/refresh/route.ts` |
| ORM | `@prisma/client` | `backend-next/lib/db.ts:1` |
| DB admin/auth | `@supabase/supabase-js` | `backend-next/lib/db.ts:2` |
| Email | `resend` | `backend-next/package.json:37` |
| PDF rendering | `puppeteer-core`, `@sparticuz/chromium`, `pdf-lib`, `jspdf` | `backend-next/package.json:18,27,29,34` |
| Image storage | `@imagekit/nodejs` | `backend-next/package.json:16` + `lib/imagekit.ts` |
| Validation | `zod` | `backend-next/package.json:39` |
| Logging | `pino`, `pino-pretty` | `backend-next/package.json:31-32` |

**CONFIDENCE:** HIGH

---

## 9. Cron & background work

**FACT:** Four cron routes exist:
- `/api/cron/generate-rent` — Monthly rent generation
- `/api/cron/rent-reminders` — Payment reminders
- `/api/cron/data-retention` — Data cleanup
- `/api/cron/reconcile-payments` — Hourly payment reconciliation

**SOURCE:** `backend-next/app/api/cron/*/route.ts`, `backend-next/vercel.json`.

**CONFIDENCE:** HIGH
