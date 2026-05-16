# HMS Refactoring Roadmap

This roadmap defines the execution phases to migrate the HMS codebase to a clean, scalable, contributor-friendly architecture while strictly preserving existing functionality.

## Phase 1: Audit & Foundation (Current Phase)
- [x] Run deep repository audit.
- [x] Map architecture and identify bottlenecks.
- [x] Generate `ARCHITECTURE_AUDIT.md` and `CLEANUP_PLAN.md`.
- [ ] Execute `CLEANUP_PLAN.md` (remove dead dependencies, scratch files).
- [ ] Configure Path Aliases (`@/`) in frontend and backend.

## Phase 2: Backend Structural Reorganization (The `src/` Migration)
*Goal: Establish boundaries without rewriting business logic.*
- [ ] Create target directories: `backend-next/src/services`, `src/repositories`, `src/validators`, `src/lib`, `src/config`.
- [ ] Move `lib/validators` -> `src/validators`.
- [ ] Move `lib/utils` -> `src/utils`.
- [ ] Move `lib/auth`, `lib/payments`, `lib/pdf` -> `src/lib/`.
- [ ] Move the 78 files in `lib/services/` -> `src/services/`, logically grouped into domain subfolders (e.g., `auth/`, `billing/`, `tenants/`).
- [ ] Update all broken imports in `app/api/` to point to the new `src/` locations.
- [ ] Verify backend compilation (`npm run build`).

## Phase 3: Frontend Feature Slicing
*Goal: Decouple the monolithic `api/services.js` and pages.*
- [ ] Set up `frontend/src/features/` folder structure.
- [ ] Split `api/services.js` into domain-specific API files (e.g., `features/auth/api.js`, `features/tenants/api.js`).
- [ ] Extract oversized UI components from `ManageRooms.jsx` and `ManageTenants.jsx` into smaller, reusable feature components.
- [ ] Update imports to use the `@/features/...` aliases.
- [ ] Verify frontend build (`npm run build`).

## Phase 4: Backend Repository Pattern Extraction
*Goal: Isolate Prisma ORM calls from Services to make the app easily testable.*
- [ ] Create `backend-next/src/repositories/[domain]-repository.ts`.
- [ ] Refactor `tenant-service.ts` to use `TenantRepository` instead of raw Prisma calls.
- [ ] Refactor `room-allocation-service.ts` to use `RoomRepository`.
- [ ] (Incremental) Apply pattern to the massive `payment-service.ts`.
- [ ] Verify functionality via automated tests / build.

## Phase 5: Documentation & Final Polish
- [ ] Rewrite `README.md` to reflect the new architecture and provide clear setup instructions.
- [ ] Create `docs/CONTRIBUTING.md` outlining the Controller -> Service -> Repository pattern for future developers.
- [ ] Run comprehensive `lint` and `typecheck` across both repositories.
