---
tags: [frontend]
---

# Frontend — `frontend-v2/`

Related: [[Architecture]] · [[APIs]] · [[Features]]

Canonical UI: Vite + React 19 SPA. This page reflects a direct read of `frontend-v2/src/` — routing, folder purposes, and the current migration-in-progress from `features/` to `domains/`.

## Top-level `src/` structure

| Folder | Purpose (evidence-based) |
|---|---|
| `app/` | Router entry, **owner-facing screens** (`app/components/views/*` — see below), public marketing pages, auth pages, provider composition. Effectively the "legacy owner app" root. |
| `platforms/` | Role-specific route trees per its own `README.md`: `owner/`, `tenant/`, `admin/` (reserved, no-op), `warden/` (reserved, empty). **Contributes only routing/shell wiring, not screens** — see below. |
| `features/` | Per-feature API wrappers — the *only* layer allowed to know endpoint shapes (enforced by `check-architecture.mjs`). Still the live data-access layer for most of the app. |
| `domains/` | Stated target home for new business logic per its own `README.md`. **Currently mostly a thin re-export shim over `features/*`**, migration in progress — see below. |
| `portal/` | **Frozen legacy tenant portal.** Allowlisted file-by-file in `scripts/check-architecture.mjs`. New tenant-portal pages go in `platforms/tenant` or `domains`, not here. |
| `shared/` | Framework-agnostic primitives (`ui/` design-system components, `types/`, `performance/`). Enforced to never import from `app/platforms/portal/features/domains/services`. |
| `context/` | `AuthContext.tsx` (456 lines) — the session/auth React context. |
| `lib/` | `api-client.ts` (axios instance), `queryKeys.ts` (centralized React Query key factory), `queryClient.ts`, `errors.ts`, `toast.ts`, `sanity/` (CMS client). |
| `infrastructure/` | Lower-level adapters: `api/client.ts`, `query/client.ts`; `auth/`/`storage/` reserved, currently empty. |
| `components/` | Two **overlapping** marketing component sets: `landing-v2/` and `marketing/` (similar names — Hero, Footer, Navbar). Which is actually live in `HomePage` was **not traced — Unknown**. |
| `services/` | Single `services/index.ts` barrel re-exporting all `features/*/api` — possibly a legacy central import point; whether it's still consumed anywhere is **Unknown**. |
| `styles/` | Global CSS (`globals.css`, `tailwind.css`, `theme.css`, `fonts.css`). |

## Router / route tree

Entry: `app/Router.tsx` → `app/router/AppRouter.tsx`, composing four route-group functions:

**Public routes** (two lazy shells): `PublicShell` — `/`, `/about`, `/facilities`, `/rooms`, `/gallery`, `/location`, `/contact`, `/rules`, `/legal/*`, `/pricing`, `/visit/:hostelSlug`, `/verify/r/:token`. `AuthShell` — `/login`, `/forgot-password`, `/reset-password`, `/activate(/:token)`, `/invite/:token`, `/complete-profile`.

**Owner routes** (`platforms/owner/router/OwnerRoutes.tsx`, wrapped in `OwnerBoundary` → `OwnerProviderShell` → `App`): `/dashboard`, `/hostels/:hostelId(/:tab)`, `/tenants`, `/tenants/import`, `/hostels/:hostelId/tenants/:tenantId`, `/move-outs`, `/agreements/renewals`, `/agreements/lifecycle-recovery`, `/alerts`, `/billing`, `/settings`, `/activity`. All view components lazy-imported from `app/components/views/*`.

**Tenant routes** (`platforms/tenant/router/TenantRoutes.tsx`, wrapped in `TenantProviderShell`): `/payment-return`, then inside `TenantPortalLayout` — `/tenant/{dashboard,financials,payments,room,profile,move-out}`. **The actual page components for all of these still live in the frozen `src/portal/pages/*` tree** — the new `platforms/tenant/router` only owns the route wiring, not the page bodies.

**Admin routes**: `platforms/admin/router/AdminRoutes.tsx` is currently a no-op (`return <Fragment />`). **`platforms/warden/`** is reserved, `.gitkeep` only — no code.

## `src/features/*` — the live API-wrapper layer

