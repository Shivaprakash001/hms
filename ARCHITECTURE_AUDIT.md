# HMS Architecture Audit

## Executive Summary
The repository currently functions but suffers from significant architectural drift, monolithic "God classes," and mixed concerns. The lack of standard layer separation (Controllers -> Services -> Repositories) in the backend and feature-based organization in the frontend hinders scalability and contributor onboarding.

## 1. Codebase Size & "God" Files
We identified several massively oversized files that violate the Single Responsibility Principle:

### Backend
* `lib/services/payment-service.ts` (**3,219 lines**): A massive God class that handles webhook parsing, order creation, receipt generation, and DB mutations simultaneously.
* `lib/services/rent-generation-service.ts` (654 lines)
* `lib/services/tenant-service.ts` (726 lines)
* `lib/services/hostel-policy-service.ts` (762 lines)

### Frontend
* `src/api/services.js` (**856 lines**): Contains every single API endpoint for the entire application, tightly coupled.
* `src/pages/owner/ManageRooms.jsx` (928 lines): Mixed UI, local state, and API logic.
* `src/pages/owner/ManageTenants.jsx` (839 lines): Oversized, handling table rendering, modals, and data fetching in one file.
* `src/layouts/HostelWorkspaceLayout.jsx` (691 lines): Layout component carrying excessive business logic.

## 2. Structural & Boundary Violations
### Backend (Next.js)
* **Missing Repository Layer:** Services directly execute `prisma.$queryRaw` and Prisma ORM calls. Database logic is not abstracted, making it impossible to mock or swap cleanly.
* **Missing `src/` encapsulation:** Source code is scattered across `/app`, `/lib`, `/components`, `/types`, and scripts in the root directory.
* **Monolithic Services Folder:** `lib/services` contains **78 files** loosely dumped together, mixing core domains like `auth`, `payments`, `tenants`, and `webhooks`.

### Frontend
* **Flat Page Organization:** `src/pages/owner/` dumps all views together.
* **Missing Feature Slices:** `src/components/` is fragmented. We need `src/features/` to encapsulate domain-specific logic (e.g., `features/tenants`, `features/billing`).
* **Deep Relative Imports:** No path aliases are used (e.g., `../../../components` instead of `@/components`).

## 3. Unused Dependencies & Dead Code
Based on dependency analysis (`depcheck`):
* **Frontend:** Unused production dependencies include `@fontsource-variable/geist`, `lodash.debounce`, `tw-animate-css`.
* **Backend:** Unused production dependencies include `@vercel/speed-insights`, `pino`, `pino-pretty`.
* Multiple scratch/test files exist in production folders (e.g., `scratch/list_rooms.js`, `test-live-metrics.js`).

## 4. Security & Error Handling
* API error handling in `backend-next/app/api/` routes frequently catches generic `any` errors without domain-specific custom Error classes.
* Raw SQL queries exist in multiple services (`$queryRaw`) without a centralized repository abstraction to manage query safety and performance reliably.

## Proposed Target Architecture
We will transition to a **Domain-Driven, Feature-Based Architecture**.

**Frontend Structure:**
```text
src/
 ├── features/        (Domain logic: Auth, Tenants, Rooms, Payments)
 │    └── [feature]/
 │         ├── components/
 │         ├── hooks/
 │         ├── api.js
 │         └── utils.js
 ├── components/      (Global shared UI components)
 ├── layouts/         (App shells)
 ├── lib/             (Third-party wrappers)
 ├── pages/           (Thin page wrappers mapping to features)
 ├── hooks/           (Global hooks)
 ├── store/           (Global state/Context)
 └── utils/           (Shared helpers)
```

**Backend Structure:**
```text
backend-next/
 ├── app/api/         (Next.js Routers - Thin controllers only)
 ├── src/
 │    ├── services/   (Pure business logic)
 │    ├── repositories/(Prisma DB interactions)
 │    ├── validators/ (Zod schemas)
 │    ├── lib/        (Core wrappers: Auth, PDF, Payments)
 │    ├── utils/      (Shared helpers)
 │    └── config/     (Environment variables and constants)
```
