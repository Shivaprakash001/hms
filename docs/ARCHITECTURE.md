# ARCHITECTURE.md

> Derived ONLY from folder structure, imports, and direct service usage.
> No assumed patterns.

---

## 1. Top-level components

| Tree | Runtime | Purpose (evidence) |
|------|---------|--------------------|
| `backend-next/` | Next.js 14 App Router (Node.js runtime on most routes, Edge for middleware) | API + Prisma/Supabase data layer |
| `backend/` | Python 3 + FastAPI | Legacy API (no longer referenced by frontend axios) |
| `frontend/` | Vite + React 19 SPA | Owner & tenant dashboards |
| `migrations/` | Raw Postgres SQL | Applied against Supabase |
| `backend-next/prisma/migrations_manual/` | Raw Postgres SQL | Additional manual migrations |

**SOURCE:** `backend-next/package.json:28` (`next 14.2.16`), `backend-next/middleware.ts:1` (Edge), route files declare `export const runtime = "nodejs"` (e.g. `backend-next/app/api/payments/create-intent/route.ts:2`), `backend/app/main.py:8-30` (FastAPI), `frontend/package.json:51` (Vite 7).

**CONFIDENCE:** HIGH

---

## 2. backend-next/ layered layout (as observed)

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
- `backend-next/lib/services/tenant-service.ts:6,552` (`class TenantService` → `export const tenantService`)
- `backend-next/lib/services/payment-service.ts:11` (`class PaymentService`)
- `backend-next/lib/services/auth-service.ts:7,283`
- `backend-next/lib/services/dashboard-service.ts:4,153`
- `backend-next/lib/services/billing-service.ts:3,46`
- `backend-next/lib/services/complaint-service.ts:4,89`

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

**SOURCE:** `backend-next/lib/events/index.ts:1-99`.

**CONFIDENCE:** HIGH

**FACT:** The Python backend has its own hook registry
(`register_hook("student_left", …)`) and uses polling reconciliation
(`asyncio.create_task(_payment_reconciliation_loop)`).

**SOURCE:** `backend/app/main.py:49-89`.

**CONFIDENCE:** HIGH

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
| JWT | `jose` | `backend-next/lib/auth-edge.ts:6` |
| Password hashing | `bcryptjs` | `backend-next/package.json:23` |
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

**FACT:** Three cron routes exist, all gated by `GET`:
- `/api/cron/generate-rent`
- `/api/cron/rent-reminders`
- `/api/cron/data-retention`

**SOURCE:** `backend-next/app/api/cron/*/route.ts`.

**CONFIDENCE:** HIGH

**FACT:** Actual cron scheduling mechanism (Vercel Cron config) is not
present in `backend-next/vercel.json` as of the current read.

**SOURCE:** `backend-next/vercel.json` (191 bytes, no `crons` key observed at
last read).

**NOTE:** `[UNKNOWN — NOT FOUND IN CODE]` whether these are triggered by
Vercel Cron, GitHub Actions, or external schedulers.

**CONFIDENCE:** MEDIUM
