# API_ENDPOINTS.md

> All entries below were extracted from `backend-next/app/api/**/route.ts` by
> locating every `export async function (GET|POST|PUT|PATCH|DELETE)`.
> The Python FastAPI backend in `backend/app/api/routes/` is **not** documented
> here because the frontend does not target it
> (`frontend/src/api/axios.js:6-14`).
>
> Response shapes are only described when the handler's code made them clear.
> Otherwise `[RESPONSE STRUCTURE UNKNOWN]`.

## Authentication & routing rules

**FACT:** Public (no-JWT) routes: `/api/health`, `/api/auth/login`,
`/api/auth/register`, `/api/auth/refresh` (referenced but no route file found —
see TASKS.md), `/api/auth/google-callback`, `/api/webhooks/payments/phonepe`,
`/api/plans`. All other `/api/*` paths require a verified JWT.

**SOURCE:** `backend-next/middleware.ts:4-12, 44-48`.

**CONFIDENCE:** HIGH

---

## 1. Auth — `/api/auth`

| Method | Path | Handler | Response / behavior |
|---|---|---|---|
| POST | `/api/auth/login` | `auth/login/route.ts` | `{ access_token, token_type:"bearer", role, name, user_id, tenant_id, is_profile_completed }` + `Set-Cookie: hms_session`. Errors: 400 VALIDATION_ERROR, 401 UNAUTHORIZED, 403 FORBIDDEN, 500 SERVER_MISCONFIGURED. |
| POST | `/api/auth/register` | `auth/register/route.ts` | Creates owner profile + hostel. [RESPONSE STRUCTURE UNKNOWN] beyond returning the created `profile` with `hostels` included per `authService.registerOwner` (`auth-service.ts:127-151`). |
| POST | `/api/auth/logout` | `auth/logout/route.ts` | Adds current token to `token_blacklist`. `{ success: true }` per `auth-service.ts:186-194`. |
| GET  | `/api/auth/me` | `auth/me/route.ts` | `{ id, email, role, owner_id }` from session headers (`auth-service.ts:196-207`). |
| POST | `/api/auth/google-callback` | `auth/google-callback/route.ts` | Exchanges OAuth code → returns same login payload as above (`auth-service.ts:208-280`). |
| POST | `/api/auth/change-password` | `auth/change-password/route.ts` | `{ success: true, message }` (`auth-service.ts:161-184`). |

**SOURCE:** files cited above. **CONFIDENCE:** HIGH.

---

## 2. Tenants — `/api/tenants`

| Method | Path | Response / behavior |
|---|---|---|
| GET  | `/api/tenants` | Owner/admin only. Paged list. Returns `{ tenants: [...], total, limit, offset }` (each tenant augmented with `payment_summary`). Source: `tenant-service.ts:107-189`. |
| POST | `/api/tenants` | Owner/admin. Requires `profile_id`, `monthly_rent>0`. Returns created tenant + profile, 201. `app/api/tenants/route.ts:39-60`. |
| GET  | `/api/tenants/[id]` | Single tenant. Owner-only enforced at service (`tenant-service.ts:403-474` for overview). |
| PUT  | `/api/tenants/[id]` | Update; auto-ends allocations if status becomes `LEFT` (`tenant-service.ts:487-508`). |
| DELETE | `/api/tenants/[id]` | Soft delete → status `LEFT`, ends allocations (`tenant-service.ts:510-529`). |
| POST | `/api/tenants/[id]/reactivate` | Owner reactivates a LEFT tenant (`tenant-service.ts:531-549`). |
| GET  | `/api/tenants/[id]/full` | [RESPONSE STRUCTURE UNKNOWN from route file alone] |
| GET / POST | `/api/tenants/[id]/documents` | List / upload IDs (service: `document-service.ts`). |
| PATCH | `/api/tenants/[id]/documents/[docId]/verify` | Mark verified. |
| PATCH | `/api/tenants/[id]/documents/[docId]/reject` | Mark rejected. |
| DELETE | `/api/tenants/[id]/documents/[docId]` | Delete document (+ ImageKit file). |
| POST | `/api/tenants/invite` | Invitation flow (`invitation-service.ts`). |
| POST | `/api/tenants/activate` | Activate invited tenant. |
| POST | `/api/tenants/resend-invitation` | Re-send invitation email. |
| GET  | `/api/tenants/by-profile/[profileId]` | Lookup by profile. |
| GET / PATCH | `/api/tenants/profile` | [INSUFFICIENT EVIDENCE] — also see `/api/tenants/me/profile`. |
| GET  | `/api/tenants/me/room` | Current tenant's active room. |
| GET  | `/api/tenants/me/documents` | Current tenant's uploaded docs. |
| GET / PATCH | `/api/tenants/me/profile` | Get/update self profile (enforces `allow_tenant_edits` pref — `tenant-service.ts:199-204`). |
| POST | `/api/tenants/me/complete-profile` | Marks `is_profile_completed`. |
| POST | `/api/tenants/me/reactivation-request` | Creates request; 24h rate-limit (`tenant-service.ts:299-311`). |
| GET  | `/api/tenants/me/payments/history` | Tenant payment history list. |
| GET  | `/api/tenants/owner/reactivation-requests` | Owner lists open/processed requests. |
| POST | `/api/tenants/owner/reactivation-requests/[id]/decision` | Owner approves/rejects (`tenant-service.ts:372-402`). |
| GET  | `/api/tenants/owner/tenants/[id]/overview` | Owner-scoped tenant overview. |

