# AUTH_SYSTEM.md

> Real auth architecture mapped from `auth-service.ts` and `middleware.ts`.

---

## 1. Identity Source of Truth
**FACT:** The platform uses Supabase Auth strictly for password hashing and email verification logic during registration (`supabase.auth.admin.createUser`). 
**HOWEVER**, the application's true source of identity and authorization is the local Postgres `profiles` table. If Supabase is misconfigured, registration falls back to a locally generated UUID.

## 2. Token Flow
- **Login**: Verifies password against local `password_hash` (or handles legacy plain-text migrations).
- **Access Token**: A short-lived (1 hour) JWT signed via `jose` with `HS256`. 
- **Refresh Token**: A long-lived (30 days) cryptographically random string, hashed and stored in `token_blacklist`/`refresh_tokens`. Stored in an `httpOnly` cookie (`hms_refresh_token`).

## 3. Middleware Validation
**FACT:** All `/api/*` routes are intercepted by Next.js Edge Middleware.
- It parses the JWT from the `Authorization: Bearer` header, the `hms_session` cookie, or the `?token=` query param.
- Verifies the signature.
- Injects `x-user-id`, `x-user-role`, `x-owner-id` headers for downstream Route Handlers.

## 4. Threat Model & Weak Points
- **Session Revocation**: A `TokenBlacklist` table exists and is populated on logout.
- **Refresh Reuse Detection**: Rotating refresh tokens emit an epoch marker; if an old token is reused, the service deletes *all* sessions for that user to mitigate token theft.
- **SSE Auth Leakage**: SSE requires sending the token in a URL query param (`?token=`). To mitigate URL logging risks, the system uses `/api/events-token` to issue a disposable, 60-second JWT specifically for the EventSource connection.

## 5. Security Boundaries
- **Owner Scope**: `resolveOwnerScope` heavily validates that users only access resources where `owner_id` matches their decoded JWT.
- **Tenant Scope**: Tenants are restricted to reading their own `tenant_id` metrics and profiles.
