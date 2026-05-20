# OWNER BILLING & REVENUE MODULE REDESIGN

## 1. Backend Aggregation Plan & API Contract Recommendations

To power the modern financial operations dashboard, the backend needs specialized analytical endpoints to avoid N+1 queries and compute heavy aggregations on the client.

### Proposed Endpoints
- **`GET /api/v1/owner/billing/overview`**
  - **Purpose:** KPI metrics for the Financial Summary Strip.
  - **Contract:**
    ```json
    {
      "collected_this_month": 150000,
      "pending_dues": 45000,
      "overdue_amount": 12000,
      "collection_rate": 0.85,
      "late_fee_generated": 1500,
      "expected_revenue": 207000,
      "failed_transactions": 3,
      "occupancy_revenue_efficiency": 4500
    }
    ```
- **`GET /api/v1/owner/billing/cashflow`**
  - **Purpose:** Time-series data for cashflow charts.
  - **Contract:**
    ```json
    {
      "monthly_trend": [{"month": "2026-01", "collected": 140000, "pending": 10000}],
      "payment_methods": {"UPI": 60, "BANK_TRANSFER": 30, "CASH": 10},
      "hostel_breakdown": [{"hostel_id": "uuid", "revenue": 100000}]
    }
    ```
- **`GET /api/v1/owner/billing/payments`**
  - **Purpose:** Powers the Advanced Payment Table with server-side pagination, smart filtering, and risk indicators.
  - **Contract:**
    ```json
    {
      "data": [
        {
          "payment_id": "uuid",
          "tenant": {"id": "uuid", "name": "John Doe", "course": "B.Tech", "risk_score": 85},
          "hostel": {"name": "Hostel A"},
          "room_no": "101",
          "rent_month": "2026-05",
          "amount_due": 5000,
          "amount_paid": 5000,
          "pending_balance": 0,
          "late_fee": 0,
          "payment_status": "PAID",
          "payment_method": "UPI",
          "paid_date": "2026-05-02T10:00:00Z",
          "due_date": "2026-05-05T00:00:00Z",
          "reminders_sent": 1,
          "is_offline": false
        }
      ],
      "meta": { "total_pages": 5, "current_page": 1 }
    }
    ```
- **`GET /api/v1/owner/billing/overdue-intelligence`**
  - **Purpose:** Identifies risky dues, repeat offenders, and hostels with poor collection rates.

## 2. Data Mapping Report (Schema -> UI)

Every UI element derives directly from the Prisma schema:

- **Collected This Month:** `SUM(Payment.amount_paid)` where `payment_date` is in the current month.
- **Pending Dues:** `SUM(RentObligation.total_amount) - SUM(Payment.amount_paid)` where status is PENDING or PARTIAL.
- **Overdue Amount:** `SUM(RentObligation.total_amount - paid)` where `due_date < NOW()` and `status != PAID`.
- **Payment Method Distribution:** Group `Payment.payment_method`.
- **Transaction Details (Drawer):** `PaymentAttempt` and `Payment` links (`gateway_txn_id`, `merchant_txn_id`, `provider`).
- **Rent Breakdown:** `RentObligation.amount` + `RentObligation.late_fee`. Advance adjustments derive from `TenantAdvanceLedger`.
- **Tenant Risk Intelligence:** `TenantBehaviorScore.score`, `TenantBehaviorScore.metadata` (for average delay days).
- **Payment Timeline:** Combined logs from `RentGenerationLog`, `ReminderLog`, `PaymentAttempt`, and `Receipt`.

## 3. Risk Intelligence System

We introduce a basic Tenant Behavior Score in the database (`TenantBehaviorScore` model). The score starts at 100 and adapts based on actions:
- **Metrics Tracked:**
  - Payment consistency (paid on time vs late).
  - Overdue frequency.
  - Number of reminders needed before payment (`ReminderLog.converted_to_payment`).
  - Average delay in days (`payment_date` - `due_date`).
- **Risk Badges:**
  - **LOW RISK (Score > 85):** Usually pays on time, minimal reminders required.
  - **WATCHLIST (Score 60 - 85):** Often pays late, high reminder reliance.
  - **HIGH RISK (Score < 60):** Habitual defaulter, severe overdue instances.

## 4. Implementation Details (Frontend)

The new modules are modularized in `frontend-v2/src/app/components/views/billing/`:
- `FinancialSummaryStrip.tsx`
- `CashflowCharts.tsx`
- `SmartFilters.tsx`
- `AdvancedPaymentTable.tsx`
- `PaymentDetailDrawer.tsx`
- `OverdueIntelligence.tsx`

Each component incorporates mobile-first responsive design, proper empty states, and is structured to handle robust analytical data seamlessly.
