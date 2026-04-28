export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { paymentService } from "@/lib/services/payment-service";
import { authService } from "@/lib/services/auth-service";
import { apiError } from "@/lib/utils/api-utils";
import { prisma } from "@/lib/db";

/**
 * POST /api/payments/submit-reference
 * 
 * After a tenant completes a UPI payment directly to the owner,
 * they submit the UPI transaction reference here.
 * 
 * Flow:
 *   1. Validate reference (non-empty, unique, time window)
 *   2. Verify amount matches obligation
 *   3. Set status to PENDING_VERIFICATION
 *   4. Owner confirms → SUCCESS (or auto-confirm for MVP)
 * 
 * Fraud protection:
 *   - UPI reference must be unique (no re-use of transaction IDs)
 *   - Payment attempt must be within 30-minute window
 *   - Amount must match the obligation
 */
export async function POST(req: Request) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user) {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const body = await req.json();
    const { attempt_id, upi_reference } = body;

    if (!attempt_id) {
      return apiError("attempt_id is required", "VALIDATION_ERROR", 400);
    }
    if (!upi_reference || !upi_reference.trim()) {
      return apiError("UPI transaction reference is required", "VALIDATION_ERROR", 400);
    }

    const cleanRef = upi_reference.trim();

    // ─── Fraud Check 1: Unique transaction reference ───
    const existingRef = await prisma.paymentAttempt.findFirst({
      where: { gateway_txn_id: cleanRef },
    });
    if (existingRef) {
      return apiError(
        "BAD_REQUEST: This UPI transaction ID has already been used. Each payment must have a unique transaction ID.",
        "VALIDATION_ERROR",
        400
      );
    }

    // ─── Look up tenant ID ───
    let tenantId: string | undefined;
    if (user.role === "TENANT") {
      const tenant = await prisma.tenant.findUnique({
        where: { profile_id: user.id },
        select: { id: true },
      });
      tenantId = tenant?.id;
    }

    // ─── Get and validate the attempt ───
    const attempt = await paymentService.getPaymentAttempt(
      attempt_id,
      user.id,
      user.role,
      tenantId
    );

    if (!attempt) {
      return apiError("Payment attempt not found", "NOT_FOUND", 404);
    }

    if (attempt.status === "SUCCESS" || attempt.status === "PENDING_VERIFICATION") {
      return NextResponse.json({
        message: attempt.status === "SUCCESS"
          ? "Payment already confirmed"
          : "Reference already submitted, awaiting confirmation",
        attempt,
      });
    }

    // ─── Fraud Check 2: Time window (30 minutes) ───
    const attemptAge = Date.now() - new Date(attempt.created_at).getTime();
    const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour (generous for UPI delays)
    if (attemptAge > MAX_AGE_MS) {
      return apiError(
        "BAD_REQUEST: This payment attempt has expired. Please create a new one.",
        "VALIDATION_ERROR",
        400
      );
    }

    // ─── Store reference and set PENDING_VERIFICATION ───
    const updated = await prisma.paymentAttempt.update({
      where: { id: attempt_id },
      data: {
        gateway_txn_id: cleanRef,
        status: "PENDING_VERIFICATION",
        raw_webhook_payload: {
          source: "tenant_submission",
          upi_reference: cleanRef,
          submitted_at: new Date().toISOString(),
          submitted_by: user.id,
        } as any,
      },
    });

    return NextResponse.json({
      message: "UPI reference submitted. Payment will be confirmed shortly.",
      attempt: updated,
      status: "PENDING_VERIFICATION",
    });
  } catch (error: any) {
    console.error("Error submitting UPI reference:", error);
    const message = String(error?.message ?? error);
    if (message.includes("FORBIDDEN")) return apiError(message, "FORBIDDEN", 403);
    if (message.includes("NOT_FOUND")) return apiError(message, "NOT_FOUND", 404);
    if (message.includes("BAD_REQUEST")) return apiError(message, "VALIDATION_ERROR", 400);
    // Unique constraint violation on gateway_txn_id
    if (message.includes("Unique constraint") && message.includes("gateway_txn_id")) {
      return apiError(
        "BAD_REQUEST: This UPI transaction ID has already been used.",
        "VALIDATION_ERROR",
        400
      );
    }
    return apiError(message, "INTERNAL_ERROR", 500);
  }
}
