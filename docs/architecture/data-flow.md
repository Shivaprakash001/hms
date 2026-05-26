# Data Flow

## Standard owner read flow

| Step | Code | What happens |
|---|---|---|
| 1 | `OwnerRoutes` | Protects owner pages with allowed roles. |
| 2 | View component | Calls `useQuery` with a stable query key. |
| 3 | Feature service | Calls an API endpoint through Axios. |
| 4 | Next route | Reads auth and request parameters. |
| 5 | Backend service | Fetches data with Prisma. |
| 6 | UI | Renders cards, tables, charts, or empty states. |

**How this works:**
1. The route decides the visible screen.
2. TanStack Query loads data and stores it under a query key.
3. The user sees cached data while refreshes happen in the background.

## Progressive route loading flow

| Step | Code | What happens |
|---|---|---|
| 1 | `RootProviders` | Mounts only the browser router. |
| 2 | `PublicRoutes` | Lazy-loads public pages without auth providers. |
| 3 | `AuthRouteShell` | Loads auth providers only for login and activation. |
| 4 | `OwnerProviderShell` | Loads protected owner providers only for owner routes. |
| 5 | `TenantProviderShell` | Loads protected tenant providers only for tenant routes. |

Why this exists: mobile users should not download dashboard providers while viewing public pages.

**How this works:**
1. The root route tree imports only lightweight route declarations.
2. Shell components load through Suspense when a route branch matches.
3. Public pages avoid owner, tenant, auth, and chart startup cost.

## Progressive dashboard loading flow

| Stage | Code | User-visible result |
|---|---|---|
| 1 | Dashboard route component | Page shell, title, KPIs, and primary actions appear first. |
| 2 | React Query critical queries | Tables and recent activity render after core data arrives. |
| 3 | Lazy analytics modules | Charts and deep analytics load after the main screen. |

Why this exists: low-end mobile devices need useful content before charts and reports execute.

**How this works:**
1. Owner billing analytics defer `cashflow` and `funnel` queries until analytics are visible.
2. Recharts components live in async chunks instead of the main route bundle.
3. Tenant dashboard secondary queries wait until critical dues, payments, profile, and room data load.

## Virtualized list flow

| Surface | Code | What stays mounted |
|---|---|---|
| Payment ledger | `PaymentLedger` | Visible payment rows plus overscan |
| Tenant table | `TenantTable` | Visible desktop tenant rows plus overscan |
| Rent obligations | `RentObligationList` | Visible month headers and obligations |
| Expense ledger | `ExpensesTab` | Visible expense cards plus overscan |

Why this exists: large hostel ledgers must scroll smoothly on low-end mobile and desktop devices.

**How this works:**
1. TanStack Virtual calculates which rows intersect the scroll viewport.
2. The list keeps total scroll height with a spacer container.
3. Only visible rows render, so DOM size stays stable as data grows.

## Owner dashboard first paint flow

| Step | Code | Purpose |
|---|---|---|
| 1 | `PortfolioView` shell | Paints a stable greeting area immediately. |
| 2 | Matched skeleton | Reserves the above-fold card stack while data loads. |
| 3 | `portfolioService.getShell` | Fills risk, KPI, digest, and attention sections. |
| 4 | Lazy extras | Loads chart and modal code only after user intent. |

Why this exists: the dashboard greeting is the mobile LCP element, and top-card movement affects CLS.

**How this works:**
1. Header text uses a fixed minimum height.
2. The shell endpoint returns portfolio stats and a small overdue preview.
3. Redis can serve the shaped shell response for a short TTL.
4. The screen avoids a second full dues request on first paint.
5. Search filtering uses deferred input so typing does not block rendering.

## Redis read cache flow

| Step | Code | What happens |
|---|---|---|
| 1 | Route auth and scoping | Verifies session and ownership before cache access. |
| 2 | Redis cache helper | Reads a short-lived shaped response by key. |
| 3 | Backend service | Runs only on cache miss or Redis outage. |
| 4 | Cache tags | Store owner, hostel, or tenant invalidation membership. |

Why this exists: mobile users revisit dashboard views often, and repeated aggregates should not hit Postgres every time.

**How this works:**
1. Authorization still uses PostgreSQL-backed logic.
2. Redis caches only safe read responses.
3. Mutations delete tagged keys and TTLs provide a fallback.

## Portfolio shell endpoint flow

| Step | Code | What happens |
|---|---|---|
| 1 | `/api/dashboard/portfolio-shell` | Authenticates the owner session. |
| 2 | `portfolioPerformanceService` | Loads portfolio stats, trends, and rankings. |
| 3 | Raw overdue preview query | Selects only four overdue obligations for the focus hostel. |
| 4 | Database indexes | Use owner, hostel, status, due date, and obligation lookup paths. |
| 5 | `PortfolioView` | Renders collection risk without calling the full dues endpoint. |

