# PhonePe Integration Test Plan

Validation checklist for the full server-side payment lifecycle.
Implementation reference: `backend-next/lib/services/payments/providers/phonepe.ts`
and `backend-next/lib/services/payment-service.ts`.

Expected statuses (per Prisma enum `AttemptStatus`, `schema.prisma:478-488`):
`CREATED`, `PENDING`, `SUCCESS`, `FAILED`, `EXPIRED`, `CANCELLED`, `PENDING_VERIFICATION`.

---

## 1. Database sanity checks

Run before gateway tests:

```sql
-- Payment attempts lifecycle
SELECT id, provider, merchant_txn_id, gateway_txn_id, amount, status,
       created_at, confirmed_at
FROM public.payment_attempts
ORDER BY created_at DESC
LIMIT 20;

-- Recorded payments (NOTE: column is tenant_id after migrations_manual/008)
SELECT id, obligation_id, tenant_id, owner_id, amount_paid,
       payment_method, reference_number, payment_date, payment_attempt_id
FROM public.payments
ORDER BY created_at DESC
LIMIT 20;

-- Obligation status impact
SELECT id, tenant_id, amount, status, due_date, rent_month
FROM public.rent_obligations
ORDER BY due_date DESC
LIMIT 20;
```

Expected transitions:
- `payment_attempts.status`: `CREATED` → `PENDING` → (`SUCCESS` | `FAILED` | `EXPIRED` | `CANCELLED`).
- On `SUCCESS` a new row appears in `payments` with `payment_attempt_id` set and the parent `rent_obligations.status` moves to `PARTIAL` or `PAID`.

---

## 2. Create intent

Endpoint: `POST /api/payments/create-intent`
(`backend-next/app/api/payments/create-intent/route.ts`).

```bash
curl -X POST "$BASE_URL/api/payments/create-intent" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "obligation_id": "<obligation_uuid>",
    "amount": 5000
  }'
```

Auth: any authenticated user; tenant role is resolved to `tenantId` server-side
(`create-intent/route.ts:22-32`). Error codes: 400 VALIDATION_ERROR,
403 FORBIDDEN, 404 NOT_FOUND, 422 CONFIG_ERROR, 500 INTERNAL_ERROR.

Expected response includes:
- `id` (attempt id)
- `merchant_txn_id`
- `status = PENDING`
- one of `checkout_url`, `upi_intent_url`, `qr_payload` depending on provider mode.

---

## 3. Webhook

Endpoint: `POST /api/webhooks/payments/phonepe`
(`backend-next/app/api/webhooks/payments/phonepe/route.ts`). Public — not
behind middleware JWT check.

Auth: HTTP Basic (`Authorization: Basic …`) with credentials
`PHONEPE_WEBHOOK_USERNAME` / `PHONEPE_WEBHOOK_PASSWORD`. Requests without these
env vars set are accepted without credential validation (same file, line 30).

Validation pings — empty body or `{ "test": true, ... }` / missing
`payload.merchantOrderId` — are ACKed with HTTP 200 and ignored
(`route.ts:45-59`).

Expected on a real event:
- Matching `payment_attempt` is finalized via
  `paymentService.finalizePaymentAttempt`.
- A success event creates a `payments` row and moves the attempt to `SUCCESS`.

> **Design caveat:** all unexpected errors are swallowed and the handler
> returns HTTP 200 with `{ success: true, status: "acknowledged_with_internal_error" }`.
> Monitoring must rely on the `[webhook.phonepe]` log lines, not on 4xx/5xx
> responses. See `docs/TASKS.md:T-011`.

---

## 4. Manual verify

Endpoint: `POST /api/payments/verify`
(`backend-next/app/api/payments/verify/route.ts`,
`payment-service.ts:656-737`).

```bash
curl -X POST "$BASE_URL/api/payments/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "attempt_id": "<attempt_uuid>" }'
```

Alternative body fields (any one required):
- `merchant_txn_id`
- `gateway_txn_id`

Behaviour:
- If the attempt is already in a terminal state (`SUCCESS`/`FAILED`/`EXPIRED`/
  `CANCELLED`), the cached row is returned with `source: "cached"`
  (`payment-service.ts:689-695`).
- Otherwise the provider is queried (`instance.fetchStatus`) and the attempt is
  finalized; response includes `source: "provider"`. If the provider call fails,
  `source: "cached_pending"` is returned without mutation.

---

## 5. Reconciliation

Endpoint: `POST /api/payments/reconcile`
(`backend-next/app/api/payments/reconcile/route.ts`).

```bash
curl -X POST "$BASE_URL/api/payments/reconcile" \
  -H "Authorization: Bearer $OWNER_OR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "payment_ids": ["<attempt_uuid_or_merchant_txn_id>"] }'
```

Expected response fields (based on code paths that emit counters):
`processed`, `success`, `failed`, `pending`, `expired`, `cancelled`, `errors`.

> `[RESPONSE STRUCTURE UNKNOWN]` for the exact JSON shape — the service method
> was not read line-by-line during audit. Verify against live response.

---

## 6. End-to-end scenarios

### A. Success
1. `POST /api/payments/create-intent`.
2. Complete payment in the PhonePe checkout UI.
3. Webhook OR `POST /api/payments/verify` finalizes the attempt to `SUCCESS`.
4. `payments` row exists; obligation moves toward `PAID`; a `Receipt` row is
   auto-created and a receipt PDF email is queued if owner preference
   `auto_email_receipt` is enabled
   (`payment-service.ts:91-120`).

### B. Cancelled / failed
1. Create intent.
2. Cancel or fail the payment in the gateway.
3. Verify or reconcile marks the attempt `FAILED` / `CANCELLED`.
4. No `payments` row is written; obligation remains `PENDING` / `PARTIAL`.

### C. Delayed webhook
1. Create intent and complete payment in the gateway.
2. Wait beyond the expected webhook window.
3. Call `POST /api/payments/verify` or `POST /api/payments/reconcile`.
4. Attempt eventually reaches terminal state and a payment is recorded.

### D. Amount tamper guard
`handlePaymentWebhook` compares the webhook amount (in paise) against the
stored attempt amount and rejects mismatches with `BAD_REQUEST` — verify by
replaying a webhook with a mutated `amount` field
(`payment-service.ts:621-633`).

### E. Only top-20 pending attempts are scanned
The webhook handler only loops over the 20 most recent `PENDING` attempts for
the provider
(`payment-service.ts:602-607`). When load-testing or processing a backlog,
stale pending attempts older than that window will be invisible to
`handlePaymentWebhook` — they must be drained via
`POST /api/payments/verify` / `/api/payments/reconcile`. See
`docs/TASKS.md:T-012`.

---

## 7. Observability

Service logs emit:

- `[payments.createIntent]` — in `payment-service.ts`
- `[payments.webhook]` — attempt lookup, match, amount check
- `[payments.verify]` — cached vs provider sources
- `[payments.reconcile]` — per-attempt status transitions
- `[webhook.phonepe]` — route-level (received / validation / error)

Use these prefixes when grepping Vercel logs during incidents.

---

## 8. Required environment

See `ENV_SETUP.md §1.5`. Minimum for a successful flow:

```
PHONEPE_CLIENT_ID
PHONEPE_CLIENT_SECRET
PHONEPE_ENV                     # "production" for live, else sandbox
PHONEPE_WEBHOOK_USERNAME
PHONEPE_WEBHOOK_PASSWORD
NEXT_PUBLIC_FRONTEND_URL        # used for redirectUrl / callbackUrl fallback
```

On the hostel side, `hostels.phonepe_merchant_id` should be set in the
owner's Preferences → Payment section.
