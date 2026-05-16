# Payments/Billing Domain Dependency Map

## 1. Core Services & Their Responsibilities

- **`payment-service.ts`**: The monolith. Handles payment creation, updates, deletions, partial payments, and integrates with the `obligation-engine`. Likely directly queries `prisma.payments`, `prisma.rent_obligations`, `prisma.tenants`, `prisma.rooms`.
- **`rent-generation-service.ts`**: Handles cron jobs or manual triggers to generate monthly rent obligations based on active tenant allocations and hostel billing preferences.
- **`invoice-service.ts`**: Generates invoices (likely PDFs or data structures) based on rent obligations and payments.
- **`reminder-service.ts`**: Generates and sends reminders for overdue payments. Modifies `prisma.reminder_logs`.
- **`financial-service.ts`**: Calculates tenant dues, payment summaries, and outstanding balances. Heavy read-only aggregation queries.
- **`receipt-service.ts`**: Generates payment receipts.
- **`obligation-engine.ts`**: Manages the lifecycle of financial obligations (creation, settlement).
- **`tenant-advance-service.ts`**: Manages advance deposits, refunds, and adjustments against rent.
- **`settlement-batch-service.ts` & `settlement-ledger-service.ts`**: Handles move-out settlements and ledger entries.

## 2. Transaction Boundaries

- **Payment Creation**: Creating a payment MUST atomically update the `rent_obligations` status (from `PENDING` to `PARTIAL` or `PAID`), update the `tenants` payment summary/status if applicable, and log the event.
- **Rent Generation**: Creating rent obligations MUST be atomic per tenant to avoid duplicate charges for the same month.
- **Advance Adjustment**: Deducting from advance deposit MUST atomically create a payment record and update the advance balance.
- **Move-out Settlement**: Must atomically process advance refunds, unpaid dues, and mark allocations as inactive.

## 3. Risky Coupling Areas

- **`payment-service.ts`**: Extremely large file (133KB). Likely contains mixed responsibilities (validation, DB access, event triggering, external API calls for payment gateways like Razorpay/MSG91).
- **Allocation Dependencies**: Rent generation depends heavily on `room_allocations` state. Stale active allocations lead to incorrect rent generation.
- **Circular Dependencies**: `payment-service` might call `financial-service` for balance calculation, and `financial-service` might depend on `payment-service` structs.
- **Dashboard Coupling**: The owner dashboard likely directly queries `prisma.payments` for revenue metrics instead of using a repository.
- **Analytics Coupling**: Analytics services directly query `prisma.payments` bypassing any logic.

## 4. Proposed Migration Strategy

1. **Service Migration**: Move all listed files into `src/services/payments/` without modifying internal logic.
2. **Repository Layer**: Create `paymentRepository.ts`, `invoiceRepository.ts`, `billingRepository.ts`. Extract `prisma.payments` and `prisma.rent_obligations` logic into them carefully, ensuring Prisma transactions (`tx`) can be passed down from the service layer to the repository methods.
3. **Validator Extraction**: Move Zod schemas (Payment, Invoice, Rent Generation) to `src/validators/payments/`.
4. **Thin Routes**: Refactor `app/api/payments/*` and `app/api/billing/*` to use `ApiResponse` and `ApiError`. Maintain legacy `response.data` compatibility in the frontend APIs.
