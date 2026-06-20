export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { paymentService } from "@/src/services/payments/payment-service";
import { authService } from "@/lib/services/auth-service";
import { verifyIdentityToken } from "@/lib/auth-edge";
import { apiError, apiResponse } from "@/lib/utils/api-utils";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";

const IDENTITY_PURPOSE     = "OFFLINE_PAYMENT";
const IDENTITY_ACTION      = "record_offline_payment";
const ANOMALY_DAILY_LIMIT  = 20; // soft-warn if owner records more than this per day

const logger = getLogger("payments.record-offline");

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX       = 5;

/**
 * POST /api/payments/record-offline
 *
 * Step 2 of secure offline payment flow.
 * Records a manual (cash / bank transfer / UPI) payment against a rent obligation.
 *
 * Security guarantees (in order of enforcement):
 *  1. Session JWT required (middleware)
 *  2. Identity token required — MUST carry purpose="OFFLINE_PAYMENT" signed with JWT_SECRET
 *  3. Identity token userId MUST match session user (token cannot be passed between owners)
 *  4. DB-based rate limit — max 5 recordings per 10 s per owner
 *  5. Ownership check — obligation.owner_id must equal session user (cross-owner blocked)
 *  6. Idempotency — obligation already PAID → return without creating a duplicate
 *  7. Atomic lock via _applyPaymentInTx FOR UPDATE on obligation row
 *  8. Full audit trail written atomically with the payment record
 */
