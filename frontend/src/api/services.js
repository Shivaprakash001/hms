import api from './axios';
import axios from 'axios';

export { authService } from '@features/auth/api';

export { profileService } from '@features/profile/api';

export { ownerService, bulkImportService, activationService } from '@features/owners/api';

// --- Billing & Plans Service ---
export { billingService, addonService } from '@features/billing/api';

// --- Tenant Services ---
export { tenantService } from '@features/tenants/api';

// --- Room Services ---
export { roomService, allocationService } from '@features/rooms/api';


export { identityService } from '@features/auth/api';

// --- Payment Services ---
export { paymentService } from '@features/payments/api';

// --- Expense Service ---
export { expenseService } from '@features/expenses/api';

// requestWithRetry moved to api-client.js

// --- Dashboard Service ---
export { dashboardService } from '@features/dashboard/api';

// --- Rent Generation Service ---
export { rentService } from '@features/payments/api';

export { portfolioService } from '@features/dashboard/api';

export { activityService } from '@features/reports/api';

// --- Notification Service ---
export { notificationService } from '@features/notifications/api';

// --- Tenant Document Service ---
export { tenantDocumentService } from '@features/uploads/api';

export { sseService } from '@features/notifications/api';

// --- Analytics Dashboard Service (dedicated endpoints, backend-next) ---
export { analyticsService } from '@features/reports/api';

// --- Reminder Service ---
export { reminderService } from '@features/notifications/api';

// --- Owner Finance Service (Phase 6) ---
//
// Read-only owner-facing settlement visibility. Maps directly to the
// /api/owner/finance/* endpoints exposed by owner-financial-view-service.
// All amounts are decimal strings on the wire to preserve precision; the
// UI parses with Number() at render time.
export const ownerFinanceService = {
    getSummary: async () => {
        const response = await api.get('/owner/finance/summary');
        return response.data;
    },
    getCollections: async (params = {}) => {
        const response = await api.get('/owner/finance/collections', { params });
        return response.data;
    },
    getTransfers: async (params = {}) => {
        const response = await api.get('/owner/finance/transfers', { params });
        return response.data;
    },
    getByHostel: async () => {
        const response = await api.get('/owner/finance/by-hostel');
        return response.data;
    },
};

// --- Admin Reconciliation Service (Phase 7) ---
//
// Admin-only. Drives /api/admin/finance/reconciliation/*. The scan is
// read-only by default; pass { persist: true } to write deduped issues.
// Issue transitions are append-only at the audit-row level: status moves
// (OPEN → INVESTIGATING/RESOLVED/IGNORED), but the diagnostic payload
// (description, fingerprint, scope, metadata) is immutable.
export const adminReconciliationService = {
    scan: async ({ limit = 500, persist = false } = {}) => {
        const response = await api.post('/admin/finance/reconciliation/scan', { limit, persist });
        return response.data;
    },
    listIssues: async (params = {}) => {
        const response = await api.get('/admin/finance/reconciliation/issues', { params });
        return response.data;
    },
    transitionIssue: async (issueId, { status, notes }) => {
        const response = await api.patch(`/admin/finance/reconciliation/issues/${issueId}`, { status, notes });
        return response.data;
    },
};
