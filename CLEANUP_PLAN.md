# HMS Cleanup Plan

This document outlines the exact files to be removed, code to be pruned, and dependencies to be uninstalled to safely reduce the footprint of the HMS codebase before structural refactoring begins.

## 1. Unused Dependencies to Remove
**Frontend (`frontend/package.json`):**
* `npm uninstall @fontsource-variable/geist lodash.debounce tw-animate-css`

**Backend (`backend-next/package.json`):**
* `npm uninstall @vercel/speed-insights pino pino-pretty`
* `npm uninstall -D @types/pino`

## 2. Legacy & Temporary Files to Delete
The root directory of `backend-next` contains numerous ad-hoc test scripts that should be moved to a `.gitignored` scratch folder or deleted:
* `backend-next/check_db.js`
* `backend-next/test-db.js`
* `backend-next/test-live-metrics.js`
* `backend-next/test-login.js`
* `backend-next/test-schema.js`
* `backend-next/test_auth_simple.js`
* `backend-next/test_auth_v2.js`
* `backend-next/test_db_direct.js`
* `backend-next/test_registration.ts`
* `backend-next/scratch/` (entire directory contents)

## 3. High-Risk / High-Impact Refactoring Targets
The following files require careful extraction due to their massive size and mixed concerns. They will NOT be deleted, but they will be heavily pruned and split.

**Target 1: `frontend/src/api/services.js` (856 lines)**
* **Plan:** Split into domain-specific API clients inside `frontend/src/features/[domain]/api.js`.
* **Risk:** High. Every frontend component imports from this file. Alias mapping must be set up first.

**Target 2: `backend-next/lib/services/payment-service.ts` (3,219 lines)**
* **Plan:** Isolate webhook verification into `src/lib/payments/webhooks.ts`. Isolate receipt generation into `src/services/receipt-service.ts`. Isolate DB logic into `src/repositories/payment-repository.ts`.
* **Risk:** Extremely High. Handles live money. Requires running automated tests before and after extraction.

**Target 3: `frontend/src/pages/owner/ManageRooms.jsx` (928 lines)**
* **Plan:** Extract the Add Room Modal, Edit Room Modal, and Room Table into separate components under `src/features/rooms/components/`.

## 4. Execution Order for Safe Cleanup
1. **Dependency Pruning:** Run uninstalls and verify the build passes.
2. **Scratch File Deletion:** Delete root-level test scripts.
3. **Alias Configuration:** Setup `tsconfig.json` and `vite.config.js` to support `@/` paths before moving files.
4. **Incremental Extraction:** Move logic without changing variable names or types to ensure immediate TypeScript compatibility.
