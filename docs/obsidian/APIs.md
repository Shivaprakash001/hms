---
tags: [api]
---

# APIs

Related: [[Backend]] · [[Business-Rules]] · [[Frontend]] · [[Database]]

All endpoints live under `backend-next/app/api/` (Next.js 14 App Router). This inventory covers **all 294 `route.ts` files** found in the tree, read directly (handler bodies, not just filenames) to confirm methods, behavior, and auth guards. Route handlers are meant to stay thin — business logic belongs in a service. Frontend access is only ever through `frontend-v2/src/features/*/api` wrappers — see [[Frontend]].

**Headline finding:** 37 route files are deliberate `410 Gone` "tombstone" stubs, left over from a prior multi-hostel SaaS billing/subscription model that this codebase has moved away from (a "single-business migration" per in-code comments). They are intact files, not empty placeholders — kept so a stale caller/cron fails loudly instead of silently 404ing. See the dedicated section near the bottom.

## Auth (`/api/auth/*`)

| Path | Methods | Summary | Auth |
|---|---|---|---|
| `/api/auth/login` | POST | Rate-limited login, sets session/refresh/CSRF cookies | Public (rate-limited) |
| `/api/auth/register` | POST | **Not self-serve** despite the name — requires an existing OWNER session; verifies phone-OTP identity token, then registers a new owner | Requires OWNER session |
| `/api/auth/onboarding-login` | POST | Phone+password login for bulk-imported tenants | Public |
| `/api/auth/refresh` | POST | Rotates access token; checks absolute expiry/inactivity/reuse detection | Public (refresh cookie) |
| `/api/auth/logout` / `/logout-all` | POST | Revoke current / all sessions | Session |
| `/api/auth/me` | GET | Current profile + tenant context if role=TENANT | Session |
| `/api/auth/activity` | POST | Extends session liveness | Session |
| `/api/auth/change-password` | POST | | Session |
| `/api/auth/confirm-identity` | POST | Issues a 2-minute single-use signed "identity token" (re-verifies password) gating offline-payment/waive/cancel actions; DB rate-limited | Session (OWNER) |
| `/api/auth/forgot-password` / `/reset-password` | POST | Password reset flow, rate-limited | Public |
| `/api/auth/reset-onboarding-password` | POST | First-login reset for bulk-imported tenants | Public (rate-limited) |
| `/api/auth/google-callback` | POST | Google OAuth exchange | Public |
| `/api/auth/send-phone-otp` / `/verify-phone-otp` | POST | | Public |
| `/api/auth/csrf` | GET | Issues/refreshes CSRF cookie | Public |

## Tenants — core, invitation, activation, self-service

`/api/tenants` (GET/POST list+create), `/api/tenants/[id]` (GET/PUT/DELETE), `/api/tenants/[id]/full` (aggregated profile), `/api/tenants/by-profile/[profileId]`, `/api/tenants/profile` (GET/PATCH self), `/api/tenants/invite`, `/api/tenants/resend-invitation`, `/api/tenants/[id]/cancel-invitation`, `/api/tenants/[id]/compliance-action` (RESEND_INVITE/REGENERATE_INVITE_TOKEN/EXTEND_INVITATION_EXPIRY/MARK_DOCUMENTS_VERIFIED/RESEND_RULES/REMIND_DOCUMENTS), `/api/tenants/[id]/reactivate`, `/api/tenants/owner/reactivation-requests(/[id]/decision)`, `/api/tenants/owner/tenants/[id]/overview`, `/api/tenants/[id]/notes` (GET/POST/DELETE), `/api/tenants/[id]/score`, `/api/tenants/[id]/photo`, `/api/tenants/increment-year` (GET preview/POST execute), `/api/tenants/transfer` (POST + GET history), `/api/tenants/export` (CSV), `/api/tenants/pending-documents`, `/api/tenants/onboarding/complete`.

