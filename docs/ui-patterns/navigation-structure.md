# Navigation Structure

## Public routes

| Route | Screen |
|---|---|
| `/` | Home |
| `/about` | About |
| `/facilities` | Facilities |
| `/rooms` | Rooms |
| `/gallery` | Gallery |
| `/location` | Location |
| `/contact` | Contact |
| `/rules` | Rules |
| `/pricing` | Pricing |
| `/legal`, `/terms`, `/privacy` | Legal |
| `/login` | Login |
| `/activate`, `/activate/:token` | Tenant activation |
| `/complete-profile` | Tenant profile completion |

**How this works:**
1. `PublicRoutes` returns public route elements.
2. These routes do not require protected wrappers.
3. Visitors can reach marketing, legal, and auth pages.

## Owner routes

| Route | Screen |
|---|---|
| `/dashboard` | Portfolio |
| `/hostels/:hostelId` | Hostel detail |
| `/hostels/:hostelId/:tab` | Hostel detail tab |
| `/tenants` | Portfolio tenant entry |
| `/hostels/:hostelId/tenants` | Hostel tenants |
| `/hostels/:hostelId/tenants/:tenantId` | Tenant profile |
| `/hostels/:hostelId/move-outs` | Move-outs |
| `/alerts` | Alerts |
| `/billing` | Billing |
| `/settings` | Settings |

**How this works:**
1. `OwnerRoutes` wraps screens in `ProtectedRoute`.
2. Allowed roles are owner and admin.
3. Hostel ID scopes workspace screens.

## Tenant routes

| Route | Screen |
|---|---|
| `/tenant/dashboard` | Tenant dashboard |
| `/tenant/financials` | Tenant financials |
| `/tenant/payments` | Tenant payments |
| `/tenant/room` | Tenant room |
| `/tenant/profile` | Tenant profile |
| `/tenant/move-out` | Tenant move-out |
| `/payment-return` | Payment return |

**How this works:**
1. `TenantRoutes` wraps tenant screens in `ProtectedTenantRoute`.
2. `TenantPortalLayout` supplies tenant navigation.
3. Tenant pages call `/tenants/me/*` endpoints.

## Admin routes

`frontend-v2` currently returns an empty admin route fragment.
Backend admin pages exist under `backend-next/app/(dashboard)/admin`.

**How this works:**
1. Frontend v2 does not expose admin screens.
2. Next.js backend app includes admin finance pages.
3. A rebuild must choose one admin UI location.

> **Needs clarification:** Admin navigation is split between `frontend-v2` and `backend-next`. Confirm final admin app ownership before client rebuild.

