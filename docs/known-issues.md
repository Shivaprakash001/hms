# Known Issues

## Canonical UI ambiguity

`frontend-v2/` is documented as canonical by request.
`README.md` previously described `frontend/` as active UI.

**How this works:**
1. Two UI trees contain overlapping behavior.
2. Deployment may still point at the older UI.
3. A rebuild must choose one UI before launch.

## Hardcoded production API URL

`frontend-v2/src/lib/api-client.ts` uses `https://api.sriadithyahostels.in/api` for non-local hosts.

**How this works:**
1. Localhost uses `/api`.
2. Non-local browser hosts ignore environment API config.
3. New clients must replace or parameterize this URL.

## Hardcoded brand and legal content

Sri Adithya names, domains, emails, legal text, and receipt text appear across frontend and backend files.

**How this works:**
1. Public pages set SEO and legal identity.
2. App screens repeat brand names in navigation and payment copy.
3. Receipts and emails repeat brand trust text.

## Stale environment validation

`scripts/validate_env.sh` references Razorpay and SMTP variables.
Current code uses PhonePe and Resend in key paths.

**How this works:**
1. The script may fail for a correctly configured current stack.
2. It may pass variables no longer used.
3. Update it before relying on it for production readiness.

## String statuses

Many database statuses are plain strings instead of Prisma enums.

**How this works:**
1. Services can write inconsistent status spelling.
2. UI badges may miss unknown values.
3. A rebuild should centralize high-risk statuses.

## Split service directories

Backend services exist in both `backend-next/lib/services` and `backend-next/src/services`.

**How this works:**
1. Older and newer domain code live side by side.
2. Route handlers may import either tree.
3. Refactoring needs import tracing before deletion.

## Some v2 services reference unconfirmed endpoints

Examples include selected document nested routes, payment export, payment waive, and bulk generation.

**How this works:**
1. Service wrappers can outpace backend route implementation.
2. UI code may compile while runtime calls fail.
3. Endpoint verification is required before production handoff.

