# PAYMENT_SYSTEM.md

> End-to-end payment architecture based on `payment-service.ts`.

---

## 1. Core Provider Abstraction

- **Provider**: Only `PhonePe` is implemented (`PaymentProviderFactory`).
- **Intent Flow**: 
  1. Frontend hits `/api/payments/create-intent` or `pay-dues`.
  2. Backend validates `allow_partial_payments` and `min_payment_amount` against hostel preferences.
  3. A `PaymentAttempt` row is created with status `CREATED`.
  4. PhonePe API is called.
  5. On success, attempt status becomes `PENDING` with `checkout_url` and `gateway_txn_id`.

---

## 2. FIFO Allocation & Atomic Execution

**FACT:** The backend enforces strict FIFO allocation for manual and multi-obligation payments.

- **Locking**: `recordTenantPayment` acquires a Postgres advisory lock `pg_advisory_xact_lock` keyed by the `tenant_id` to prevent concurrent execution.
- **Row Locks**: It then uses `SELECT id FROM rent_obligations WHERE ... FOR UPDATE` to lock the exact obligations.
- **Math**: All currency math is executed in Paisa (multiplied by 100) to avoid JavaScript floating point errors.
- **FIFO Logic**: Obligations are sorted by `due_date ASC`, then `RENT` before `LATE_FEE`. Payments cascade down the obligations until the `amountPaid` is exhausted. Status is set to `PARTIAL` or `PAID`.

---

## 3. Offline Payment Protection (Tokens)

**FACT:** Manual cash/offline payments can be protected via single-use `IdentityToken`s.
- `recordOfflinePaymentWithToken` atomically checks `used = false`, updates to `true`, and writes the `Payment` record in a single Prisma transaction.

---

## 4. Reconciliation & Webhooks

- **Webhook Route**: `POST /api/webhooks/payments/phonepe`.
- **Safety**: Ignores the webhook payload status to avoid spoofing. Always calls `PhonePe` API directly (`fetchStatus()`) to verify the true outcome.
- **Idempotency**: Uses Prisma's `updateMany` with `where: { status: "PENDING" }` to ensure the finalization logic runs exactly once.
- **Data Loss Prevention**: If an exception occurs, the raw payload is saved to `raw_webhook_payload` on the attempt before re-throwing.

---

## 5. Receipt Generation

- **Trigger**: Every recorded `Payment` (manual or gateway) triggers `receiptService.createReceipt()`.
- **Flow**: Creates a `Receipt` DB row -> generates PDF using `puppeteer-core` -> optionally emails the tenant via Resend if `prefs.auto_email_receipt` is enabled.