**Activation (public, token-gated, no session):** `/api/tenants/activate` (GET validate token / POST activate / PATCH multi-step activation workflow), `/api/tenants/activate/context`, `/api/tenants/activate/photo`, `/api/tenants/activate/signature`.

**Documents** (`/api/tenants/[id]/documents/*`): list, `bulk-verify`, `[docId]/download` (proxies ImageKit or agreement PDF), `[docId]/message`, `[docId]/reject`, `[docId]/verify`.

**Financial ledger/timeline** (`/api/tenants/[id]/financial-*`): `financial-ledger` (GET balance+history / POST record credit-or-debit), `financial-ledger/adjust` (apply future-credit against a specific obligation), `financial-ledger/refund-status` (PATCH), `financial-timeline` (unified read-only feed), `billing-timeline`.

**Tenant self-service** (`/api/tenants/me/*`, all TENANT-scoped): `profile` (GET/PATCH), `complete-profile` (onboarding, multipart), `photo`, `room`, `score`, `documents` (GET/POST), `financial-ledger`, `financial-read-model` (the canonical `FinancialReadModel`, same source the owner overview reads — see [[Business-Rules]]), `billing-timeline`, `billing-frequency` (GET/POST, validated against cooldown/minimum-commitment/billing-period-cleanliness rules), `payments/history`, `onboarding-settings`, `reactivation-request`.

## Agreements & Renewals

`/api/agreements/history`, `/api/agreements/renewals` (owner queue), `/api/agreements/[id]/lifecycle-recovery`, `/api/agreements/[id]/renewal-draft`, `/api/agreements/[id]/renewal-offer`, `/api/agreements/[id]/sign-renewal`, `/api/agreements/renewal-offers` (GET list / POST bulk-generate — FLAT/PERCENTAGE/ROOM_CATEGORY strategy), `/api/agreements/renewal-offers/[id]` (PATCH revise/supersede), `/api/agreements/renewal-offers/[id]/send`, `/api/agreements/renewal-audiences`, `/api/agreements/r4-readiness`, `/api/agreements/lifecycle-recovery` (+`/completion`, `/export`). Tenant side: `/api/tenant/agreement-renewal`, `/api/tenant/renewal-offer` (+`/[id]/accept|decline|discuss`), `/api/tenant/exit` (owner-processed exit, distinct from the move-out workflow below).

## Change Requests (owner-edit ↔ tenant-approval workflow)

`/api/change-requests` (GET list), `/api/change-requests/[id]` (GET detail + event timeline), `/api/change-requests/[id]/approve` (**TENANT only**), `/api/change-requests/[id]/reject` (**TENANT only**), `/api/change-requests/[id]/cancel` (**OWNER/ADMIN only**). Backs the `change_requests`/`change_request_events` tables — see [[Database]].

## Hostels & Property Config

`/api/owner/hostels` (GET list w/ occupancy stats / POST create), `/api/hostels/[id]` (GET/PATCH/DELETE — archive is soft-delete), `/api/hostels/[id]/preferences` (+`/inspector`, `/metadata`, `/simulate` — reminder-decision debugging/preview tools), `/api/hostels/[id]/automation-config`, `/billing-config`, `/billing-defaults`, `/invite-defaults`, `/notification-config`, `/payment-config`, `/receipt-config`, `/security-config`, `/system-config` (each PATCHes one policy sub-object), `/api/hostels/[id]/logo` (POST/DELETE). Legacy compat: `/api/owner/me/hostel`, `/api/owner/me/preferences` (**only resolves an implicit hostel if the owner has exactly one active hostel**, else requires explicit `hostelId`), `/api/owner/me/profile`. Agreement templates: `/api/owner/hostels/[id]/agreement-template` (GET/POST — save_draft/publish/reset_section/reset_all, version-bumps on publish), `/preview`, `/signature`. `/api/owner/logo` — **always 410**, redirects callers to the hostel-scoped path. `/api/floors` (GET/POST), `/api/floors/[id]` (PATCH/DELETE).

