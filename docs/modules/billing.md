# Billing

## What this does

The billing module helps owners understand dues, collections, payment attempts, cash flow, expenses, risk, and receipts. It is the operational center for money movement.

## Screen breakdown

| Screen | Purpose | Data shown |
|---|---|---|
| Billing dashboard | Chooses hostel finance context | Hostel list and finance entry |
| Financial control center | Main finance screen | KPIs, pipeline, ledger, risk, activity |
| Payment detail drawer | Explains one obligation or payment | Amounts, status, receipt actions |
| Record payment modal | Records offline collections | Tenant dues, amount, reference |
| Tenant financials | Tenant-facing dues and payments | Obligations, history, advance ledger |

## Data it needs

- `paymentService.getAll(hostelId)` from `/payments`.
- `paymentService.getAllDues(hostelId)` from `/payments/dues`.
- `paymentService.getDetail(obligationId, hostelId)` from `/payments/:id`.
- `paymentService.recordOfflinePayment(data)` from `/payments/record-offline`.
- `paymentService.createIntent(data)` from `/payments/create-intent`.
- `paymentService.downloadReceipt(paymentId)` from `/payments/:id/receipt`.
- Dashboard finance endpoints for stats, cash flow, funnel, and operations.

## Data it produces

- `rent_obligations` through rent generation and initial onboarding.
- `paymentAttempt` records for hosted checkout.
- `payments` records for successful or offline payments.
- `receipts` and cached receipt PDFs.
- Reconciliation runs and operational anomalies.

## Key components

- `BillingView` selects the billing surface.
- `FinancialControlCenter` composes the finance dashboard.
- `HealthBar` renders finance KPIs.
- `CollectionPipeline` shows overdue and collection state.
- `PaymentLedger` renders payments and obligations.
- `PaymentDetailDrawer` renders details and receipt actions.
- `TenantPaymentModal` creates tenant payments.

## Business logic in this module

- Obligations are the source of truth for money owed.
- Payment attempts track provider checkout state.
- Payments allocate money against obligations.
- Late fees use a pure billing engine with grace days and caps.
- Reconciliation detects provider and ledger mismatches.

## How this works (step by step)

1. The owner opens `/billing` or a hostel finance surface.
2. The UI fetches dashboard stats, dues, and payment ledger data.
3. The owner records offline payment or reviews online attempts.
4. Backend services update obligations, payments, attempts, and receipts.
5. Finance query keys refresh and the dashboard totals change.

## How to reuse this for a new client

- Keep obligations as the financial source of truth.
- Replace PhonePe credentials and settlement rules.
- Confirm offline payment methods and receipt format.
- Reconfigure late fee rules, due days, grace days, and caps.

**How this works:**
1. Rent generation creates obligations.
2. Collections create payments.
3. Reports read both to explain expected, collected, pending, and overdue money.

