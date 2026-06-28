export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { apiError, apiResponse } from "@/lib/utils/api-utils";
import { prisma } from "@/lib/db";
import { normalizeHostelPolicy } from "@/lib/services/hostel-policy-service";
import { buildSettlementPlan, toObligationSnapshot } from "@/src/services/payments/settlement-planner";

/**
 * GET /api/payments/settlement-preview?tenant_id=...&amount=...&hostelId=...
 *
 * V2 Settlement Preview — read-only dry run.
 * Shows where a given amount WOULD be allocated without creating any records.
 * Consumes the central buildSettlementPlan domain service.
 *
 * No locks, no writes. Pure computation against current obligation state.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenant_id") || url.searchParams.get("tenantId") || "";
    const amountStr = url.searchParams.get("amount") || "";
    const hostelId = url.searchParams.get("hostelId") || url.searchParams.get("hostel_id") || "";

    if (!tenantId) return apiError("tenant_id is required", "VALIDATION_ERROR", 400);

    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) {
      return apiError("amount must be a positive number", "VALIDATION_ERROR", 400);
    }

    // Authorization: owner must own the tenant, or tenant must be self
    const isTenant = user.role === "TENANT";
    const isOwnerOrAdmin = ["OWNER", "ADMIN"].includes(user.role);

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { id: true, owner_id: true, hostel_id: true, profile_id: true },
    });
    if (!tenant) return apiError("Tenant not found", "NOT_FOUND", 404);

    if (isTenant && tenant.profile_id !== user.id) {
      return apiError("You can only preview your own settlements", "FORBIDDEN", 403);
    }
    if (isOwnerOrAdmin) {
      const effectiveOwnerId = user.owner_id || user.id;
      if (tenant.owner_id !== effectiveOwnerId) {
        return apiError("Tenant does not belong to you", "FORBIDDEN", 403);
      }
      if (hostelId && tenant.hostel_id !== hostelId) {
        return apiError("Tenant does not belong to this hostel", "HOSTEL_ACCESS_DENIED", 403);
      }
    }

    const effectiveHostelId = hostelId || tenant.hostel_id;
    if (!effectiveHostelId) {
      return apiError("Cannot determine hostel context", "HOSTEL_CONTEXT_REQUIRED", 400);
    }

    // Fetch all outstanding obligations
    const obligations = await prisma.rent_obligations.findMany({
      where: {
        tenant_id: tenantId,
        hostel_id: effectiveHostelId,
        status: { in: ["OVERDUE", "PENDING", "PARTIAL"] },
      },
      include: {
        payments: { select: { amount_paid: true } },
      },
    });

    // Convert to ObligationSnapshots
    const snapshots = obligations.map(ob => toObligationSnapshot(ob as any));

    // Load hostel payment policy
    const hostel = await prisma.hostels.findUnique({
      where: { id: effectiveHostelId },
      select: { preferences_config: true },
    });
    const policy = normalizeHostelPolicy(hostel);

    // Build plan using unified planner
    const plan = buildSettlementPlan(snapshots, amount, {
      allow_partial: policy.billing.partial_payments.enabled,
      minimum_amount: policy.billing.partial_payments.minimum_amount,
    });

    return apiResponse({
      tenant_id: tenantId,
      amount,
      ...plan,
    });
  } catch (error: any) {
    const msg = String(error?.message ?? error);
    if (msg.includes("NOT_FOUND")) return apiError(msg, "NOT_FOUND", 404);
    if (msg.includes("FORBIDDEN")) return apiError(msg, "FORBIDDEN", 403);
    return apiError("Internal error previewing settlement", "INTERNAL_ERROR", 500);
  }
}