**SOURCE:** `backend-next/app/api/tenants/**/route.ts` (22 files verified by
`find -name route.ts`) and corresponding service functions cited.

**CONFIDENCE:** HIGH (existence, method); MEDIUM (exact response shape for
routes not explicitly read line-by-line).

---

## 3. Rooms — `/api/rooms`

| Method | Path | Notes |
|---|---|---|
| GET  | `/api/rooms` | List rooms. |
| POST | `/api/rooms` | Create room. |
| GET  | `/api/rooms/[id]` | Get room. |
| PATCH | `/api/rooms/[id]` | Update. |
| DELETE | `/api/rooms/[id]` | Delete. |
| GET  | `/api/rooms/[id]/overview` | Room occupancy / tenants. |

**SOURCE:** `backend-next/app/api/rooms/**/route.ts`; service: `property-service.ts`.

**CONFIDENCE:** HIGH.

---

## 4. Allocations — `/api/allocations`

| Method | Path | Notes |
|---|---|---|
| GET  | `/api/allocations` | List allocations. |
| POST | `/api/allocations` | Create. |
| GET  | `/api/allocations/my-room` | Current tenant view. |
| POST | `/api/allocations/shift` | Move a tenant across rooms atomically. |
| PATCH | `/api/allocations/[id]/end` | End an allocation. |

**SOURCE:** `backend-next/app/api/allocations/**/route.ts`;
service: `room-allocation-service.ts`.

**CONFIDENCE:** HIGH.

---

## 5. Payments — `/api/payments`

| Method | Path | Notes |
|---|---|---|
| GET  | `/api/payments` | List payments (owner/tenant scoped). |
| POST | `/api/payments` | Manual payment record (cash/UPI/etc.) — FIFO allocated. |
| GET  | `/api/payments/dues` | Owner-wide dues overview. |
| GET  | `/api/payments/tenant-dues` | Owner viewing a tenant's dues. |
| GET  | `/api/payments/pending-verification` | List PhonePe attempts awaiting confirmation. |
| GET  | `/api/payments/generate-preview` | Pre-payment breakdown using `billing/engine.ts`. |
| POST | `/api/payments/create-intent` | Creates a PaymentAttempt (PhonePe). Body: `{ obligation_id, amount? }`. Errors: 400/403/404/422. **SOURCE:** `app/api/payments/create-intent/route.ts:10-51`. |
| POST | `/api/payments/pay-dues` | Creates intent for tenant's outstanding dues. |
| POST | `/api/payments/confirm` | Finalizes manual/UPI payment. |
| POST | `/api/payments/verify` | Server-side provider status check. |
| POST | `/api/payments/submit-reference` | Tenant submits UPI reference number for manual verification. |
| POST | `/api/payments/reconcile` | Triggers reconciliation loop. |
| GET  | `/api/payments/[id]/receipt` | Fetch/generate PDF receipt. |
| GET  | `/api/payments/tenant/[id]` | Tenant's payment list (owner-scoped). |
| GET  | `/api/payments/attempts/[id]` | Payment attempt details. |
| POST | `/api/payments/obligations/[id]/waive` | Waive an obligation (`payment-service.ts:739-749`). |