## Rooms & Allocations

`/api/rooms` (GET grouped-or-flat with occupancy/capacity / POST create — blocks on archived hostel or duplicate room_no), `/api/rooms/[id]` (GET/PATCH — fires `room_updated` SSE event/DELETE — blocked if active allocations exist), `/api/rooms/[id]/overview`, `/api/rooms/[id]/invite-defaults`, `/api/allocations` (GET/POST), `/api/allocations/[id]/end`, `/api/allocations/shift`, `/api/allocations/tenant/[id]` (history), `/api/allocations/my-room` (alias of `/api/tenants/me/room`).

## Payments — Core, Intents, Verification

`/api/payments` (GET list / POST record manual owner payment), `/api/payments/[id]` (detail), `/api/payments/[id]/receipt` (streams PDF, rate-limited), `/api/payments/attempts/[id]`, `/api/payments/create-intent` (branches RENT/ADVANCE/DEPOSIT/multi-obligation), `/api/payments/confirm`, `/api/payments/manual-confirm`, `/api/payments/verify`, `/api/payments/test-intent` (**disabled in production**), `/api/payments/reconcile`, `/api/payments/record-offline` (requires the 2-step identity-confirmation token; aliased by `/api/payments/offline` and `/api/owner/payments/offline`), `/api/payments/pay-dues` (FIFO lump-sum allocation), `/api/payments/pay-link`, `/api/payments/pay/[token]` (**public**, unauthenticated token-gated payment page), `/api/payments/dues`, `/api/payments/tenant-dues`, `/api/payments/tenant/[id]`, `/api/payments/preview`, `/api/payments/generate-preview`, `/api/payments/pending-verification`, `/api/payments/quick-collect/search`, `/api/payments/settlement-plan` (POST), `/api/payments/settlement-preview` (GET, read-only dry run).

## Payment Obligations

`/api/payments/obligations` (POST create — **no PATCH/PUT anywhere in this tree; confirmed no in-place edit endpoint exists**), `/api/payments/obligations/[id]/cancel` (identity-token gated, only if zero payments exist), `/api/payments/obligations/[id]/waive` (identity-token gated, writes a ledger correction), `/api/payments/obligations/[id]/history`, `/api/rent/generate` (GET preview / POST generate, gated behind an automation plan feature).

## Move-Out & Settlement

`/api/move-out/requests` (GET owner list / POST create — self-service tenant or owner-initiated eviction), `/api/move-out/requests/[id]` (detail + settlement preview), `/[id]/cancel`, `/[id]/reject`, `/[id]/inspect` (owner submits inspection), `/[id]/dispute` (raise/review/reject/resolve), `/[id]/settle` (owner approves, can override computed amount/direction), `/[id]/complete`, `/[id]/vacate`, `/[id]/feedback`. Tenant side: `/api/move-out/tenant`, `/api/move-out/timeline`. Owner-wide: `/api/move-out/vacancies`, `/api/move-out/analytics`.

**`/api/admin/settlements/*` (13 routes) — all decommissioned (410).**

## Admissions / Leads / Public Visit Site

`/api/leads` (GET/POST), `/api/leads/[id]` (GET/PATCH), `/api/leads/[id]/notes`, `/api/leads/[id]/reserve-room`, `/api/leads/[id]/reservations/[reservationId]/cancel`, `/api/leads/[id]/convert-to-invitation` (**OWNER only**), `/api/leads/analytics`. Aliases: `/api/admissions/leads(/analytics)` → `/api/leads(/analytics)`. `/api/admissions/qr-code`. **Public microsite:** `/api/visit/[hostelSlug]`, `/api/visit/[hostelSlug]/activities` (rate-limited 120/hr), `/api/visit/[hostelSlug]/leads` (zod-validated, honeypot field).

## Bulk Import

