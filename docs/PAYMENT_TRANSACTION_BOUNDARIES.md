# Payment & Billing Transaction Boundaries Audit

## Overview
The Payments and Billing domain handles highly concurrency-sensitive financial operations. To ensure idempotency, prevent double-spending, and maintain strict consistency, the domain heavily utilizes `FOR UPDATE` locking, multi-row atomic transactions, and specialized idempotency keys. 

During the "Read First, Write Later" phase of the repository migration, **these transactional orchestration flows MUST remain inside the Service layer.**

## 1. Transactional Ownership Map

### `payment-service.ts`
*   **`_applyPaymentInTx(tx, data)`**: Core payment logic. Runs entirely within a passed transaction. Locks the `rent_obligations` row using `FOR UPDATE` to prevent concurrent modification of the outstanding balance.
*   **`recordOfflinePaymentWithToken`**: Wraps `_applyPaymentInTx`. Atomically marks an `identity_tokens` row as `used: true` AND records the payment.
*   **`recordTenantPayment`**: The FIFO payment allocator. Extremely sensitive.
    *   Locks all `PENDING`/`PARTIAL` obligations for a tenant via `FOR UPDATE`.
    *   Uses a `payment_group_id` for batching.
    *   Enforces a unique constraint on `idempotency_key` via DB indices to safely ignore network retries.
    *   **Migration Status**: **UNSAFE TO EXTRACT** — Must remain in `payment-service`.

### `rent-generation-service.ts`
*   **`generateMonthlyRent`**: Generates monthly invoices for active tenants.
    *   Uses `prisma.$executeRaw` to acquire a global `system_locks` concurrency lock (preventing concurrent cron jobs).
    *   Uses `prisma.$transaction` to perform a bulk `createMany` of `RENT` and `MAINTENANCE` obligations.
    *   Rolls back the entire transaction if either insert fails, writing failure entries to a `rentGenerationLedgerService` outside the transaction.
    *   **Migration Status**: **UNSAFE TO EXTRACT** — Must remain in `rent-generation-service`.

### `settlement-ledger-service.ts` (and related ledger logic)
*   Used inside `payment-service` transactions to simultaneously credit/debit the owner's settlement ledger when a payment is processed.

## 2. Race-Condition-Sensitive Areas
*   **Double-Clicking "Pay"**: Handled by the `idempotency_key` on `prisma.payments`.
*   **Concurrent Payment & Reminder Processing**: Handled by `FOR UPDATE` row-level locking on `rent_obligations` during `_applyPaymentInTx`.
*   **Overlapping Rent Generation**: Guarded by `system_locks` using `ON CONFLICT DO UPDATE`.

## 3. Safe Extraction Candidates (Read-Only Repositories)
These operations are pure queries, aggregations, or paginated lists. They do not hold locks or mutate financial state and are safe to extract to `paymentRepository`, `invoiceRepository`, and `billingRepository`.
*   `getAllPayments` (Payment listing with filters)
*   `getPaymentById`
*   `getTenantTotalDues` / `getTenantDues` (Simple aggregations)
*   `getPaymentAttempts` / `getPaymentHistory`
*   Dashboard aggregations / Income summaries
*   Receipt fetches

## 4. Unsafe Extraction Candidates (Mutations)
These operations mutate state and must stay in the Service layer orchestrator for now:
*   `recordPayment`, `recordTenantPayment`, `_applyPaymentInTx`
*   `waiveObligation`
*   `generateMonthlyRent`
*   `applyTenantAdvance`
*   `confirmPayment` (Webhook fulfillment)

## Summary Policy
**"Read First, Write Later"**: Repositories in the payments domain will act solely as Prisma `findMany`/`aggregate` wrappers. Any operation involving `$transaction`, `update`, `create`, or `$executeRaw` locks will be preserved in the `src/services/payments/` layer until a future CQRS or Unit of Work pattern is explicitly sanctioned.
