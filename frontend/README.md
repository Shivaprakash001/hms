# HMS Frontend

Vite + React 19 single-page app for the Hostel Management System. Owner and
tenant dashboards share a single bundle.

## Stack

- **React 19** + **React Router 7** (`src/App.jsx`)
- **Vite 7** build tool (`vite.config.js`)
- **TailwindCSS 4** with shadcn-style primitives in `src/components/ui/`
- **@tanstack/react-query 5** for server state
- **axios** for HTTP (`src/api/axios.js`, `src/api/services.js`)
- **framer-motion**, **recharts**, **lucide-react**, **react-hot-toast** for UX
- **@react-oauth/google** for Google sign-in

## Route map (from `src/App.jsx`)

Public:
- `/`, `/login`, `/register`, `/activate`, `/complete-profile`, `/callback`,
  `/payment-return`

Protected — owner (`components/ProtectedOwnerRoute.jsx`):
- `/owner/dashboard`, `/owner/tenants[/:id]`, `/owner/rooms`, `/owner/payments`,
  `/owner/complaints`, `/owner/expenses`, `/owner/activities`, `/owner/billing`,
  `/owner/profile`

Protected — tenant (`components/ProtectedTenantRoute.jsx`):
- `/tenant/dashboard`, `/tenant/payments`, `/tenant/payment-return`,
  `/tenant/complaints`, `/tenant/profile`, `/tenant/settings`

## API base URL

Defined in `src/api/axios.js`:

```js
const PRODUCTION_API_URL = 'https://api.sriadithyahostels.in/api';
// In non-localhost hosts, VITE_API_URL is ignored — see ../docs/TASKS.md:T-009
```

Tokens are stored in `localStorage` under `ownerUser` / `tenantUser` and sent
as `Authorization: Bearer`; `withCredentials: true` is also set so the
`hms_session` HTTP-only cookie is included. See `../docs/TASKS.md:T-010`.

## Scripts

```bash
npm install
npm run dev       # Vite dev server :5173
npm run build     # Production build → dist/
npm run preview   # Serve dist/
npm run lint      # ESLint 9 flat config
npm test          # Vitest
npm run coverage  # Vitest with v8 coverage
```

## Environment variables

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend base URL (localhost only — ignored in prod) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client id |
| `VITE_GOOGLE_REDIRECT_URI` | Google OAuth redirect URI |
| `VITE_RAZORPAY_KEY_ID` | Referenced in `.env.example`; no Razorpay code path was found in the current codebase (PhonePe is the only integrated provider). |

## Tests

Vitest config in `vitest.config.js`, setup in `tests/setup.js`. Coverage via
`@vitest/coverage-v8`.

## Deployment

`vercel.json` exists in this directory; deployed to Vercel separately from the
Next.js API.
