# Environment Setup

Canonical reference for the variables used by the active stack
(`backend-next/`, `frontend/`) and the legacy `backend/` (FastAPI). Values
are derived from `process.env.*` grep across the codebase and from
`.env.example`.

> **Never** commit `.env`. Use `.env.example` as the template; run
> `bash scripts/validate_env.sh` to check required keys.

---

## 1. Next.js backend (`backend-next/`)

### 1.1 Database (Supabase Postgres)

| Variable | Required | Purpose | Evidence |
|---|---|---|---|
| `DATABASE_URL` | yes | Prisma pooled connection (port 6543, `?pgbouncer=true`) | `backend-next/prisma/schema.prisma:8` |
| `DIRECT_URL` | yes | Prisma migrations + `pg_dump` (port 5432, non-pooler) | `schema.prisma:9`, `.github/workflows/db-backup.yml:36-43` |
| `SUPABASE_URL` | yes | Supabase project URL (admin client + storage REST) | `lib/db.ts:15` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase service-role key for admin ops | `lib/db.ts:16` |

### 1.2 Auth

| Variable | Required | Purpose | Evidence |
|---|---|---|---|
| `JWT_SECRET` | yes | HMAC secret for session JWTs (`jose`, HS256, 7-day) | `lib/auth-edge.ts:9` |
| `GOOGLE_CLIENT_ID` | if Google login | OAuth client id | `lib/services/auth-service.ts:209` |
| `GOOGLE_CLIENT_SECRET` | if Google login | OAuth client secret | `auth-service.ts:210` |
| `GOOGLE_REDIRECT_URI` | optional | Default callback URI (falls back to `https://hms-sand-five.vercel.app/callback`) | `auth-service.ts:211` |

### 1.3 CORS / frontend origin

| Variable | Required | Purpose | Evidence |
|---|---|---|---|
| `NEXT_PUBLIC_FRONTEND_URL` | yes | Allowed browser origin (echoed by middleware, used for activation links + PhonePe redirect) | `middleware.ts:19`, `lib/services/invitation-service.ts:116, 297`, `providers/phonepe.ts:91, 99` |
| `FRONTEND_URL` | optional | Fallback for invitation links | `invitation-service.ts:116, 297` |

### 1.4 Email (Resend)

| Variable | Required | Purpose | Evidence |
|---|---|---|---|
| `RESEND_API_KEY` | recommended | Resend API token (without it email falls back to simulation-log mode) | `lib/services/email-service.ts:6, 33` |
| `EMAIL_FROM` | optional | Default `From:` header (default `noreply@mail.sriadithyahostels.in`) | `email-service.ts:7` |

### 1.5 Payments — PhonePe (only integrated provider)

| Variable | Required | Purpose | Evidence |
|---|---|---|---|
| `PHONEPE_CLIENT_ID` | if PhonePe enabled | OAuth client id | `providers/phonepe.ts:35` |
| `PHONEPE_CLIENT_SECRET` | if PhonePe enabled | OAuth client secret | `providers/phonepe.ts:39` |
| `PHONEPE_CLIENT_VERSION` | optional | Defaults to `"1"` | `providers/phonepe.ts:43` |
| `PHONEPE_ENV` | optional | Set to `production` to hit prod endpoints; anything else = sandbox | `providers/phonepe.ts:19` |
| `PHONEPE_REDIRECT_URL` | optional | Post-payment redirect target (fallback: `${NEXT_PUBLIC_FRONTEND_URL}/payment-return`) | `providers/phonepe.ts:90` |
| `PHONEPE_WEBHOOK_USERNAME` | yes (prod) | Basic-auth username PhonePe presents on webhook calls | `providers/phonepe.ts:188`, `app/api/webhooks/payments/phonepe/route.ts:26` |
| `PHONEPE_WEBHOOK_PASSWORD` | yes (prod) | Basic-auth password for the same | same as above |