Why this exists: mobile dashboards should not download every obligation to render four attention rows.

**How this works:**
1. The frontend sends one dashboard shell request.
2. The backend shapes a first-paint payload for the owner home screen.
3. The preview query reads only the fields needed above the fold.
4. Billing and alerts still use the full dues endpoint when users open those workflows.

## Hostel detail tab flow

| Step | Code | What happens |
|---|---|---|
| 1 | `HostelDetailView` | Reads `hostelId` and optional tab from the route. |
| 2 | Shell query | Loads the owner hostel list for the header title. |
| 3 | Tab router | Normalizes invalid tabs back to overview. |
| 4 | Lazy tab | Downloads only the active tab island. |
| 5 | Tab query | Fetches only data required by that tab. |

Why this exists: rooms, tenants, expenses, move-outs, and billing should not execute together on mobile.

**How this works:**
1. `/hostels/:hostelId` loads the shell and overview island.
2. `/hostels/:hostelId/:tab` loads the matching tab island.
3. Query invalidation remains scoped to existing query keys.

## Standard mutation flow

| Step | Example | What happens |
|---|---|---|
| 1 | Invite tenant | Modal submits form data. |
| 2 | `tenantService.invite` | Sends `POST /owners/invitations`. |
| 3 | Backend invitation service | Creates profile, tenant, allocation, and obligations. |
| 4 | Query invalidation | Invalidates tenants, rooms, dashboard, and portfolio keys. |
| 5 | UI update | Lists and stats refresh. |

**How this works:**
1. The component calls `useMutation`.
2. The backend writes all related records in a transaction when possible.
3. Cache invalidation refreshes the visible screen.

## Auth flow

| Part | Source | Purpose |
|---|---|---|
| Login | `/auth/login` | Returns access token and sets refresh cookie. |
| Current user | `/auth/me` | Restores user session on load. |
| Refresh | `/auth/refresh` | Rotates access token after 401. |
| Logout | `/auth/logout` | Clears server and client session state. |

**How this works:**
1. `AuthProvider` reads `ownerUser` or `tenantUser` from local storage during initialization.
2. Protected shells can paint immediately with the stored user.
3. `/auth/me` validates the token in the background.
4. Axios attaches the access token from `ownerUser` or `tenantUser`.
5. A 401 response triggers a refresh request.
6. Refresh failure clears local storage and redirects to `/login`.

## Frontend render performance flow

| Boundary | Source | Purpose |
|---|---|---|
| Auth bootstrap | `frontend-v2/src/context/AuthContext.tsx` | Paints protected shells before background validation completes. |
| Public hero | `frontend-v2/src/app/pages/public/HomePage.tsx` | Keeps LCP text outside reveal animation. |
| Tenant chart | `frontend-v2/src/app/components/views/tenants/AcademicMixChart.tsx` | Moves Recharts work into an idle async chunk. |
| Mobile tenants | `frontend-v2/src/features/tenants/components/list/TenantCardMobile.tsx` | Renders only the visible tenant card window. |
| Tenant dashboard | `frontend-v2/src/portal/pages/TenantDashboardPage.tsx` | Paints header and dues area before secondary widgets. |
| Expenses tab | `frontend-v2/src/app/components/hostel-detail/tabs/ExpensesTab.tsx` | Renders ledger before idle intelligence panels. |

Why this exists: after backend caching, mobile paint delay comes mostly from React mount and main-thread work.

**How this works:**
1. First-viewport content avoids animation and full-screen auth gates.
2. Heavy widgets mount through idle or lazy boundaries.
3. Long lists render a small visible window instead of every card.

## Payment flow

| Step | Source | Purpose |
|---|---|---|
| Read dues | `paymentService.getAllDues` | Shows outstanding obligations. |
| Create intent | `paymentService.createIntent` | Starts a PhonePe payment attempt. |
| Provider redirect | PhonePe | Sends tenant to hosted checkout. |
| Return page | `TenantPaymentReturnPage` | Polls or verifies the attempt. |
| Webhook | `/api/webhooks/payments/phonepe` | Records provider status. |
| Receipt | `/payments/:id/receipt` | Downloads generated PDF. |

**How this works:**
1. Rent obligations define what can be paid.
2. Payment attempts track checkout state.
3. Successful payments allocate money back to obligations.

## Tenant activation flow

| Step | Source | Purpose |
|---|---|---|
| Context | `/tenants/activate/context` | Loads invitation, room, rules, and defaults. |
| Account step | Activation page | Captures password and phone data. |
| Rules step | Activation page | Captures required acknowledgements. |
| Profile step | Activation page | Captures profile and photo data. |
| Activate step | `/tenants/activate` | Marks tenant active. |

**How this works:**
1. The token resolves an invited tenant.
2. Each step persists progress.
3. The final step activates the account and portal access.
