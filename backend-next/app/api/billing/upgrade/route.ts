export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";
import { PaymentProviderFactory } from "@/lib/services/payments/provider-factory";
import { eventLog } from "@/lib/services/event-log-service";
import crypto from "crypto";

const logger = getLogger("billing.upgrade");

/**
 * 💳 Plan Upgrade Payment Flow
 * POST /api/billing/upgrade
 * 
 * Creates invoice + payment attempt, returns checkout URL.
 * 
 * Safety:
 * - Validates plan exists and is active
 * - Creates PENDING invoice with plan_id, amount_paise
 * - Creates payment attempt with invoice_id (XOR: no obligation_id)
 * - Returns PhonePe checkout URL for user to complete payment
 * - Webhook will activate subscription on SUCCESS
 */
export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const session = await getSession(req);
  if (!session || session.role !== "OWNER") {
    return apiError("Only owners can upgrade plans", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json();
    const { plan_id } = body;

    if (!plan_id) {
      return apiError("plan_id is required", "VALIDATION_ERROR", 400);
    }

    // 1. Validate plan exists and is active
    const plan = await prisma.plan.findUnique({
      where: { id: plan_id },
        select: { id: true, name: true, price_inr: true }
      });

      if (!plan) {
        return apiError("Plan not found or inactive", "NOT_FOUND", 404);
      }

      // 2. Check if owner already has this plan active
      const currentSub = await prisma.ownerSubscription.findUnique({
        where: { owner_id: session.sub },
        include: { plan: { select: { id: true } } }
      });

      if (currentSub && currentSub.plan_id === plan_id && currentSub.status === "ACTIVE") {
        return apiError(
          `You already have an active ${plan.name} subscription`,
          "ALREADY_EXISTS",
          409
        );
      }

    // 3. Get owner profile for payment metadata
    const owner = await prisma.profile.findUnique({
      where: { id: session.sub },
      select: { id: true, name: true, email: true, phone: true }
    });

    if (!owner) {
      return apiError("Session expired. Please log in again.", "UNAUTHORIZED", 401);
    }

    // 4. Validate payment provider config BEFORE creating any DB records
    // (prevents orphaned PENDING invoices when UPI is missing)
    const hostel = await prisma.hostel.findFirst({
      where: { owner_id: session.sub },
      select: { id: true, name: true, upi_id: true }
    });

    if (!hostel?.upi_id) {
      return apiError(
        "Payment configuration missing. Please set your UPI ID in hostel settings.",
        "CONFIG_ERROR",
        400
      );
    }

    // 5. Create invoice (PENDING)
    // price_inr stores the value in PAISE (same unit as old price_paise column).
    // amount_paise = price_inr directly — do NOT multiply by 100.
    const invoiceNumber = `INV-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 7);
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 30);

    const invoice = await prisma.ownerInvoice.create({
      data: {
        owner_id: session.sub,
        plan_id: plan.id,
        invoice_number: invoiceNumber,
        amount_paise: plan.price_inr,
        status: "PENDING",
        billing_month: now,
        due_date: dueDate,
        expires_at: expiresAt
      }
    });

    const provider = "PHONEPE";
    const config = {
      owner_upi_id: hostel.upi_id,
      owner_name: hostel.name || owner.name,
      hostel_id: hostel.id
    };

    // 6. Create payment attempt (invoice_id, NO obligation_id, NO tenant_id)
    // Billing attempts have no associated tenant — tenant_id is nullable for this case.
    // price_inr is in paise; divide by 100 to get rupees for the amount column.
    const merchantTxnId = `hms_billing_${invoice.id.replace(/-/g, "").substring(0, 12)}_${crypto.randomBytes(4).toString("hex")}`;
    const amountRupees = plan.price_inr / 100;

    const attempt = await prisma.paymentAttempt.create({
      data: {
        invoice_id: invoice.id,
        tenant_id: null,
        owner_id: session.sub,
        provider: provider,
        merchant_txn_id: merchantTxnId,
        amount: amountRupees,
        status: "CREATED"
      }
    });

    // 7. Create PhonePe payment intent
    const providerInstance = PaymentProviderFactory.getProvider(provider, config);

    try {
      const result = await providerInstance.createIntent({
        amount: amountRupees,
        merchant_txn_id: merchantTxnId,
        tenant_name: owner.name,
        tenant_email: owner.email,
        tenant_phone: owner.phone || "",
        metadata: {
          invoice_id: invoice.id,
          plan_id: plan.id,
          plan_name: plan.name,
          attempt_id: attempt.id
        }
      });

      // 8. Update attempt with checkout URL
      const updatedAttempt = await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "PENDING",
          gateway_txn_id: result.gateway_txn_id,
          checkout_url: result.checkout_url,
          upi_intent_url: result.upi_intent_url,
          qr_payload: result.qr_payload,
          expires_at: result.expires_at,
          raw_create_response: result.raw_response as any
        }
      });

      // Audit log: plan upgrade initiated
      await eventLog.log("PLAN_UPGRADE_INITIATED", session.sub, {
        plan_id: plan.id,
        
        plan_name: plan.name,
        invoice_id: invoice.id,
        invoice_number: invoiceNumber,
        amount_paise: (plan.price_inr || 0) * 100,
        payment_attempt_id: updatedAttempt.id
      });

      return apiResponse({
        invoice_id: invoice.id,
        invoice_number: invoiceNumber,
        plan: {
          id: plan.id,
          
          name: plan.name,
          price: amountRupees
        },
        payment: {
          attempt_id: updatedAttempt.id,
          checkout_url: updatedAttempt.checkout_url,
          upi_intent_url: updatedAttempt.upi_intent_url,
          qr_payload: updatedAttempt.qr_payload,
          expires_at: updatedAttempt.expires_at,
          merchant_txn_id: merchantTxnId
        }
      }, 201);

    } catch (error: any) {
      // Payment provider failed — mark attempt FAILED
      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: "FAILED", raw_create_response: { error: String(error) } as any }
      });

      logger.error("billing.upgrade.intent_failed", {
        request_id: requestId,
        owner_id: session.sub,
        plan_id: plan.id,
        invoice_id: invoice.id,
        attempt_id: attempt.id,
        error: String(error),
      });
      return apiError(
        "Failed to create payment intent. Please try again.",
        "PAYMENT_PROVIDER_ERROR",
        500
      );
    }

  } catch (error: any) {
    logger.error("billing.upgrade.failed", {
      request_id: requestId,
      error: String(error),
    });
    return apiError(error.message || "Failed to initiate upgrade", "INTERNAL_ERROR", 500);
  }
}
