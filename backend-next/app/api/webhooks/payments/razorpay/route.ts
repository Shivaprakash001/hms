export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { paymentService } from "@/src/services/payments/payment-service";
import { getLogger } from "@/lib/logger";
import { incrementWebhook } from "@/lib/metrics";
import { randomUUID } from "crypto";
import crypto from "crypto";
import { paymentWebhookEventService } from "@/lib/services/payment-webhook-event-service";
import { paymentOperationalAnomalyService } from "@/lib/services/payment-operational-anomaly-service";
import { getClientIp } from "@/lib/security/api-guard";
import { rateLimitService } from "@/lib/services/rate-limit-service";

const logger = getLogger("webhook.razorpay");

/**
 * Razorpay Webhook
 * POST /api/webhooks/payments/razorpay
 * 
 * This endpoint is PUBLIC (no JWT auth) — Razorpay calls it server-to-server.
 */
export async function POST(req: Request) {
  const startTime = Date.now();
  let statusCode = 200;
  let merchantOrderId = "unknown";
  const requestId = req.headers.get("x-request-id") || randomUUID();
  const requestIp = getClientIp(req) || "unknown";
  let webhookEventId: string | null = null;

  try {
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const rawBody = await req.text();

    if (!rawBody || rawBody.trim().length === 0) {
      logger.info("webhook.razorpay.validation_ping_empty", { request_id: requestId });
      return new Response("Webhook verified", { status: 200 });
    }

    // Extract signature header
    const signature = headers["x-razorpay-signature"] || headers["X-Razorpay-Signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    let signatureVerified = false;
    let signatureFailureReason: string | null = null;

    if (!webhookSecret) {
      signatureFailureReason = "RAZORPAY_WEBHOOK_SECRET not configured";
    } else if (!signature) {
      signatureFailureReason = "missing x-razorpay-signature header";
    } else {
      try {
        const shasum = crypto.createHmac("sha256", webhookSecret);
        shasum.update(rawBody);
        const digest = shasum.digest("hex");
        signatureVerified = digest === signature;
        if (!signatureVerified) {
          signatureFailureReason = "invalid signature";
        }
      } catch (e: any) {
        signatureFailureReason = `verification error: ${e.message}`;
      }
    }

    // Parse merchant transaction ID from payload to link webhook event to attempt
    let merchantTransactionId: string | null = null;
    let body: any = null;
    try {
      body = JSON.parse(rawBody);
      const pl = body?.payload || {};
      merchantTransactionId = pl.order?.entity?.receipt || 
                              pl.payment?.entity?.notes?.merchant_txn_id || 
                              pl.payment?.entity?.notes?.merchant_transaction_id || 
                              body?.notes?.merchant_txn_id ||
                              null;
      if (merchantTransactionId) {
        merchantOrderId = merchantTransactionId;
      }
    } catch (e) {
      // Non-JSON or parsing error - will be logged below
    }

    const eventRecord = await paymentWebhookEventService.recordReceived({
      provider: "RAZORPAY",
      rawBody,
      headers,
      signatureVerified,
      signatureAlgorithm: "HMAC_SHA256",
      signatureFailureReason,
      merchantTransactionId,
    });
    webhookEventId = eventRecord.event.id;

    if (eventRecord.duplicate && eventRecord.event.processing_status === "PROCESSED") {
      return NextResponse.json({ success: true, duplicate: true, data: eventRecord.event.processing_result }, { status: 200 });
    }

    if (!signatureVerified) {
      const abuseLimit = await rateLimitService.checkStatelessLimit({
        scope: "webhook:razorpay:auth-failed",
        identifier: requestIp,
        maxAttempts: 30,
        windowSeconds: 10 * 60,
      });
      logger.warn("webhook.razorpay.auth_invalid", {
        request_id: requestId,
        ip: requestIp,
        reason: signatureFailureReason,
        rate_limited: !abuseLimit.allowed,
      });
      if (webhookEventId) {
        await paymentWebhookEventService.markFailed(webhookEventId, signatureFailureReason || "signature verification failed", "FAILED");
      }
      await paymentOperationalAnomalyService.create({
        anomalyType: "WEBHOOK_SIGNATURE_FAILED",
        severity: "HIGH",
        webhookEventId: webhookEventId || null,
        metadata: { reason: signatureFailureReason, provider: "RAZORPAY" },
      });
      return new Response(abuseLimit.allowed ? "Unauthorized" : "Too Many Requests", {
        status: abuseLimit.allowed ? 401 : 429,
      });
    }

    // Ignore non-payment / non-order events (e.g. account setup events)
    if (!body || (!body.event?.startsWith("payment.") && !body.event?.startsWith("order."))) {
      logger.info("webhook.razorpay.validation_ping_non_payment", { request_id: requestId, event: body?.event });
      return NextResponse.json({ success: true, message: "Webhook verified (non-payment event)" }, { status: 200 });
    }

    if (!merchantOrderId || merchantOrderId === "unknown") {
      logger.warn("webhook.razorpay.missing_merchant_txn_id", { request_id: requestId, event: body.event });
      if (webhookEventId) {
        await paymentWebhookEventService.markFailed(webhookEventId, "Missing merchant_txn_id in webhook payload", "FAILED");
      }
      return NextResponse.json({ success: false, error: "Missing merchant_txn_id" }, { status: 400 });
    }

    console.log(`[webhook.razorpay] Processing event ${body.event} for order ${merchantOrderId}`);
    logger.info("webhook.razorpay.event_received", {
      request_id: requestId,
      event: body.event,
      merchant_order_id: merchantOrderId,
    });

    const result = await paymentService.handlePaymentWebhook("RAZORPAY", headers, body, { requestId, webhookEventId: webhookEventId || undefined });

    console.log(`[webhook.razorpay] Event processed successfully for order ${merchantOrderId}`);
    logger.metrics("webhook_processed", {
      request_id: requestId,
      merchant_order_id: merchantOrderId,
      status: "success",
      duration_ms: Date.now() - startTime,
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: any) {
    statusCode = error.message?.includes("Invalid webhook payload") ? 200 : 500;
    
    console.error(`[webhook.razorpay] ERROR processing order ${merchantOrderId}:`, error);
    logger.error("webhook.razorpay.processing_failed", {
      request_id: requestId,
      merchant_order_id: merchantOrderId,
      status_code: statusCode,
      duration_ms: Date.now() - startTime,
      error: error.message,
    });

    incrementWebhook(false);
    if (webhookEventId) {
      await paymentWebhookEventService.markFailed(webhookEventId, error.message || String(error)).catch(() => {});
    }

    logger.metrics("webhook_processed", {
      request_id: requestId,
      merchant_order_id: merchantOrderId,
      status: "error",
      duration_ms: Date.now() - startTime,
    });

    if (error.message && error.message.includes("Invalid webhook payload")) {
       return NextResponse.json({ success: true, status: "validation_ping_ignored" }, { status: 200 });
    }

    return Response.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return new Response(null, {
    status: 405,
    headers: { Allow: "POST" },
  });
}