| Feature | Has `api/`? | Notes |
|---|---|---|
| `tenants` | Yes | By far the largest module — ~35 component files (list/detail/financial/moveout), hooks, store, utils. Owner-side tenant management. |
| `change-management` | Yes | Most fully-built feature: dedicated hooks (`useChangeRequests`, `useApproveChangeRequest`, etc.), components (ChangePreview, ChangeRequestDrawer, ChangeTimeline). Backs the tenant profile change-approval workflow. |
| `payments` | Yes | `paymentService`, `rentService`. |
| `tenant-portal` | Yes | Separate from `features/tenants` (owner-side) — tenant-portal-specific API + `useTenantDashboard.ts`, which defines its **own parallel `tenantQueryKeys`** rather than using the centralized `lib/queryKeys.ts`. Intentional split or drift — **Unknown**. |
| `agreements`, `auth`, `dashboard`, `expenses`, `move-out`, `notifications`, `owners`, `reports`, `rooms` | Yes | Thin per-domain API wrappers, mostly `.js` files. |
| `admissions` | Yes | Plus a visitor-facing component (`components/visitor/`). |
| `activity` | Yes | Activity/audit log listing. |
| `settings` | **No** `api/` folder — only `settingsHooks.ts`. Where its data access goes through was not traced — **Unknown**. |
| `recovery` | Yes | Thin wrapper (`recoveryService.createCase/validate/execute/getById`) over the Business Recovery Platform's `/api/recovery/cases/*` routes. No components of its own — consumed by `app/components/modals/CorrectPaymentModal.tsx` (Reverse + Transfer correction flow wired into `TenantProfilePage`'s Financial Activity feed; Transfer mode also uses `features/payments/api`'s `paymentService.quickCollectSearch` for the destination-tenant picker). See [[Features]] (Correct Payment (Reverse / Transfer)). |

All `features/*/api` files are enforced (`check-architecture.mjs`) to never call raw `fetch()`/`axios` directly — only through `@lib/api-client`.

## `src/platforms/owner` and `src/platforms/tenant` — routing only, not screens

`platforms/owner/` contains **no page components**, only `router/OwnerRoutes.tsx` and `router/OwnerProviderShell.tsx`. Real owner screens live under `app/components/views/*`: `PortfolioView`, `HostelsView`, `TenantsPortfolioView`, `TenantProfileRoute`, `BulkInvitationImportView`, `MoveOutsView`, `RenewalQueueView`, `AlertsView`, `BillingView`, `SettingsView`, `ActivityLogsView`, `AdmissionsView`, `HostelActivityCenterView`, plus a `billing/` sub-tree of dashboard widgets (`FinancialControlCenter`, `CashflowCharts`, `CollectionPipeline`, `OverdueIntelligence`, `PaymentLedger`, `RiskZone`, `RoomPerformance`, `SmartFilters`, etc. — ~20 components).

Within `BillingView`'s `Expenses Workspace` tab, `app/components/hostel-detail/tabs/ExpensesTab.tsx` is a thin orchestrator (data fetching/mutations + filter state + row-selection state) composing a dedicated component set under `hostel-detail/tabs/expenses/`: `ExpenseDashboard`, `ExpenseFilterBar` (accepts a `trailingActions` slot, currently used for `ExpenseExportMenu`), `ExpenseList`/`ExpenseCard` (rows are selectable via a checkbox; selection state lives in `ExpensesTab`), `ExpenseExportMenu` (CSV/Excel/PDF format + Current View/All Matching/Selected scope picker → `expenseService.export()` → `GET /api/expenses/export`, see [[APIs]] and [[Decisions]] ADR-009), `ExpenseDetailsModal`, `AddExpenseModal`, `CategoryPicker`, `ReceiptPreview`, `ExpenseCategoryBreakdown`, `ExpenseVendors`, `ExpenseInsightsPanel`. Category constants/icon-tone maps/suggestion heuristics live in `features/expenses/constants.ts` (single source, previously duplicated 5×). This tab's `AddExpenseModal` is also reused by `FinancialControlCenter.tsx` (Overview tab quick-add) and the global `OwnerQuickActions.tsx` FAB — same external prop contract (`categories`, `loading`, `mode`, `initialExpense`, `onClose`, `onSubmit`) across all three call sites.

`app/components/ui/responsive-dialog.tsx` (`ResponsiveDialog`/`ResponsiveDialogContent`/`Header`/`Title`/`Description`/`Body`/`Footer`) is a shared primitive that renders a wide desktop shadcn `Dialog` or a mobile bottom-sheet shadcn `Drawer` from one JSX tree, switching on the pre-existing (previously-unused) `useIsMobile()` hook — introduced for the Expenses redesign but intended as the general pattern for any future modal needing this split, replacing hand-rolled `sm:` breakpoint classes per modal.

Same pattern for `platforms/tenant/` — routing/shell only (`components/OnboardingProgressTracker.tsx`, `components/TenantReservationCard.tsx` are the only real components there); actual pages are in `src/portal/pages/*`.