export async function POST(req: Request) {
  try {
    // ── 1. Session auth ────────────────────────────────────────────────────────
    const user = await authService.getCurrentUser(req);
    if (!user) {
      console.warn("[payments.record-offline] Unauthorized access attempt");
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }
    
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      console.warn(`[payments.record-offline] Forbidden access attempt by ${user.role} ${user.id}`);
      return apiError("Only owners can record offline payments", "FORBIDDEN", 403);
    }

    const body = await req.json().catch(() => ({}));
    const { identity_token, obligation_id, tenant_id, amount_paid, payment_method, reference_number, payment_date, note } = body;
    const hostelId = body.hostelId || body.hostel_id;
    
    console.log(`[payments.record-offline] Recording payment for owner ${user.id}, hostel ${hostelId}`, body);

    if (!hostelId) {
      console.warn("[payments.record-offline] Missing hostelId context");
      return apiError("hostelId is required", "HOSTEL_CONTEXT_REQUIRED", 400);
    }

    // ── 2 + 3. Identity token verification ────────────────────────────────────
    if (!identity_token || typeof identity_token !== "string") {
      console.warn(`[payments.record-offline] Identity token missing for owner ${user.id}`);
      return apiError(
        "Identity verification required. Please confirm your password first.",
        "IDENTITY_REQUIRED",
        403
      );
    }

    const identity = await verifyIdentityToken(identity_token, IDENTITY_PURPOSE, IDENTITY_ACTION);
    if (!identity) {
      console.warn(`[payments.record-offline] Identity token invalid/expired for owner ${user.id}`);
      return apiError(
        "Identity token is invalid or expired. Please re-confirm your password.",
        "IDENTITY_EXPIRED",
        403
      );
    }

    // Token userId MUST match the authenticated session — prevent token hand-off between owners
    if (identity.userId !== user.id) {
      logger.warn("payments.record_offline.token_mismatch", {
        token_user: identity.userId,
        session_user: user.id,
      });
      return apiError("Forbidden: identity mismatch", "FORBIDDEN", 403);
    }

    // ── 4. Rate limit ─────────────────────────────────────────────────────────
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recent = await prisma.actionLog.count({
      where: { owner_id: user.id, action: "OFFLINE_PAYMENT", created_at: { gte: windowStart } },
    });
    
    if (recent >= RATE_LIMIT_MAX) {
      logger.warn("payments.record_offline.rate_limited", { owner_id: user.id });
      return apiError("Too many payment recordings. Please wait a moment.", "RATE_LIMIT", 429);
    }
    await prisma.actionLog.create({
      data: { id: randomUUID(), owner_id: user.id, action: "OFFLINE_PAYMENT" },
    });

    // ── Input validation ───────────────────────────────────────────────────────
    if ((!obligation_id || typeof obligation_id !== "string") && (!tenant_id || typeof tenant_id !== "string")) {
      return apiError("obligation_id or tenant_id is required", "VALIDATION_ERROR", 400);
    }
    const parsedAmount = Number(amount_paid);
    if (!parsedAmount || parsedAmount <= 0) {
      return apiError("amount_paid must be a positive number", "VALIDATION_ERROR", 400);
    }
    const validMethods = ["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "OTHER"];
    const method = String(payment_method || "CASH").toUpperCase();
    if (!validMethods.includes(method)) {
      return apiError(`payment_method must be one of: ${validMethods.join(", ")}`, "VALIDATION_ERROR", 400);
    }

    // ── 5. Ownership check ─────────────────────────────────────────────────────
    if (tenant_id && !obligation_id) {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenant_id },
        select: { owner_id: true, hostel_id: true },
      });
      if (!tenant) return apiError("Tenant not found", "NOT_FOUND", 404);
      if (tenant.owner_id !== user.owner_id && tenant.owner_id !== user.id) {
        return apiError("You can only record payments for your own tenants", "FORBIDDEN", 403);
      }
      if (tenant.hostel_id !== hostelId) {
        return apiError("Tenant does not belong to requested hostel", "HOSTEL_ACCESS_DENIED", 403);
      }
    }

    const obligation = await prisma.rent_obligations.findUnique({
      where: { id: obligation_id || "00000000-0000-0000-0000-000000000000" },
      select: { owner_id: true, hostel_id: true, status: true },
    });
    
    if (obligation_id && !obligation) return apiError("Obligation not found", "NOT_FOUND", 404);
    if (obligation_id && obligation?.owner_id !== user.owner_id && obligation?.owner_id !== user.id) {
      logger.warn("payments.record_offline.cross_owner", {
        session_owner: user.owner_id ?? user.id,
        obligation_owner: obligation?.owner_id,
        obligation_id,
      });
      return apiError("You can only record payments for your own tenants", "FORBIDDEN", 403);
    }
    if (obligation_id && obligation?.hostel_id !== hostelId) {
      return apiError("Obligation does not belong to requested hostel", "HOSTEL_ACCESS_DENIED", 403);
    }

    // ── 6. Idempotency — already fully paid ───────────────────────────────────
    if (obligation_id && obligation?.status === "PAID") {
      return apiResponse({
        success: true,
        message: "Obligation is already fully paid.",
        idempotent: true,
      });
    }

    // ── Extract client IP for audit trail ─────────────────────────────────────
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;

    logger.info("payments.record_offline.start", {
      obligation_id,
      amount: parsedAmount,
      method,
      owner_id: user.id,
      ip: clientIp,
    });

    // ── Anomaly detection (soft guard — logs + warns, does not block) ─────────
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const todayCount = await prisma.actionLog.count({
      where: { owner_id: user.id, action: "OFFLINE_PAYMENT", created_at: { gte: dayStart } },
    });
    
    if (todayCount >= ANOMALY_DAILY_LIMIT) {
      logger.warn("payments.record_offline.anomaly", {
        owner_id: user.id,
        today_count: todayCount,
        threshold: ANOMALY_DAILY_LIMIT,
        obligation_id,
        amount: parsedAmount,
      });
    }

    // ── 7 + 8. Atomic: consume identity token + write payment in ONE transaction ─
    const parsedDate = payment_date ? new Date(payment_date) : undefined;

    const result = tenant_id && !obligation_id
      ? await paymentService.recordTenantRentPaymentWithToken(identity.jti, {
          hostelId,
          tenantId: tenant_id,
          amountPaid: parsedAmount,
          paymentMethod: method,
          referenceNumber: reference_number || undefined,
          paymentDate: parsedDate,
          userId: user.id,
          ownerId: user.owner_id || user.id,
          offlineRecordedBy: user.id,
          offlineRecordedAt: new Date(),
          offlineRecordedIp: clientIp ?? undefined,
          offlineNote: note || undefined,
          idempotencyKey: body.idempotency_key || undefined,
        })
      : await paymentService.recordOfflinePaymentWithToken(identity.jti, {
          hostelId,
          obligationId: obligation_id,
          amountPaid: parsedAmount,
          paymentMethod: method,
          referenceNumber: reference_number || undefined,
          paymentDate: parsedDate,
          userId: user.id,
          ownerId: user.owner_id || user.id,
          offlineRecordedBy: user.id,
          offlineRecordedAt: new Date(),
          offlineRecordedIp: clientIp ?? undefined,
          offlineNote: note || undefined,
        });

    logger.info("payments.record_offline.success", {
      obligation_id,
      payment_id: (result as any).payment?.id || null,
      amount: parsedAmount,
      method,
      new_status: (result as any).newStatus || (result as any).overallStatus,
    });

    console.log(`[payments.record-offline] Payment recorded successfully for obligation ${obligation_id}`);
    return apiResponse({
      success: true,
      message: "Payment recorded successfully.",
      payment: (result as any).payment || null,
      obligation_status: (result as any).newStatus || (result as any).overallStatus,
      payment_group_id: (result as any).groupId || null,
      allocations: (result as any).allocations || undefined,
      future_credit: (result as any).futureCredit || 0,
      settlement_breakdown: (result as any).settlementBreakdown || null,
    });
  } catch (error: any) {
    console.error("Detailed API Error [payments.record-offline]:", error);
    logger.error("payments.record_offline.failed", { error: error.message });
    const msg = String(error?.message ?? error);
    
    if (msg.includes("NOT_FOUND"))      return apiError(msg, "NOT_FOUND", 404);
    if (msg.includes("BAD_REQUEST"))    return apiError(msg, "BAD_REQUEST", 400);
    if (msg.includes("FORBIDDEN"))      return apiError(msg, "FORBIDDEN", 403);
    if (msg.includes("UNAUTHORIZED"))   return apiError(msg, "UNAUTHORIZED", 401);
    
    return Response.json(
      {
        success: false,
        error: "Internal Server Error"
      },
      { status: 500 }
    );
  }
}
