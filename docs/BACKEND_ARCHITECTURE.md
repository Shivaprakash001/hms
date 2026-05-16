# Backend Architecture Refactor

This document outlines the domain-based architecture transition plan for the `backend-next` service. 

## Goal
Transition from a flat, route-heavy and service-heavy structure into a cleanly layered, domain-centric architecture.

## Structure

```txt
backend-next/src/
├── services/        # Domain-based business logic (e.g., auth, tenants, rooms)
├── repositories/    # Database abstraction (Prisma calls, pagination, transactions)
├── validators/      # Zod schemas, DTO validations
├── lib/             # Shared utilities (api-response, api-error)
```

## Layer Responsibilities

### 1. Repositories (`src/repositories/`)
- Encapsulate all database (`prisma`) interactions.
- Provide standard CRUD methods (`findMany`, `create`, `update`, etc.).
- Expose a `transaction()` method to wrap domain transactions.
- **DO NOT** contain business rules.
- **DO NOT** import `services` (prevents circular dependencies).

### 2. Services (`src/services/<domain>/`)
- Encapsulate the core business logic and state machine workflows.
- Responsible for transactional workflows spanning multiple repositories.
- Perform high-level authorization/business invariant checks.
- Call event triggers (`eventSystem`).

### 3. Validators (`src/validators/<domain>/`)
- House `zod` schemas for request DTO parsing.
- Enforce schema validations (types, lengths, enumerations).
- **DO NOT** perform DB existence checks here (handled in services).

### 4. Routes (`app/api/<route>`)
- Follow a thin "controller" pattern.
- Primary flow: `Parse Request -> Call Validator -> Invoke Service -> Return ApiResponse`.
- **Avoid** raw Prisma usage in routes.

### 5. Shared Responses (`src/lib/api-response.ts`)
- Use `ApiResponse.success(data)` to standardize successful JSON output.
- Use `ApiResponse.error(ApiError.badRequest(...))` to map exceptions securely.

## Migration Pattern (Strangler Fig)

1. **Service Migration**: Move a domain service (e.g., `room-allocation-service.ts`) into its domain folder without modifying logic. Fix imports.
2. **Repository Adoption**: Gradually replace raw `prisma.<model>` calls in the service with calls to `<model>Repository`.
3. **Response Standardization**: Update individual API routes to use `ApiResponse`, while ensuring frontend clients are configured to elegantly handle the `{ success: true, data: [...] }` wrapper (graceful fallback).
4. **Validation Boundary**: Extract Zod schemas to `src/validators/<domain>/` and re-export them from legacy locations until all consuming routes are updated.

- **Rooms Domain**: Fully migrated. Serves as the pilot domain for this architectural shift.
- **Tenants Domain**: Fully migrated. Core services (`tenant-service`, `invitation-service`, `tenant-transfer-service`, `tenant-score-service`) moved. DB access isolated to `tenantRepository`. Validators moved to `src/validators/tenants/`. Route refactoring to thin layer (`ApiResponse`) is actively ongoing.
- **Payments & Billing Domain**: Partially migrated using a **"Read First, Write Later"** strategy due to high-risk financial boundaries.
  - *Payment Repository Ownership Rules*: `paymentRepository`, `billingRepository`, and `invoiceRepository` own read-only operations, complex joins, analytics aggregations, and pagination.
  - *Transaction Ownership Rules*: Multi-row mutation transactions, idempotency enforcement, and `FOR UPDATE` locking **MUST REMAIN** inside `payment-service` and `rent-generation-service` orchestration layers to preserve financial safety.
  - *Safe Extraction Policy*: Only operations that do not mutate balance, settle invoices, or require row-level concurrency locks are safely extractable to repositories at this time.
  - *Compatibility Adapters*: Frontend gracefully unwraps `ApiResponse` and legacy formats via an `unwrap()` utility in `frontend/src/features/payments/api/index.js` to prevent regressions.
  - *Remaining Technical Debt*: Mutation methods (`recordTenantPayment`, `_applyPaymentInTx`) in `payment-service.ts` remain deeply coupled to Prisma. They will be refactored into a standardized `Unit of Work` or `CQRS` pattern in a later phase.
