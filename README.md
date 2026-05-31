# Hostel Management System (HMS)

Multi-tenant SaaS for hostel owners to manage tenants, rooms, rent obligations,
online payments (PhonePe), expenses, and receipts.

## Repository layout

| Tree | Stack | Status |
|---|---|---|
| `backend-next/` | Next.js 14 App Router + Prisma + Supabase | **Active API** (`/api/*`) |
| `frontend/` | Vite + React 19 SPA | **Active UI** (owner + tenant dashboards) |
| `backend/` | Python 3 + FastAPI | **Legacy** — not targeted by the frontend (`frontend/src/api/axios.js:6-14`) |
| `migrations/` | Raw Postgres SQL | 51 files, applied via Supabase |
| `backend-next/prisma/migrations_manual/` | Raw Postgres SQL | 14 additional manual migrations |
| `scripts/backup/` | Bash | Local/Supabase Storage backup utilities |
| `.github/workflows/db-backup.yml` | GitHub Actions | Daily + monthly + weekly-verify DB backups |

The SPA's production base URL is hard-coded to `https://api.sriadithyahostels.in/api`
(the Next.js deployment) in `frontend/src/api/axios.js:6`.

## Core features (verified in code)

- JWT + HTTP-only cookie auth (`backend-next/lib/auth-edge.ts`, `app/api/auth/login/route.ts`)
- Google OAuth sign-in (`app/api/auth/google-callback/route.ts`)
- Tenant lifecycle: invite → activate → active → reactivation requests
  (`lib/services/{invitation,tenant}-service.ts`)
- Rooms & allocations with atomic shift (`lib/services/room-allocation-service.ts`)
- Monthly rent generation (cron + manual) with FIFO payment allocation
  (`lib/services/{rent-generation,payment}-service.ts`)
- PhonePe hosted checkout + webhook (`lib/services/payments/providers/phonepe.ts`,
  `app/api/webhooks/payments/phonepe/route.ts`)
- Paisa-safe integer arithmetic + row-level locks on obligations
  (`lib/services/payment-service.ts:27-30, 41-54`)
- Configurable late-fee engine (flat / per-day / percentage + grace + cap)
  (`lib/billing/engine.ts`)
- Receipt auto-generation with puppeteer-rendered PDFs cached in Supabase
  (`lib/services/receipt-service.ts`, `lib/pdf/`)
- In-app notifications + Resend email (`lib/services/{notification,email,reminder}-service.ts`)
- Owner activity log driven by an in-process EventEmitter (`lib/events/index.ts`)
- Server-Sent Events with short-lived query-token auth (`app/api/events/`, `app/api/events-token/`)
- Document uploads via ImageKit (`lib/services/document-service.ts`, `lib/imagekit.ts`)

See `docs/PROJECT_CONTEXT.md` for the full feature inventory with source
references.

## Documentation

All technical documentation lives in `docs/`:

- `docs/PROJECT_CONTEXT.md` — feature-by-feature inventory
- `docs/ARCHITECTURE.md` — request flow, layering, event system
- `docs/DATABASE_SCHEMA.md` — Prisma models + SQL migration drift report
- `docs/API_ENDPOINTS.md` — all 87 Next.js route handlers
- `docs/TASKS.md` — detected bugs, schema mismatches, stubbed implementations
- `docs/BACKUP_RECOVERY.md` — backup/restore runbook
- `docs/PHONEPE_INTEGRATION_TEST_PLAN.md` — payment lifecycle validation
- `ENV_SETUP.md` — environment variable reference

## Running locally

### Prerequisites

- Node.js ≥ 20
- A Supabase project (URL, service-role key, direct + pooled connection strings)
- A Resend account (optional — emails degrade to simulation mode without `RESEND_API_KEY`)
- PhonePe sandbox / production credentials (optional — only required for the
  hosted checkout provider)

### Environment

```bash
cp .env.example .env         # edit values
bash scripts/validate_env.sh # sanity-check required vars
```

See `ENV_SETUP.md` for the full variable catalogue.

### Backend (`backend-next/`)

```bash
cd backend-next
npm install
npx prisma generate
npm run dev                  # Next.js dev server on :3000
```

Apply SQL migrations (order is non-trivial — see `docs/DATABASE_SCHEMA.md §5`)
through the Supabase SQL editor or `psql`.

### Frontend (`frontend/`)

```bash
cd frontend
npm install
npm run dev                  # Vite dev server on :5173
```

Note: in any non-`localhost` hostname the SPA uses the Vercel production API at
`https://api.sriadithyahostels.in`.

### Legacy Python backend (`backend/`)

```bash
cd backend
python3 -m uvicorn app.main:app --reload
```

Only run if you have a reason to — the current frontend does not call it and
several of its service modules still reference the pre-rename `students`
table (`docs/TASKS.md:T-003`).

## Deployment

- Next.js API: Vercel (`backend-next/vercel.json`).
- Frontend: Vercel (`frontend/vercel.json`).
- Database: Supabase Postgres. Backups: `.github/workflows/db-backup.yml`.

## License

Proprietary. All rights reserved.
