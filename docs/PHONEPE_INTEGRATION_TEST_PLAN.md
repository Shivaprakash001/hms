# PhonePe Integration Test Plan (HMS)

This checklist validates the full server-side payment lifecycle in this repo.

## 1) Database Sanity Checks

Run these on your DB before gateway tests:

```sql
-- Payment attempts lifecycle
select id, provider, merchant_txn_id, gateway_txn_id, amount, status, created_at, confirmed_at
from public.payment_attempts
order by created_at desc
limit 20;

-- Recorded payments
select id, obligation_id, student_id, owner_id, amount_paid, payment_method, reference_number, payment_date, payment_attempt_id
from public.payments
order by created_at desc
limit 20;

-- Obligation status impact
select id, student_id, amount, status, due_date, rent_month
from public.rent_obligations
order by due_date desc
limit 20;
```

Expected:
- `payment_attempts.status` transitions: `CREATED` -> `PENDING` -> (`SUCCESS` | `FAILED` | `EXPIRED` | `CANCELLED`)
- On success, one row appears in `payments` with `payment_attempt_id` linked.

## 2) Create Intent Test

Endpoint: `POST /api/payments/create-intent`

```bash
curl -X POST "$BASE_URL/api/payments/create-intent" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "obligation_id": "<obligation_uuid>",
    "amount": 5000
  }'
```

Expected response contains:
- `id` (attempt id)
- `merchant_txn_id`
- `status = PENDING`
- one of `checkout_url`/`upi_intent_url`/`qr_payload` in provider payload

## 3) Webhook Handling Test

Endpoint: `POST /api/webhooks/payments/phonepe`

Notes:
- Verify from logs that webhook is received and matched to `merchant_txn_id`.
- Signature is validated when `x-verify` + salt config are present.

Expected:
- matching `payment_attempt` gets finalized
- success webhook creates payment row and marks attempt `SUCCESS`

## 4) Manual Verify Test (Server-side fetch from provider)

Endpoint: `POST /api/payments/verify`

```bash
curl -X POST "$BASE_URL/api/payments/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "attempt_id": "<attempt_uuid>"
  }'
```

Alternative body fields supported:
- `merchant_txn_id`
- `gateway_txn_id`

Expected:
- backend fetches provider status and finalizes attempt
- response includes updated attempt status

## 5) Reconciliation Test

Endpoint: `POST /api/payments/reconcile`

```bash
curl -X POST "$BASE_URL/api/payments/reconcile" \
  -H "Authorization: Bearer $OWNER_OR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_ids": ["<attempt_uuid_or_merchant_txn_id>"]
  }'
```

Expected response:
- `processed`, `success`, `failed`, `pending`, `expired`, `cancelled`, `errors`

## 6) End-to-End Scenarios

### A. Success
1. Create intent
2. Complete payment in PhonePe
3. Webhook or verify endpoint finalizes success
4. `payments` row exists and obligation moves toward `PAID`

### B. Cancelled/Failed
1. Create intent
2. Cancel payment in gateway
3. Verify/reconcile marks `FAILED` or `CANCELLED`

### C. Webhook delayed
1. Create intent and complete payment
2. Run `POST /api/payments/verify` or `POST /api/payments/reconcile`
3. Attempt eventually moves to final status

## 7) Observability (already added)

Service logs now emit:
- `[payments.createIntent]`
- `[payments.webhook]`
- `[payments.verify]`
- `[payments.reconcile]`

Use these for root-cause analysis during gateway incidents.
