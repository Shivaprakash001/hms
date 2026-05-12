# HMS Financial Production Rollout

Date: 2026-05-12  
Scope: production readiness gate for PhonePe-backed PlatformBilling and RentCollection safety infrastructure.

## Non-Negotiable Gates

Run these before enabling live PhonePe traffic:

```bash
cd backend-next
npm run check:payment-production
npm run check:invariants
npm run check:financial-safety
```

The rollout is blocked if:

- any command fails,
- `check:financial-safety` reports CRITICAL or HIGH findings,
- webhook credentials are missing,
- `PHONEPE_ENV` is not `production`,
- the financial safety migration has not been applied,
- open high/critical payment anomalies exist.

## Migration Sequence

1. Deploy additive schema migration:

```bash
cd backend-next
DOTENV_CONFIG_PATH=../.env node -r dotenv/config ./node_modules/prisma/build/index.js migrate deploy
```

2. Run dirty-data discovery:

```bash
npm run check:financial-safety -- --warn-only
```

3. Resolve historical dirty data before live traffic:

- null or mismatched `hostel_id`,
- `SUCCESS` rent attempts without payment ledger rows,
- payment rows without receipts,
- duplicate provider references,
- stale `PROCESSING` / `PENDING_VERIFICATION`,
- obligation overpayments,
- open operational anomalies.

4. Run blocking check:

```bash
npm run check:financial-safety
```

## Required Environment

Production payment rollout requires:

- `DATABASE_URL`
- `PHONEPE_ENV=production`
- `PHONEPE_CLIENT_ID`
- `PHONEPE_CLIENT_SECRET`
- `PHONEPE_CLIENT_VERSION`
- `PHONEPE_WEBHOOK_USERNAME`
- `PHONEPE_WEBHOOK_PASSWORD`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_FRONTEND_URL` or `PHONEPE_REDIRECT_URL`
- `CRON_SECRET`

Recommended:

- `HMS_FINANCIAL_OWNER_ID`

All public URLs must use HTTPS.

## Operational Verification

After migration and before rollout, verify read-only finance ops endpoints as an admin:

- `/api/admin/finance-ops`
- `/api/admin/finance-ops/attempts`
- `/api/admin/finance-ops/anomalies`
- `/api/admin/finance-ops/reconciliation-runs`
- `/api/admin/finance-ops/webhook-events`

For any payment attempt under investigation:

- `/api/admin/finance-ops/attempts/{id}`

This must show:

- ordered status timeline,
- webhook events,
- provider verification snapshots,
- reconciliation items,
- anomalies,
- ledger/receipt links.

## Chaos Verification

Use only against staging or a controlled sandbox:

```bash
cd backend-next
npm run chaos:payments -- duplicate-webhook
npm run chaos:payments -- invalid-signature
npm run chaos:payments -- reconcile-race
```

Expected:

- duplicate webhook creates at most one settlement,
- invalid signature creates durable anomaly and no settlement,
- webhook/reconcile race converges to one terminal state,
- `npm run check:financial-safety` remains clean after each scenario.

## Go-Live Process

1. Enable live PhonePe env vars.
2. Deploy migration and code.
3. Run production readiness checks.
4. Enable one internal/staff hostel first.
5. Monitor finance ops summary and anomalies during live checkout.
6. Run reconciliation after the first successful payment.
7. Run `check:financial-safety`.
8. Expand hostel rollout only after a clean reconciliation window.

## Rollback / Pause Criteria

Immediately pause live payment initiation if any of these occur:

- orphan success anomaly,
- duplicate provider reference anomaly,
- webhook signature failures above expected validation noise,
- stale settlement locks not repaired by reconciliation,
- payment ledger without receipt beyond retry window,
- dashboard/ledger divergence,
- provider status conflict.

Rollback should disable new payment initiation while keeping webhook, verify, reconciliation, and admin finance-ops endpoints available for recovery.
