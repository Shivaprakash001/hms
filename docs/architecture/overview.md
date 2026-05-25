# Architecture Overview

HMS is a hostel management platform for owners, tenants, and finance operators.
The canonical UI is `frontend-v2/`.
The canonical backend is `backend-next/`.
The database source of truth is Prisma over Postgres.

## System map

| Layer | Source | Why this exists |
|---|---|---|
| Public website | `frontend-v2/src/app/pages/public` | Markets the hostel and exposes SEO pages. |
| Owner app | `frontend-v2/src/platforms/owner` | Lets owners manage portfolio, hostels, tenants, rooms, dues, alerts, and settings. |
| Tenant portal | `frontend-v2/src/platforms/tenant` | Lets tenants activate, pay, view room details, update profiles, and request move-out. |
| API routes | `backend-next/app/api` | Converts HTTP requests into service calls. |
| Services | `backend-next/lib/services` and `backend-next/src/services` | Holds business rules outside route handlers. |
| Data layer | `backend-next/prisma/schema.prisma` | Defines persisted entities, relationships, and enums. |
| SQL migrations | `migrations/` | Captures manual Postgres changes and operational hardening. |

**How this works:**
1. A user interacts with a route in `frontend-v2`.
2. The page calls a feature service through Axios and TanStack Query.
3. The Next.js API route calls service code and writes through Prisma.

## Main roles

| Role | What they see | Primary routes |
|---|---|---|
| Owner | Portfolio and hostel workspace | `/dashboard`, `/hostels/:hostelId`, `/tenants`, `/billing`, `/settings` |
| Tenant | Tenant portal | `/tenant/dashboard`, `/tenant/payments`, `/tenant/profile`, `/tenant/move-out` |
| Public visitor | Marketing pages | `/`, `/about`, `/facilities`, `/rooms`, `/gallery`, `/location`, `/contact`, `/rules` |
| Admin | Finance operations in backend app | `/admin`, `/admin/reconciliation`, `/admin/settlements` |

**How this works:**
1. Route modules decide which role can enter.
2. Protected wrappers read auth state from local storage and `/auth/me`.
3. Unauthorized users return to `/login`.

## External services

| Service | Used for | Source |
|---|---|---|
| Supabase Postgres | Primary database | `DATABASE_URL`, `DIRECT_URL` |
| Supabase client | Storage and service access | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| PhonePe | Hosted checkout and payment webhooks | `src/services/payments` |
| Resend | Email delivery | `lib/services/email-service.ts` |
| ImageKit | Logos, tenant photos, documents | `lib/imagekit.ts` |
| WhatsApp Cloud API | OTPs and reminders | WhatsApp provider services |

**How this works:**
1. Environment variables configure provider credentials.
2. Backend services isolate provider-specific calls.
3. UI receives normalized statuses and never calls providers directly.

## Important architecture decisions

- Obligations are the source of truth for money owed.
- Move-out transitions go through a state machine.
- Query keys group cache by owner, hostel, tenant, room, payment, and move-out.
- `frontend-v2` keeps feature API wrappers under `src/features/*/api`.
- Legacy `frontend/` still documents older UX and implementation choices.

**How this works:**
1. Domain services protect invariants before database writes.
2. UI invalidates related query keys after mutations.
3. The user sees updated dashboards without manually refreshing.

> **Needs clarification:** The repo has active-looking `frontend/` and `frontend-v2/` trees. The chosen canonical docs use `frontend-v2/`, but deployment ownership should be confirmed before production handoff.