**SOURCE:** `backend-next/app/api/payments/**/route.ts` (15 files).

**CONFIDENCE:** HIGH.

---

## 6. Rent generation — `/api/rent/generate`

| Method | Path | Notes |
|---|---|---|
| GET  | `/api/rent/generate?month=YYYY-MM` | Preview (owner/admin). Returns result of `rentGenerationService.previewMonthlyRent`. |
| POST | `/api/rent/generate` body `{ month? }` | Executes generation; returns summary, 201. |

**SOURCE:** `backend-next/app/api/rent/generate/route.ts:15-60`.

**CONFIDENCE:** HIGH.

---

## 7. Cron — `/api/cron`

| Method | Path | Notes |
|---|---|---|
| GET  | `/api/cron/generate-rent` | Automated monthly rent obligation generation. |
| GET  | `/api/cron/rent-reminders` | Sends due/overdue reminders (`reminder-service.ts`). |
| GET  | `/api/cron/data-retention` | Data retention job. [INSUFFICIENT EVIDENCE for specific actions.] |

**SOURCE:** `backend-next/app/api/cron/*/route.ts`.

**CONFIDENCE:** HIGH (existence); MEDIUM (effect detail).

---

## 8. Webhooks — `/api/webhooks/payments/phonepe`

| Method | Path | Notes |
|---|---|---|
| POST | `/api/webhooks/payments/phonepe` | Public (no JWT). Basic-Auth validated against `PHONEPE_WEBHOOK_USERNAME/PASSWORD`. Empty body or `body.test`/missing `merchantOrderId` → ACKs 200 without processing. Real events go to `paymentService.handlePaymentWebhook`. Always returns 200 (even on internal failure) to satisfy PhonePe dashboard. |
| GET  | same path | `{ success: true, message: "PhonePe webhook endpoint is active…" }`. |

**SOURCE:** `backend-next/app/api/webhooks/payments/phonepe/route.ts:17-92`.

**CONFIDENCE:** HIGH.

---

## 9. Dashboard / analytics

| Method | Path | Response |
|---|---|---|
| GET | `/api/dashboard/stats` | Owner/admin. Returns `{ total_rooms, total_tenants, active_tenants, total_capacity, vacant_beds, occupancy_rate, revenue, expenses_this_month, rent_collected_this_month, pending_dues, overdue_amount, overdue_count }`. |
| GET | `/api/dashboard/summary` | Similar; alias expected. [RESPONSE STRUCTURE UNKNOWN — not read line-by-line]. |
| GET | `/api/dashboard/route.ts` | [INSUFFICIENT EVIDENCE]. |
| GET | `/api/dashboard/monthly-stats` | Returns `months` array with `{ month, year, collected, due, collection_rate }`. |
| GET | `/api/dashboard/tenant/stats` | Tenant-scoped stats `{ tenant_id, room_no, monthly_rent, pending_dues, next_payment_date, oldest_obligation_id, status }`. |
| GET | `/api/analytics/dashboard` | [RESPONSE STRUCTURE UNKNOWN]. |

**SOURCE:** `backend-next/lib/services/dashboard-service.ts:61-149`;
`backend-next/app/api/dashboard/stats/route.ts`.

**CONFIDENCE:** HIGH for `/stats`, `/monthly-stats`, `/tenant/stats`. LOW for others.

---

## 10. Owner self-service — `/api/owner`

