# Multi-Hostel Architecture Audit & Migration Plan

## Current Architecture Reality
The current HMS architecture exists in a transitional state between a single-hostel legacy system and a true multi-hostel platform. The database schema recently introduced `hostel_id` across core operational entities (Tenants, Allocations, Obligations, Payments, Receipts, Complaints, Expenses) as "Phase 2" of multi-hostel support. However, these fields are currently nullable (`String?`), meaning the system relies heavily on application-level logic to maintain consistency. 

Key services (`financial-service.ts`, `dashboard-service.ts`, `analytics-service.ts`) primarily aggregate data at the `owner_id` level, with `hostel_id` acting as an optional filter rather than a strict isolation boundary. The frontend continues to use global `/owner/*` routes, relying on a fragile local storage context (`getActiveHostelId()`) to differentiate hostels, which breaks down if the user opens multiple tabs for different hostels.

## Isolation Violations
1. **Frontend Active Context:** The frontend uses `localStorage` (`ownerPreferences:<ownerId>:<hostelId>`) and `getActiveHostelId()` to track the active hostel. This pattern guarantees cross-tab leakage. If a user opens Hostel A in tab 1 and Hostel B in tab 2, actions in tab 1 will unknowingly execute against Hostel B due to local storage mutation.
2. **Dashboard Snapshots:** `OwnerDashboardSnapshot` aggregates all tenants, payments, and expenses globally per owner, violating hostel-level operational isolation.
3. **Usage & Addons:** `UsageTracking`, `AddonUsage`, and `OverflowLedger` are strictly `owner_id` scoped, lacking hostel attribution.
4. **Cache Invalidation:** Actions like rent generation globally invalidate the owner's dashboard cache (`invalidateDashboardCache(ownerId)`), destroying the cache for all hostels rather than precisely targeting the affected hostel.

## Financial Consistency Risks
1. **Owner-Scoped Reconciliation:** In `financial-service.ts`, the `reconcileSettledOperationalObligations(ownerId)` method runs its reconciliation sweeps globally for the owner. It should be scoped to the `hostel_id` to prevent cross-hostel transaction locking or interference during large concurrent operations.
2. **Nullable Financial Contexts:** Critical historical entities (`RentObligation`, `Payment`, `Receipt`) have nullable `hostel_id` fields. If an obligation is generated without a `hostel_id` (e.g., due to a bug), it falls back to global owner aggregation, leading to silent divergence between individual hostel reports and the portfolio aggregate.
3. **Anomaly Detection:** Anomalies and system events (`ZERO_RENT_GENERATED`, `LOCK_CONTENTION`) are logged at the `owner_id` level. A failure in Hostel A could theoretically silence anomaly alerts for Hostel B if they are grouped incorrectly.

## Multi-Hostel Migration Risks
1. **Frontend State Corruption:** Migrating to true multi-hostel without moving `hostelId` into the URL path (`/hostels/:hostelId`) will result in destructive operations (e.g., deleting a room in the wrong hostel).
2. **Null Backfill Drift:** If the `hostel_id` columns remain nullable, new code paths might inadvertently insert nulls, perpetuating the mixed-mode state and preventing strict schema enforcement.
3. **Concurrent Processing:** The unified lock `rent_gen_${ownerId}_${monthKey}` prevents the owner from generating rent for two different hostels simultaneously, even though they are mathematically independent.

## Required Schema Changes
1. **Make `hostel_id` Required:** Transition `hostel_id` from `String?` to `String` (non-nullable) on `RoomAllocation`, `RentObligation`, `Payment`, `Receipt`, `Expense`, and `Complaint`.
2. **Room Collision Prevention:** Add `@@unique([hostel_id, room_no])` to the `Room` model. Currently, there is no unique constraint preventing duplicate room numbers within the same hostel.
3. **Deprecate Owner Snapshots:** Phase out `OwnerDashboardSnapshot` in favor of `HostelDailySnapshot` (which already exists but needs authoritative usage).

## Required Service Refactors
1. **Strict Service Boundaries:** Update `financial-service.ts`, `dashboard-service.ts`, and `analytics-service.ts` to make `hostelId` a **required** parameter for all operational metrics (revenue, overdue, expenses).
2. **Portfolio Service:** Extract global owner aggregation logic into a dedicated `portfolio-service.ts` that specifically rolls up data from `HostelDailySnapshot` rather than querying raw transactional tables.
3. **Locking Granularity:** Change system locks (like `rent_gen_`) from `owner_id` scoped to `hostel_id` scoped to allow concurrent operations on different hostels.
4. **Reconciliation Scoping:** Refactor `reconcileSettledOperationalObligations` to require `hostelId`.

