# HMS Payment State Machine

Date: 2026-05-12  
Scope: production safety contract for `PaymentAttempt`, `Payment`, webhooks, verification, manual review, and reconciliation.

## Core Contract

`PaymentAttempt` is orchestration state.  
`Payment` is immutable financial ledger.

Once a rent settlement creates `Payment` rows:

- the ledger amount is final,
- the ledger row is never deleted,
- settled amount/reference fields are never edited,
- corrections must be additive-only in a future correction ledger,
- post-commit side effects may retry, but settlement history must not be rewritten.

## Financial Domains

### PlatformBilling

Owner pays HMS/Sri Adithya Hostels.

Flows:

- `SUBSCRIPTION`
- `ADDON`

Scope:

- `PLATFORM`

Merchant context:

- `HMS_PLATFORM`

PlatformBilling must not reference rent obligations or create rent `Payment` rows.

### RentCollection

Tenant pays hostel owner.

Flows:

- `RENT`
- `ADVANCE`
- `MANUAL_UPI_REFERENCE`

Scope:

- `HOSTEL`

Merchant context:

- `OWNER_HOSTEL` only.
- PhonePe hosted checkout for rent/advance is quarantined until owner merchant onboarding and owner merchant credentials exist.
- HMS platform merchant credentials must never be used for tenant rent, advance, maintenance, or hostel operational obligations.
- Future owner merchant onboarding plugs into this context without changing settlement semantics.

Every operational RentCollection flow requires `hostel_id`.

## Provider Identity

Do not treat `PaymentAttempt.id` as provider transaction identity.

Identifiers:

- `merchant_transaction_id`: HMS-generated canonical outbound id. This maps to legacy `merchant_txn_id`.
- `provider_transaction_id`: provider payment transaction id when available.
- `provider_order_id`: provider order/payment-link id.
- `provider_reference_id`: provider support/bank/UPI trace reference.

Matching rules:

- internal lookup uses `merchant_transaction_id`,
- webhook initial match uses provider merchant order/transaction id to find `merchant_transaction_id`,
- reconciliation fetches provider state by `merchant_transaction_id`, with `provider_order_id` as secondary context,
- provider reference collisions produce `DUPLICATE_PROVIDER_REFERENCE` anomalies,
- operational UI may display merchant/provider ids, but never uses audit sequence ids as payment references.

## Attempt Statuses

Allowed orchestration statuses:

- `CREATED`
- `PENDING`
- `PENDING_VERIFICATION`
- `PENDING_MANUAL_CONFIRMATION`
- `PROCESSING`
- `SUCCESS`
- `FAILED`
- `EXPIRED`
- `CANCELLED`

Settlement statuses:

- `NOT_APPLICABLE`
- `NOT_SETTLED`
- `SETTLED`
- `SETTLEMENT_FAILED`

`SETTLED` implies `SUCCESS`.

## Settlement Ownership

Settlement execution is owned by the actor that successfully claims the attempt lock.

Claim contract:

- webhook, redirect verification, reconciliation, and manual confirmation must first transition or claim the attempt into `PROCESSING`,
- only the execution path that acquired the claim may mutate settlement state,
- competing executions must observe the current terminal/locked state and become idempotent no-ops,
- a stale claim is recoverable only by reconciliation after the recovery window,
- no path may create ledger rows unless it owns the settlement claim.

For RentCollection settlement, claim ownership is not sufficient by itself. The owner must also prove:

- immutable `hostel_id`,
- obligation lock,
- amount still outstanding,
- tenant/obligation/payment hostel match,
- deterministic idempotency key.

## Financial Time Authority

The canonical financial timestamp for reporting is settlement commit time:

- `Payment.payment_date` for rent ledger reporting,
- `PaymentAttempt.settled_at` for attempt settlement reporting,
- provider/webhook timestamps are evidence, not accounting authority.

Dashboards, analytics, monthly collection, and operational reports should use settlement commit time for financial inclusion. Webhook receive time, redirect time, provider creation time, and client time must not determine monthly financial totals.

## Allowed Transitions