| Method | Path | Notes |
|---|---|---|
| GET  | `/api/owner/me/profile` | Profile + hostel + preferences bundle (`property-service.ts:5-50`). |
| PATCH | `/api/owner/me/profile` | Update name/phone. |
| PATCH | `/api/owner/me/hostel` | Update hostel details. |
| PATCH | `/api/owner/me/preferences` | Update preference JSON. |
| GET  | `/api/owner/me/subscription` | Returns hard-coded STARTER plan (`billing-service.ts:25-42`). |
| GET  | `/api/owner/me/usage` | Usage counts (`billing-service.ts:4-22`). |
| POST / DELETE | `/api/owner/logo` | Upload / remove hostel logo (ImageKit). |
| GET  | `/api/owner/search` | [RESPONSE STRUCTURE UNKNOWN]. |

**CONFIDENCE:** HIGH for those whose service code was read.

---

## 11. Profiles — `/api/profile`, `/api/profiles`

| Method | Path | Notes |
|---|---|---|
| GET / PATCH | `/api/profile/me` | Current user's profile. |
| GET / PUT | `/api/profiles/[id]` | Single profile. |
| GET | `/api/profiles/unassigned/tenants` | Profiles w/o tenant record. |

---

## 12. Expenses — `/api/expenses`

GET, POST `/api/expenses`; PUT, DELETE `/api/expenses/[id]`.
Columns written match `expenses` table (schema §2.18).

**SOURCE:** `backend-next/app/api/expenses/**/route.ts`, service `expense-service.ts`.

**CONFIDENCE:** HIGH.

---

## 13. Complaints — `/api/complaints`

| Method | Path | Notes |
|---|---|---|
| GET  | `/api/complaints` | Tenant sees own; Owner/Admin see all for their property. |
| POST | `/api/complaints` | Tenant only. Body mapped to `createComplaint`. |
| PUT  | `/api/complaints/[id]` | Update status / comment. |

**FLAG:** Underlying table dropped by migration 025. See `DATABASE_SCHEMA.md` §4.1.

**SOURCE:** `backend-next/app/api/complaints/**/route.ts`, `complaint-service.ts`.

**CONFIDENCE:** HIGH (code exists); the endpoint is likely broken at runtime.

---

## 14. Notifications

| Method | Path | Notes |
|---|---|---|
| GET  | `/api/notifications` | List user's notifications. |
| POST | `/api/notifications/[id]/read` | Mark read. |
| POST | `/api/notifications/test-reminder` | Test email reminder. |

---

## 15. Invoices

| Method | Path | Notes |
|---|---|---|
| GET | `/api/invoices/[id]` | Returns an invoice (likely receipt PDF or record). [RESPONSE STRUCTURE UNKNOWN — service: `invoice-service.ts` 15KB, not read line-by-line]. |

---

## 16. Activity

| Method | Path | Notes |
|---|---|---|
| GET | `/api/activity` | Activity list. |
| GET | `/api/activity/list` | Activity list (alternate). [INSUFFICIENT EVIDENCE on difference]. |

---

## 17. Billing / Plans / Subscriptions

| Method | Path | Notes |
|---|---|---|
| GET | `/api/plans` | Returns hard-coded 2-item array `[{id:"free"…},{id:"pro"…}]`. Not from DB. |
| GET | `/api/billing/usage` | Owner usage (same as `/api/owner/me/usage`?). [INSUFFICIENT EVIDENCE on difference]. |

---

## 18. Owners (plural) — `/api/owners`

| Method | Path | Notes |
|---|---|---|
| POST | `/api/owners/invitations` | [RESPONSE STRUCTURE UNKNOWN]. |

---

## 19. Events / SSE

| Method | Path | Notes |
|---|---|---|
| GET | `/api/events` | Server-Sent Events stream. Accepts token via `?token=` query (SSE cannot send Authorization header). |
| GET | `/api/events-token` | Issues a 60-second JWT for SSE connection. |

**SOURCE:** `backend-next/middleware.ts:54-56`; `backend-next/lib/auth-edge.ts:31-37`.

**CONFIDENCE:** HIGH.

---

## 20. Health

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Public. [RESPONSE STRUCTURE UNKNOWN beyond 200 OK]. |
