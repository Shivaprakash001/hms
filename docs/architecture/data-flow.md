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
1. Axios attaches the access token from `ownerUser` or `tenantUser`.
2. A 401 response triggers a refresh request.
3. Refresh failure clears local storage and redirects to `/login`.

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