| From | To | Source | Conditions |
| --- | --- | --- | --- |
| none | `CREATED` | `CREATE_INTENT` | Attempt inserted with domain, scope, merchant context, and merchant transaction id. |
| `CREATED` | `PENDING` | `CREATE_INTENT` | Provider checkout/order creation succeeded. |
| `CREATED` | `FAILED` | `CREATE_INTENT` | Provider checkout/order creation failed. |
| `CREATED` | `EXPIRED` | `RECONCILE` | Attempt is stale before provider checkout completed. |
| `PENDING` | `PENDING_VERIFICATION` | `WEBHOOK` | Authenticated webhook claimed the attempt for provider source-of-truth verification. |
| `PENDING` | `PROCESSING` | `VERIFY` or `RECONCILE` | Provider source-of-truth returned terminal status or safe repair is executing. |
| `PENDING_VERIFICATION` | `PENDING` | `RECONCILE` | Stale verification lock reset. |
| `PENDING_VERIFICATION` | `PROCESSING` | `WEBHOOK` | Provider source-of-truth returned terminal status. |
| `PROCESSING` | `SUCCESS` | `WEBHOOK`, `VERIFY`, `RECONCILE`, `MANUAL_CONFIRM` | Settlement mutation and status update succeed atomically. |
| `PROCESSING` | `FAILED` | `WEBHOOK`, `VERIFY`, `RECONCILE` | Provider terminal failure or validation failure. |
| `PROCESSING` | `EXPIRED` | `WEBHOOK`, `VERIFY`, `RECONCILE` | Provider/local expiry is terminal and no ledger is created. |
| `PROCESSING` | `CANCELLED` | `WEBHOOK`, `VERIFY`, `RECONCILE` | Provider terminal cancellation. |
| `PROCESSING` | `PENDING_MANUAL_CONFIRMATION` | `WEBHOOK`, `VERIFY` | Provider success is established but automation plan gate requires owner confirmation. |
| `PENDING_MANUAL_CONFIRMATION` | `PROCESSING` | `MANUAL_CONFIRM` | Only manual reference attempts or provider-success plan-gated attempts. |
| `PENDING_MANUAL_CONFIRMATION` | `FAILED` | `MANUAL_REJECT` | Owner rejects manual review. |

Forbidden:

- `SUCCESS` without ledger settlement for RentCollection `RENT`,
- manual owner confirmation of provider attempts before provider success is established,
- provider webhook settlement from raw webhook claims without source-of-truth verification,
- RentCollection mutation without `hostel_id`,
- RentCollection provider routing to `HMS_PLATFORM`,
- PhonePe hosted rent/advance checkout before direct owner merchant routing exists,
- PlatformBilling attempts creating rent ledger rows,
- deleting or editing settled `Payment` rows.

## Ordering

Every status transition appends `PaymentAttemptStatusEvent`.

Ordering is deterministic:

- `transition_sequence` is monotonically increasing per attempt,
- sequence allocation happens inside the same DB transaction as the status update,
- timestamps are informational only.

## Idempotency Boundaries

Webhook processing:

- idempotent by `PaymentWebhookEvent.event_hash`,
- duplicate processed webhooks return the prior outcome,
- invalid signatures are durably recorded and never settle money.

Settlement:

- idempotent by attempt status lock plus deterministic payment idempotency keys,
- duplicate webhook/verify/reconcile races must produce at most one ledger settlement.

Receipt generation:

- idempotent by `receipt.payment_id`,
- retrying receipt generation is allowed after settlement commit.

Reconciliation repair:

- detect first,
- repair only deterministic-safe cases,
- ambiguous cases become `MANUAL_REVIEW_REQUIRED` / durable anomaly.

Dashboard invalidation:

- post-commit only,
- hostel-scoped,
- repeat invalidation is harmless.

Provider verification snapshots:

- every provider source-of-truth fetch should persist a normalized snapshot,
- snapshot fields include provider status, normalized status, provider identifiers, raw response hash, and `verified_at`,
- snapshots are audit evidence and must not directly settle money.

## Reconciliation Authority

Reconciliation has two phases:

1. Detect anomalies.
2. Repair only deterministic-safe states.

Safe repairs:

- stale `CREATED` to `EXPIRED`,
- stale `PROCESSING` with existing valid ledger to `SUCCESS`,
- stale `PROCESSING` without ledger back to `PENDING`,
- provider terminal status for a pending attempt when hostel, amount, ownership, and provider identity are unambiguous.

Manual review required:

- duplicate provider references,
- amount mismatch,
- cross-hostel mismatch,
- provider status conflicts,
- `SUCCESS` attempt without ledger,
- multiple possible attempts for one provider reference,
- receipt/dashboard divergence that cannot be recomputed deterministically.

## Post-Commit Side Effects

These happen only after settlement transaction commit:

- dashboard invalidation,
- snapshot stale marking,
- receipt generation,
- reminder conversion/cancellation,
- analytics refresh,
- SSE/events/activity logs,
- WhatsApp/SMS notification triggers.

If a side effect fails, settlement remains valid and the side effect must be retryable or observable.

## Operational Surfaces

Admin-only finance operations APIs expose:

- payment attempt search and status,
- per-attempt transition timeline,
- webhook event history,
- provider verification snapshots,
- reconciliation runs/items,
- operational anomalies.

These surfaces are read-only by default. Repair actions must remain explicit, audited, and deterministic-safe.

## Operational Verification

Run before production rollout and after migration/backfill:

```bash
cd backend-next
npm run check:invariants
npm run check:financial-safety
```

For dirty-data discovery without failing CI:

```bash
cd backend-next
npm run check:financial-safety -- --warn-only
```
