export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { apiError, apiResponse } from "@/lib/utils/api-utils";
import { prisma } from "@/lib/db";
import { requireHostelBelongsToOwner } from "@/lib/security/scoped-query";

/**
 * GET /api/payments/settlement-preview?tenant_id=...&amount=...&hostelId=...
 *
 * V2 Settlement Preview — read-only dry run.
 * Shows where a given amount WOULD be allocated without creating any records.
 * Used by both Owner (RecordPaymentModal) and Tenant (custom payment) UIs.
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

    // Fetch all outstanding obligations — same priority order as settlement engine
    const obligations = await prisma.rent_obligations.findMany({
      where: {
        tenant_id: tenantId,
        hostel_id: effectiveHostelId,
        status: { in: ["OVERDUE", "PENDING", "PARTIAL"] },
      },
      include: {
        payments: { select: { amount_paid: true } },
      },
      orderBy: [
        { due_date: "asc" },
        { rent_month: "asc" },
      ],
    });

    // V2 priority sort: Security Deposit → Maintenance → Rent → Extra Charges
    const OBLIGATION_PRIORITY: Record<string, number> = {
      SECURITY_DEPOSIT: 1,
      MAINTENANCE: 2,
      RENT: 3,
      EXTRA_CHARGE: 4,
    };
    obligations.sort((a: any, b: any) => {
      const priorityA = OBLIGATION_PRIORITY[a.obligation_type] ?? 5;
      const priorityB = OBLIGATION_PRIORITY[b.obligation_type] ?? 5;
      if (priorityA !== priorityB) return priorityA - priorityB;
      const dateDiff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(a.rent_month).getTime() - new Date(b.rent_month).getTime();
    });

    const amountPaisa = Math.round(amount * 100);
    let remainingPaisa = amountPaisa;
    const allocations: Array<{
      obligation_id: string;
      type: string;
      label: string;
      rent_month: Date | null;
      amount_due: number;
      outstanding: number;
      allocated: number;
      result: string;
    }> = [];

    const typeLabels: Record<string, string> = {
      RENT: "Rent",
      MAINTENANCE: "Maintenance",
      SECURITY_DEPOSIT: "Security Deposit",
      EXTRA_CHARGE: "Extra Charge",
    };

    for (const ob of obligations) {
      const paidPaisa = (ob as any).payments.reduce(
        (s: number, p: any) => s + Math.round(Number(p.amount_paid) * 100), 0
      );
      const duePaisa = Math.round(Number(ob.amount) * 100);
      const outstandingPaisa = Math.max(duePaisa - paidPaisa, 0);

      if (outstandingPaisa <= 0) continue;

      const allocPaisa = Math.min(remainingPaisa, outstandingPaisa);
      const newStatus = (paidPaisa + allocPaisa) >= duePaisa ? "PAID" : "PARTIAL";

      const monthLabel = ob.rent_month
        ? new Date(ob.rent_month).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
        : "";
      const typeLabel = typeLabels[(ob as any).obligation_type] || (ob as any).obligation_type;
      const label = monthLabel ? `${monthLabel} ${typeLabel}` : typeLabel;

      allocations.push({
        obligation_id: ob.id,
        type: (ob as any).obligation_type,
        label,
        rent_month: ob.rent_month,
        amount_due: duePaisa / 100,
        outstanding: outstandingPaisa / 100,
        allocated: allocPaisa / 100,
        result: allocPaisa > 0 ? newStatus : "UNCHANGED",
      });

      remainingPaisa -= allocPaisa;
      if (remainingPaisa <= 0) break;
    }

    const futureCredit = remainingPaisa > 0 ? remainingPaisa / 100 : 0;
    const totalOutstanding = obligations.reduce((sum, ob) => {
      const paidPaisa = (ob as any).payments.reduce(
        (s: number, p: any) => s + Math.round(Number(p.amount_paid) * 100), 0
      );
      return sum + Math.max(Math.round(Number(ob.amount) * 100) - paidPaisa, 0);
    }, 0) / 100;
    const totalSettled = (amountPaisa - remainingPaisa) / 100;

    return apiResponse({
      tenant_id: tenantId,
      amount,
      allocations,
      future_credit: futureCredit,
      total_outstanding: totalOutstanding,
      total_to_settle: totalSettled,
      remaining_outstanding: Math.max(totalOutstanding - totalSettled, 0),
      summary: futureCredit > 0
        ? `₹${amount.toLocaleString("en-IN")} → ${allocations.filter(a => a.allocated > 0).length} obligation(s) settled, ₹${futureCredit.toLocaleString("en-IN")} as future rent credit`
        : `₹${amount.toLocaleString("en-IN")} → ${allocations.filter(a => a.allocated > 0).length} obligation(s) settled`,
    });
  } catch (error: any) {
    const msg = String(error?.message ?? error);
    if (msg.includes("NOT_FOUND")) return apiError(msg, "NOT_FOUND", 404);
    if (msg.includes("FORBIDDEN")) return apiError(msg, "FORBIDDEN", 403);
    return apiError("Internal error previewing settlement", "INTERNAL_ERROR", 500);
  }
}