`/api/bulk-import/upload` (parses XLSX/CSV, max 5MB), `/api/bulk-import/revalidate`, `/api/bulk-import/template`, `/api/bulk-import/[batch_id]` (status + funnel), `/api/bulk-import/[batch_id]/confirm` (GET preview / POST execute, idempotent retry-safe), `/api/bulk-import/google-form-prompt` (**OWNER only**).

## Dashboard & Analytics

`/api/dashboard` (combined shell, Redis-cached), `/api/dashboard/stats`, `/stats-shell`, `/summary` — **all three return the identical payload** (`dashboardService.getOwnerStatsShell`; code comment: "frontend calls both"), `/api/dashboard/stats-activity`, `/stats-analytics`, `/monthly-stats`, `/cashflow`, `/funnel`, `/operations`, `/tenants`, `/tenant/stats` (TENANT), `/portfolio-performance`, `/portfolio-shell`. `/api/owner/portfolio/summary` (cached snapshots only — code comment: "Operational data must never be fetched from this route"). `/api/analytics/dashboard`. `/api/activity`, `/api/activity/list` (near-duplicate feeds). `/api/owner/activity-logs` (large handler: full owner timeline with before/after cash & occupancy positions, plus a "needs attention" panel). `/api/expenses` (GET w/ `mode=suggestions`/`title_summary` / POST — GET filter params: `hostelId`, `categories` (csv), `status`, `sort`, `search`, `range`/`startDate`/`endDate`, `recurring` (`true`/`false`), `amountMin`/`amountMax`, `limit`/`offset`; response includes `kpis`, `category_breakdown`, `vendor_breakdown` (server-side `groupBy` on `vendor_name`, current month), `insights`, `monthly_trend`, `frequent_expenses`, `meta.categories`), `/api/expenses/[id]` (PUT/DELETE). `/api/expenses/export` (GET, rate-limited 10/min/owner) — CSV/XLSX (streamed) or PDF (business report) of expenses; accepts the same filter params as the list endpoint plus `format` (`csv`/`xlsx`/`pdf`, required), `scope` (`current_view`/`all_matching`/`selected`, default `all_matching`), `ids` (csv, required when `scope=selected`). Built on the same `buildExpenseLedgerWhere()` query builder the list endpoint uses — see [[Decisions]] ADR-009.

## Owner Finance / Billing / Subscription — mostly decommissioned

`/api/owner/finance/{by-hostel,collections,summary,transfers}`, `/api/owner/me/{subscription,usage,activation}`, `/api/billing/{message-quota,overflow,plans,upgrade}`, `/api/addons*`, `/api/subscription`, `/api/plans`, `/api/usage`, `/api/admin/activation-analytics`, `/api/admin/finance-ops/invoices` — **all 410 Gone**, per in-code comment "Do not add this route back to vercel.json without a new design." Still live: `/api/owner/billing/frequency-requests` (GET list) and `/[id]/decision` (POST).

## Owner — Misc

`/api/owner/search` (navbar search), `/api/owner/integrity` (**no auth guard found in the file — flag**), `/api/owner/whatsapp/connections` (GET, DELETE `/[connectionId]`), `/api/owner/whatsapp/link-code`, `/api/owners/invitations` (**near-duplicate of `/api/tenants/invite`** — same underlying call, OWNER-only not ADMIN, unclear why both exist), `/api/profiles/unassigned/tenants`, `/api/profiles/[id]`, `/api/profile`, `/api/profile/me`.

## Notifications & WhatsApp

`/api/notifications` (GET), `/[id]/read`, `/api/notifications/send-reminder` (owner one-tap, consumes a reminder credit), `/api/notifications/test-reminder`. **Public webhooks:** `/api/webhooks/notifications/whatsapp` (Meta Cloud API — GET subscription challenge, POST HMAC-verified), `/api/webhooks/payments/razorpay` (POST, HMAC-SHA256 verified — the only signature-verification point in the codebase for payments). `/api/debug/send-test-otp` (**ADMIN only**), `/api/debug/whatsapp-health` (**no auth guard found — flag**, but only returns boolean env-presence flags).

