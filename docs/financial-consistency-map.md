# HMS Financial Consistency Map

## Canonical Kernel

- `backend-next/lib/services/financial-service.ts`
  - `getOperationalDues(ownerId)`
  - `getOperationalCashflowMetrics(ownerId, start, end)`
  - `getOperationalDefaulters(ownerId, limit)`
  - `getOperationalOverdueObligations(asOfDate)`
  - `getOperationalOutstandingByTenants(ownerId, tenantIds)`
  - `getTenantDues(tenantId)`
  - `getTenantPaymentSummary(tenantId, obligationRows)`

Operational definition:
- ACTIVE tenants only
- Remaining-balance basis: `max(amount - paid, 0)`
- Excludes WAIVED from collectible family
- Pending/overdue/unpaid counts derive from positive remaining only

## Module -> Metric -> Canonical Source

- `analytics-service.ts`
  - Cashflow expected/collected/pending/overdue/unpaid/overdue_count/collection_rate -> `getOperationalCashflowMetrics`
  - Top defaulters -> `getOperationalDefaulters`
  - Tenant intelligence risky pending amounts -> `getOperationalOutstandingByTenants`

- `dashboard-service.ts`
  - Owner stats pending/overdue/count/unpaid -> `getOperationalDues`
  - Monthly due/collected/collection_rate -> `getOperationalCashflowMetrics`
  - Tenant stats pending/next due -> `getTenantDues`

- `dashboard-snapshot-service.ts`
  - Persists outputs from `dashboard-service` (no independent financial math)

- `reminder-service.ts`
  - Reminder candidate obligations -> `getOperationalOverdueObligations`

- `tenant-service.ts`
  - Tenant list payment summary -> `getTenantPaymentSummary`
  - Owner tenant overview outstanding -> `getTenantDues`

- `payment-service.ts`
  - Tenant dues endpoint adapter -> `getTenantDues`
  - Payments list operational stats pending/overdue -> `getOperationalDues`
  - Tenant payment history outstanding/next due -> `getTenantDues`

- `property-service.ts`
  - Room/floor tenant pending dues and payment status -> `getTenantPaymentSummary`

## Invariants

- If `pending_total == 0` then `unpaid_tenant_count == 0`.
- Unpaid counts are never status-only; they require `remaining > 0`.
- Collection-rate numerator and denominator come from one obligation family.
- CANCELLED/EXPIRED/INVITED/LEFT do not contribute to operational metrics.
