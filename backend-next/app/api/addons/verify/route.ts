export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-edge";
import { prisma } from "@/lib/db";
import { PaymentProviderFactory } from "@/lib/services/payments/provider-factory";
import { paymentService } from "@/lib/services/payment-service";
import { getLogger } from "@/lib/logger";

const logger = getLogger("addons.verify");

/**
 * POST /api/addons/verify
 *
 * Verify fallback: called by the frontend after a payment redirect return
 * in case the PhonePe webhook was missed/delayed.
 *
 * Flow:
 *   1. Find the most recent PENDING addon attempt for this owner
 *   2. Query PhonePe for the transaction status
 *   3. If SUCCESS and attempt is still PENDING → call finalizePaymentAttempt
 *      (idempotency inside finalize means this is safe to call multiple times)
 *
 * Body: { attempt_id?: string }  (optional; defaults to latest PENDING)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSession(req);
    if (!user || user.role !== "OWNER") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const attemptId = body?.attempt_id as string | undefined;

    // Find the target attempt
    const attempt = await (prisma.paymentAttempt as any).findFirst({
      where: {
        owner_id:     user.sub,
        payment_type: "ADDON",
        ...(attemptId ? { id: attemptId } : { status: { in: ["PENDING", "PROCESSING"] } }),
      },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        status: true,
        merchant_txn_id: true,
        gateway_txn_id: true,
        addon_pack: true,
        provider: true,
        amount: true,
      },
    });

    if (!attempt) {
      return NextResponse.json({ verified: false, reason: "NO_PENDING_ATTEMPT" });
    }

    // Already finalized
    if (attempt.status === "SUCCESS") {
      const credits = await prisma.addonUsage.findUnique({
        where: { owner_id: user.sub },
        select: { reminders_remaining: true },
      });
      return NextResponse.json({
        verified: true,
        already_credited: true,
        attempt_id: attempt.id,
        credits_remaining: Number(credits?.reminders_remaining ?? 0),
      });
    }

    // Query the payment gateway for status
    const hostel = await prisma.hostel.findFirst({
      where: { owner_id: user.sub, is_active: true },
      select: { upi_id: true },
    });

    const config = {
      merchantId: process.env.PHONEPE_MERCHANT_ID!,
      saltKey:    process.env.PHONEPE_SALT_KEY!,
      saltIndex:  process.env.PHONEPE_SALT_INDEX!,
      environment: (process.env.PHONEPE_ENV as "SANDBOX" | "PRODUCTION") || "SANDBOX",
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/webhooks/payments/phonepe`,
      upiId: hostel?.upi_id || undefined,
    };

    const provider = PaymentProviderFactory.getProvider(attempt.provider, config);
    const statusResult = await provider.fetchStatus(attempt.merchant_txn_id, attempt.gateway_txn_id || undefined);

    logger.info("addons.verify.status_checked", {
      attempt_id: attempt.id,
      owner_id: user.sub,
      gateway_status: statusResult.status,
    });

    if (statusResult.status !== "SUCCESS") {
      return NextResponse.json({
        verified: false,
        reason: "PAYMENT_NOT_SUCCESS",
        gateway_status: statusResult.status,
        attempt_id: attempt.id,
      });
    }

    // Payment succeeded — finalize (idempotent, safe to call if webhook already ran)
    await paymentService.finalizePaymentAttempt(
      attempt.id,
      "SUCCESS",
      statusResult.gateway_txn_id || attempt.gateway_txn_id || undefined,
      null,
      { requestId: `verify_${attempt.id}` }
    );

    const credits = await prisma.addonUsage.findUnique({
      where: { owner_id: user.sub },
      select: { reminders_remaining: true },
    });

    logger.info("addons.verify.finalized", {
      attempt_id: attempt.id,
      owner_id:   user.sub,
      credits_remaining: credits?.reminders_remaining,
    });

    return NextResponse.json({
      verified:          true,
      attempt_id:        attempt.id,
      credits_remaining: Number(credits?.reminders_remaining ?? 0),
    });
  } catch (err: any) {
    logger.error("addons.verify.error", { error: err?.message });
    return NextResponse.json({ error: "INTERNAL_ERROR", message: err?.message }, { status: 500 });
  }
}
