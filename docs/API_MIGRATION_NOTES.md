# API Modularization Migration Notes (Phase 2A)

## Overview
We have successfully initiated the modularization of the monolithic `frontend/src/api/services.js`. The strategy focuses on domain-driven extraction while preserving backward compatibility via adapter exports.

**Phase 2A Status:** Completed
**Phase 2B Status:** Completed
**Phase 2C Status:** Completed (Monolith fully decommissioned into an adapter)

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

### 4. Rooms Domain (`@features/rooms/api`)
Migrated functions:
- `roomService` (`getAll`, `getById`, `getOverview`, `create`, `update`, `delete`, etc.)
- `allocationService` (`allocate`, `end`, `shift`, `getAllActive`, `getHistory`, etc.)

### 5. Payments Domain (`@features/payments/api`)
Migrated functions:
- `paymentService` (`getAll`, `getAllDues`, `getTenantHistory`, `recordPayment`, `initiatePayment`, `verifyPayment`, `reconcilePayments`, `generateRent`, `previewGenerateRent`, `downloadReceipt`, `exportReport`, etc.)
- `rentService` (`preview`, `generate`)

### 6. Expenses Domain (`@features/expenses/api`)
Migrated functions:
- `expenseService` (`getAll`, `create`, `update`, `delete`)

### 7. Notifications Domain (`@features/notifications/api`)
Migrated functions:
- `notificationService` (`getAll`, `markAsRead`)
- `reminderService` (`sendToTenant`, `sendBulk`)

### 8. Uploads Domain (`@features/uploads/api`)
Migrated functions:
- `tenantDocumentService` (`upload`, `getAll`, `delete`)

### 9. Reports Domain (`@features/reports/api`)
Migrated functions:
- `analyticsService` (`getCashflow`, `getTenants`, `getFunnel`, `getOperations`)

### 10. Profile Domain (`@features/profile/api`)
Migrated functions:
- `profileService` (`get`, `update`, `getUnassignedTenants`)

### 11. Owners Domain (`@features/owners/api`)
Migrated functions:
- `ownerService` (`getProfile`, `updateOwner`, `updateProfileSection`, `updateHostel`, etc.)
- `bulkImportService` (`generateGoogleFormPrompt`, `uploadTenantIdentityFile`, etc.)
- `activationService` (`get`, `persistStep`)

### 12. Billing Domain (`@features/billing/api`)
Migrated functions:
- `billingService` (`getSubscription`, `getPlans`, `getUsage`, `getOverflowStatus`)
- `addonService` (`getUsage`, `purchasePack`, `getAutoTopup`, `verifyPayment`, etc.)

### 13. Auth Domain Update (`@features/auth/api`)
Migrated functions:
- `identityService` (`confirmIdentity`)

### 14. Notifications Domain Update (`@features/notifications/api`)
Migrated functions:
- `sseService` (`getToken`)

### 15. Reports Domain Update (`@features/reports/api`)
Migrated functions:
- `activityService` (`getAll`)

## Remaining Monolith Services (`services.js` - 0 lines left!)
The monolith has been successfully fully extracted. `frontend/src/api/services.js` now acts solely as an adapter/re-export file to ensure UI components don't break during the transition.

## Next Phase Target
With the service logic decoupled, we are now safe to begin decomposing the massive UI components:
- `ManageRooms.jsx`
- `ManageTenants.jsx`
- `OwnerDashboard.jsx`

## Repeated Logic Candidates for Centralization
During the extraction, the following repeated logic patterns were identified:
1. **Error Fallbacks:** The `completeMyProfile` method in `tenantService` catches `404` errors and falls back to a legacy `/profiles/complete` route. This kind of routing shim should be moved to a centralized API error interceptor or handled transparently by the backend router.
2. **Local Storage Fetching:** Several remaining methods (like `ownerService.getProfile`) manually parse `localStorage.getItem('ownerUser')` upon network failure. This should be abstracted into an `@hooks/useAuth` state rather than polluting API boundaries.
3. **FormData Marshalling:** Resolved. Repeated `new FormData()` loops across different file upload methods have been centralized into a `jsonToFormData` helper inside `@utils/format.js`.
