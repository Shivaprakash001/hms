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