## `src/portal/` — frozen legacy tenant portal

Per its own `README.md`: *"intentionally frozen... existing tenant screens continue to run from here while route ownership moves to `src/platforms/tenant/router`. Do not add new tenant pages or business logic in `src/portal`."*

Current, exact allowlist enforced by `scripts/check-architecture.mjs` (`legacyPortalAllowlist`) — any file under `src/portal` not on this list fails the build:
```
src/portal/README.md
src/portal/TenantPortalLayout.tsx
src/portal/components/{QrCodeImage,TenantActionCenter,TenantAnnouncements,TenantDocumentStatus,TenantPaymentModal,TenantPriorityStrip,TenantScorePanel}.tsx
src/portal/components/profile/ProfileSection.tsx
src/portal/pages/{ActivateAccountPage,CompleteProfilePage,TenantDashboardPage,TenantFinancialsPage,TenantMoveOutPage,TenantPaymentReturnPage,TenantPaymentsPage,TenantProfilePortalPage,TenantRoomPage}.tsx
src/portal/utils/payableObligations.ts
```
Every file currently on disk under `src/portal/` is on this allowlist (confirmed). The script also forbids raw `fetch()`/`axios` in non-allowlisted portal files.

## `src/domains/` — migration-in-progress scaffold

Per its `README.md`: *"the old `src/features/*` folders remain as compatibility providers during the migration."* Actual state:

| Domain | Contents |
|---|---|
| `analytics`, `auth`, `complaints`, `moveout` | Empty placeholder (`index.ts` with `export {};`) |
| `hostels`, `notifications`, `rooms`, `tenants` | Thin re-export shims over the corresponding `features/*/api` |
| `payments` | **The one domain with genuinely new code**: `api/verify.ts` (`verifyReceipt(token)`, not a re-export), plus real components `ReceiptGenerationModal.tsx` and `TenantPaymentDetailModal.tsx` |

**Practical implication for new work**: `domains/*` is not yet a real replacement for `features/*` except in `domains/payments`. New tenant-portal or business logic should still generally go through `features/*` today unless a `domains/*` wrapper already exists for what you need — check before assuming `domains/` is ready.

## `src/lib/queryKeys.ts` and `src/lib/api-client.ts`

- **`queryKeys.ts`**: single `queryKeys` object, namespaced (`me`, `owner.*`, `notifications`, `portfolio.*`, `dashboard.*`, `tenants.*`, `moveOut.*`, `rooms.*`, `payments.*`, `expenses.*`, `activity.*`, `admissions.*`). Guards against a missing `hostelId` by returning a `['__noop__', ...]` key rather than a real cache key.
- **`api-client.ts`**: resolves `baseURL` to `/api` in local dev, else `VITE_API_URL` or a hardcoded production fallback. Default export `api` (credentials included, CSRF header attached from an `hms_csrf` cookie, bootstrapped via `/auth/csrf`); `publicApi` (no credentials, for public endpoints like receipt verification). Response interceptor: on 401, attempts one silent refresh (`POST /auth/refresh`) and retries once; on refresh failure, clears in-memory token, removes `ownerUser`/`localStorage`, dispatches `window` `CustomEvent('hms:session-expired')` with a reason (`inactive`/`max_age`/`reuse`/`expired`).

## Commands

```bash
cd frontend-v2
npm install
npm run dev                  # Vite dev server
npm run build                # runs check:architecture, then vite build, then branding check
npm run check:architecture   # scripts/check-architecture.mjs, standalone
```

No test suite in `frontend-v2/` currently.

## Enforced architectural boundaries

`scripts/check-architecture.mjs` fails the build if: raw `fetch()`/`axios` is used outside `@lib/api-client` in `app/`, `platforms/`, `shared/ui`, `features/`, `portal/`, or `context/`; `src/portal` gains a file outside its allowlist (above); `src/shared` imports from `app|platforms|portal|features|domains|services`.

## Open items / Unknown

- Which of `components/landing-v2/*` vs `components/marketing/*` is actually wired into live public routes.
- Where `features/settings/settingsHooks.ts` gets its data (no `api/` folder found for it).
- Whether `src/services/index.ts` (the root barrel) is still consumed anywhere.
- Whether the tenant-portal's separate `tenantQueryKeys` (in `useTenantDashboard.ts`) vs. the centralized `lib/queryKeys.ts` is intentional or drift.

## See also
- [[APIs]] for the endpoint shapes feature wrappers call
- [[Features]] for what's built on top of this structure
- [[Architecture]] for the full request-flow picture