## Required Frontend Refactors
1. **URL-Driven Architecture:** Move all `/owner/*` operational routes to `/hostels/:hostelId/*` (e.g., `/hostels/:hostelId/dashboard`, `/hostels/:hostelId/rooms`).
2. **Remove LocalStorage Context:** Eliminate `getActiveHostelId()` and `legacy_storage_key` implementations. The active hostel must be derived strictly from the URL parameter `useParams().hostelId`.
3. **Portfolio Dashboard:** Introduce a new `/owner/portfolio` route for global analytics, visually distinct from operational hostel dashboards.

## Snapshot Architecture Evolution
1. **Current State:** `OwnerDashboardSnapshot` (Global, stale, single-source of bottleneck).
2. **Future State:**
   - **Hostel Snapshots:** `HostelDailySnapshot` becomes the canonical source for hostel-level historical metrics.
   - **Portfolio Snapshots:** Compute global portfolio metrics by dynamically aggregating `HostelDailySnapshot` rows for the owner, rather than maintaining a separate denormalized global snapshot table.

## Cache/Invalidation Evolution
1. **Cache Keys:** Migrate React Query and Redis cache keys from `['dashboard', ownerId]` to `['hostel', hostelId, 'dashboard']`.
2. **Precision Invalidation:** `invalidateDashboardCache` must accept `hostelId` and only flush the specific hostel's cache, preserving performance for the owner's other properties.

## Subscription/Billing Evolution
1. **Hostel Limits vs Tenant Limits:** Ensure the `Plan` model's `tenant_limit` is clearly defined as either a global portfolio limit or a per-hostel limit. Usage tracking (`UsageTracking`) should be updated to compute active tenants per hostel.
2. **Overflow Tracking:** The `OverflowLedger` is currently `owner_id` scoped. It should remain owner-scoped (since billing goes to the owner), but it must include a JSON breakdown of the overflow contribution per `hostel_id` for accurate invoicing.

## Recommended Migration Order
- **PHASE A:** Run a one-off backfill script to populate any existing `null` `hostel_id` values in `RoomAllocation`, `RentObligation`, `Payment`, `Receipt`, `Expense`, and `Complaint`.
- **PHASE B:** Alter Prisma schema to make `hostel_id` non-nullable on operational tables and add `@@unique([hostel_id, room_no])` to `Room`.
- **PHASE C:** Refactor backend services to mandate `hostelId` parameters. Drop the fallback-to-owner logic in operational methods.
- **PHASE D:** Migrate Frontend Routing to `/hostels/:hostelId/*` and strip out LocalStorage active context.
- **PHASE E:** Implement the Portfolio Dashboard (`/owner/portfolio`) backed by a new `portfolio-service.ts`.
- **PHASE F:** Update cache invalidation logic and background jobs to utilize `hostel_id` locking and invalidation.

## High-Risk Areas
- **The URL Migration (Phase D):** Shifting the frontend routing will touch nearly every component and hook in the application. This must be done meticulously to ensure deep links and redirects don't break.
- **Null Constraint Enforcement (Phase B):** If any historical data is orphaned without a valid `hostel_id` mapping (e.g., a deleted room that orphaned an allocation), the Prisma migration will fail.
- **Cross-Tab Corruption (Current):** Until the frontend routing is fixed, the system remains highly vulnerable to operational mistakes from users managing multiple hostels simultaneously.

## Performance Risks
- **Snapshot Aggregation Bottlenecks:** Moving to `HostelDailySnapshot` means portfolio metrics will require aggregating multiple rows. With appropriate indexing (`@@index([owner_id, snapshot_date])`), this is negligible, but missing indexes will cause full table scans.
- **Lock Contention:** The current `rent_gen_${owner_id}` lock creates artificial contention for multi-hostel owners. Shifting to `rent_gen_${hostel_id}` solves this.

## Recommended Immediate Actions
1. **Audit Nulls:** Run an immediate DB query to count how many operational rows (`rent_obligations`, `payments`) currently have `hostel_id IS NULL`.
2. **Frontend Routing Overhaul:** Prioritize shifting the React Router structure to `/hostels/:hostelId`. This is the single biggest architectural vulnerability affecting data integrity right now.
3. **Room Schema Patch:** Add the `UNIQUE(hostel_id, room_no)` constraint to prevent silent data collision before scaling.

## Recommended Deferred Actions
1. **Microservices/CQRS:** Avoid introducing complex event sourcing or CQRS right now. The current PostgreSQL + Prisma architecture is more than sufficient if appropriately scoped and indexed.
2. **Complex Multi-Hostel Billing Models:** Keep billing owner-centric for now. Defer complex per-hostel billing splits until the operational multi-hostel isolation is 100% stable.
