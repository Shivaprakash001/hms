# API_ENDPOINTS.md

> Verified API surface mapped from `backend-next/app/api/**/route.ts`.

## 1. Authentication (`/api/auth`)
- `POST /api/auth/login`: Issues `access_token` and `hms_session` cookie.
- `POST /api/auth/register`: Creates Profile and FREE subscription via Supabase+Prisma.
- `POST /api/auth/refresh`: Rotates JWT using `hms_refresh_token` cookie.
- `POST /api/auth/google-callback`: OAuth flow.
- `GET /api/auth/me`: Returns current user identity from session.
- `POST /api/auth/logout`: Blacklists token.

## 2. Tenants (`/api/tenants`)
- `GET /api/tenants`: Lists tenants for owner.
- `POST /api/tenants`: Owner creates a tenant.
- `GET /api/tenants/[id]`: Tenant profile details.
- `PUT /api/tenants/[id]`: Updates tenant.
- `DELETE /api/tenants/[id]`: Soft deletes (marks `LEFT`) and ends allocations.
- `POST /api/tenants/[id]/reactivate`: Submits/approves reactivation.
- `POST /api/tenants/[id]/documents`: Uploads IDs via ImageKit.

## 3. Rooms & Allocations (`/api/rooms`, `/api/allocations`)
- `GET / POST /api/rooms`: Room CRUD.
- `POST /api/allocations`: Creates an allocation.
- `POST /api/allocations/shift`: Moves tenant to a new room atomically.
- `PATCH /api/allocations/[id]/end`: Terminates allocation.

## 4. Payments (`/api/payments`)
- `GET /api/payments/dues`: Owner views all pending dues.
- `POST /api/payments`: Records a manual/cash payment (FIFO allocated).
- `POST /api/payments/create-intent`: Creates PhonePe intent for a specific obligation.
- `POST /api/payments/pay-dues`: Creates PhonePe intent for multiple grouped obligations.
- `POST /api/payments/confirm`: Finalizes intent.

## 5. Webhooks (`/api/webhooks`)
- `POST /api/webhooks/payments/phonepe`: Public, Basic-Auth protected webhook receiver. Handled by `paymentService.handlePaymentWebhook`.

## 6. Rent & Crons (`/api/rent`, `/api/cron`)
- `POST /api/rent/generate`: Manually generates rent.
- `GET /api/cron/generate-rent`: Monthly cron trigger.
- `GET /api/cron/rent-reminders`: Cron for sending email reminders.
- `GET /api/cron/reconcile-payments`: Hourly reconciliation cron.

## 7. Realtime (`/api/events`)
- `GET /api/events`: SSE stream connection.
- `GET /api/events-token`: Issues temporary JWT for SSE.

## 8. Dashboard (`/api/dashboard`)
- `GET /api/dashboard/stats`: Owner dashboard aggregations.

## Confidence
- **HIGH**: Endpoints listed are derived directly from the file system layout and service mappings.
- **UNKNOWN RESPONSE SHAPES**: Exact JSON response bodies are omitted unless rigidly enforced by Zod in the route files.
