# API Modularization Migration Notes (Phase 2A)

## Overview
We have successfully initiated the modularization of the monolithic `frontend/src/api/services.js`. The strategy focuses on domain-driven extraction while preserving backward compatibility via adapter exports.

## Core Extractions Completed
The `api.js` client and interceptor logic has been safely duplicated to `@lib/api-client.js`. Future feature modules will use this new client to guarantee structural independence.

### 1. Auth Domain (`@features/auth/api`)
Migrated functions:
- `login`
- `getCurrentUser`
- `register`
- `changePassword`

### 2. Dashboard Domain (`@features/dashboard/api`)
Migrated functions:
- `getUnified`
- `getSummary` (Dashboard)
- `getStats`
- `getMonthlyStats`
- `getSummary` (Portfolio)

### 3. Tenants Domain (`@features/tenants/api`)
Migrated functions:
- `getAll`, `getById`, `getOwnerTenantOverview`, `getByProfileId`
- `getMyProfile`, `updateMyProfile`, `completeMyProfile`
- `getMyDocuments`, `getMyPaymentHistory`, `getMyRoom`, `getMyOnboardingSettings`, `getMyScore`
- `create`, `update`, `delete`, `reactivate`
- `requestReactivation`, `getReactivationRequests`, `decideReactivationRequest`
- `invite`, `resendInvitation`, `cancelInvitation`

## Remaining Monolith Services (`services.js` - ~707 lines left)
The following services are still housed within the monolith and are prime candidates for the next extraction batch:
- `profileService`
- `ownerService`
- `hostelService`
- `expenseService`
- `maintenanceService`
- `feedbackService`
- `fileUploadService`
- `webhookService`
- `reminderService`
- `legalDocumentService`
- `paymentService`
- `roomService`
- `rentService`
- `allocationService`
- `activityService`

## Repeated Logic Candidates for Centralization
During the extraction, the following repeated logic patterns were identified:
1. **Error Fallbacks:** The `completeMyProfile` method in `tenantService` catches `404` errors and falls back to a legacy `/profiles/complete` route. This kind of routing shim should be moved to a centralized API error interceptor or handled transparently by the backend router.
2. **Local Storage Fetching:** Several remaining methods (like `ownerService.getProfile`) manually parse `localStorage.getItem('ownerUser')` upon network failure. This should be abstracted into an `@hooks/useAuth` state rather than polluting API boundaries.
3. **FormData Marshalling:** Repeating `new FormData()` loops across different file upload methods. We should create a shared utility `jsonToFormData()` in `@utils/format.js`.