> Razorpay keys appear in `.env.example` (`RAZORPAY_WEBHOOK_SECRET`,
> `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `VITE_RAZORPAY_KEY_ID`) but no
> Razorpay code path exists under `backend-next/`. They can be omitted.

### 1.6 Image hosting (ImageKit)

| Variable | Required | Purpose | Evidence |
|---|---|---|---|
| `IMAGEKIT_PRIVATE_KEY` | if uploads enabled | Server-side SDK key (dummy fallback in non-prod) | `lib/imagekit.ts:3, 6` |
| `IMAGEKIT_URL_ENDPOINT` | if uploads enabled | CDN endpoint | `lib/imagekit.ts:4` |

### 1.7 PDF rendering (Puppeteer)

| Variable | Required | Purpose | Evidence |
|---|---|---|---|
| `CHROME_PATH` | local dev only | Path to a Chrome binary (auto-detected if unset) | `lib/pdf/browser.ts:89` |
| `VERCEL` / `AWS_LAMBDA_FUNCTION_NAME` | auto | Set by the runtime; triggers `@sparticuz/chromium` path | `lib/pdf/browser.ts:46` |

### 1.8 Cron

| Variable | Required | Purpose | Evidence |
|---|---|---|---|
| `CRON_SECRET` | yes for cron endpoints | Bearer token required by `/api/cron/*` | `app/api/cron/rent-reminders/route.ts:17`, `cron/generate-rent/route.ts`, `cron/data-retention/route.ts` |

### 1.9 Misc

| Variable | Purpose | Evidence |
|---|---|---|
| `NODE_ENV` | Toggles Prisma query logging, cookie `secure` flag, ImageKit warning, logger transport | multiple |
| `LOG_LEVEL` | Pino level (default `info`) | `lib/logger.ts:3` |
| `NEXT_PUBLIC_API_BASE_URL` | Base for internal fetches (default `/api`) | `lib/api-client.ts:11` |

---

## 2. Frontend (`frontend/`)

| Variable | Purpose | Evidence |
|---|---|---|
| `VITE_API_URL` | Backend base URL. **Only honoured when `window.location.hostname === 'localhost'`**; otherwise the production URL is hard-coded. | `frontend/src/api/axios.js:6-14` |
| `VITE_GOOGLE_CLIENT_ID` | Google Sign-In client id | `.env.example:17` |
| `VITE_GOOGLE_REDIRECT_URI` | OAuth redirect URI | `.env.example:18` |
| `VITE_RAZORPAY_KEY_ID` | Declared in `.env.example`; no code reference found in `frontend/src/`. Safe to omit. | — |

---

## 3. Legacy Python backend (`backend/`) — optional

These variables are only required if you run the FastAPI service. The active
frontend does not call it.

| Variable | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin & anon clients |
| `JWT_SECRET_KEY` | FastAPI JWT signer |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | SMTP fallback email path |
| `APP_ENV` | `development` / `production` |
| `FRONTEND_URL` | Activation-link base |
| `RECEIPT_VERIFY_BASE_URL` | Public URL for receipt QR / verification |
| `UPI_ID` | Fallback UPI id when owner UPI is not set |
| `PHONEPE_MERCHANT_ID`, `PHONEPE_BASE_URL`, `PHONEPE_CALLBACK_URL`, `PHONEPE_UPI_PAYEE_NAME` | Legacy PhonePe config |
| `EXPOSE_ACTIVATION_LINK` | Testing flag to echo invitation token in API response |

> The Python side still queries the `students` table. Migration
> `backend-next/prisma/migrations_manual/008_student_to_tenant_rename.sql`
> renamed it to `tenants`, so most endpoints here will fail against the
> current database. See `docs/TASKS.md:T-003`.

---

## 4. Validation script

```bash
bash scripts/validate_env.sh
```

`scripts/validate_env.sh` checks that the primary `.env` keys are populated.
It does **not** currently enforce the PhonePe / ImageKit / `CRON_SECRET`
variables — verify those manually before enabling the related features.

## 5. Quick checklist — minimum to run locally

```
DATABASE_URL
DIRECT_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET
NEXT_PUBLIC_FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

Email, PhonePe, Google OAuth, ImageKit, and cron variables can be left unset
for a read-only / local-dev workflow; the code logs a warning and falls back.