## Admin / Finance-Ops / Reconciliation

`/api/admin/finance-ops` (**ADMIN only**) + `/attempts(/[id])`, `/anomalies`, `/webhook-events`, `/reconciliation-runs`. `/api/admin/finance/reconciliation/issues` + `/[issueId]` + `/scan` — **note: this sibling group requires role OWNER, not ADMIN**, despite the shared `/admin/finance` URL prefix — a role-scope inconsistency worth confirming is intentional.

## Cron Jobs (Vercel Cron, `CRON_SECRET` bearer-gated)

**Active:** `generate-rent`, `rent-reminders`, `agreement-lifecycle`, `daily-briefings`, `hostel-invariants`, `migration-audit`, `move-out-releases`, `reconcile-payments`, `admissions`. **Marked FROZEN (do not schedule) but functional:** `data-retention`. **Marked DORMANT (analytics-repair-only):** `tenant-analytics` (POST). **Decommissioned (410):** `onboarding-nudges`, `process-autopay-retries`, `process-overflow`, `reconcile-addons`.

## Misc / Platform Utility

`/api/health` (DB check), `/api/metrics` (**no auth guard found — flag**, read-only counters), `/api/metrics/reset`, `/api/events` (SSE, OWNER/ADMIN), `/api/events-token` (60s short-lived JWT for the SSE connection), `/api/revalidate` (Sanity CMS webhook, shared-secret gated), `/api/verify/receipt` (**public**, signed-token receipt verification for printable/QR receipts), `/api/invoices/[id]`.

## Decommissioned routes (410 Gone) — full list

37 files unconditionally return `410 Gone` with a message referencing the "single-business migration": all of `addons*` (4), `billing/{message-quota,overflow,plans,upgrade}` (4), `plans`, `subscription`, `usage`, `admin/activation-analytics`, `admin/finance-ops/invoices`, `admin/settlements/*` (13), `owner/finance/*` (4), `owner/me/{subscription,usage,activation}` (3), plus 4 cron jobs (`onboarding-nudges`, `process-autopay-retries`, `process-overflow`, `reconcile-addons`). `owner/logo` also always 410s but for a different reason (redirects to the hostel-scoped logo route). These represent a **previously-removed multi-hostel SaaS billing/plan/subscription model** — see [[Decisions]] and [[Database]] (`usage_tracking` table).

## Flagged for follow-up (not guessed — genuinely unclear from the code)

- **No auth guard found**: `GET /api/owner/integrity`, `GET /api/metrics`, `GET /api/debug/whatsapp-health` (low-risk — booleans only, no secrets).
- **Alias/re-export routes** (thin pass-throughs, not independent logic): `/api/admissions/leads(/analytics)` → `/api/leads(/analytics)`; `/api/allocations/my-room` → `/api/tenants/me/room`; `/api/payments/offline` and `/api/owner/payments/offline` → `/api/payments/record-offline`.
- **Apparent duplicate**: `/api/owners/invitations` vs `/api/tenants/invite` — same underlying `invitationService.inviteTenant` call.
- **Naming trap**: `/api/auth/register` is not self-serve registration despite the path name — requires an existing OWNER session.
- **Role-scope inconsistency**: `/api/admin/finance-ops/*` requires ADMIN; sibling `/api/admin/finance/reconciliation/*` requires OWNER.
- **Three dashboard routes return the identical payload**: `stats`, `stats-shell`, `summary`.

## See also
- [[Backend]] for the service layer behind these routes
- [[Business-Rules]] for the domain logic these endpoints enforce
- [[Features]] for which UI features call which endpoint groups
- [[Decisions]] for the "single-business migration" that produced the 410 tombstones
