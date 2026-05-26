export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { paymentService } from "@/src/services/payments/payment-service";
import { getLogger } from "@/lib/logger";
import { incrementWebhook } from "@/lib/metrics";
import { randomUUID } from "crypto";
import { paymentWebhookEventService } from "@/lib/services/payment-webhook-event-service";
import { paymentOperationalAnomalyService } from "@/lib/services/payment-operational-anomaly-service";
import { getClientIp } from "@/lib/security/api-guard";
import { rateLimitService } from "@/lib/services/rate-limit-service";

const logger = getLogger("webhook.phonepe");


/**
 * PhonePe Webhook (Checkout v2)
 * POST /api/webhooks/payments/phonepe
 * 
 * Events: pg.order.completed, pg.order.failed
 * Auth: Basic Auth (username:password) in Authorization header
 * 
 * This endpoint is PUBLIC (no JWT auth) — PhonePe calls it server-to-server.
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

    const authHeader = headers["authorization"] || headers["Authorization"];
    const webhookUsername = process.env.PHONEPE_WEBHOOK_USERNAME;
    const webhookPassword = process.env.PHONEPE_WEBHOOK_PASSWORD;
    const rawBody = await req.text();

    if (!rawBody || rawBody.trim().length === 0) {
      logger.info("webhook.phonepe.validation_ping_empty", { request_id: requestId });
      return new Response("Webhook verified", { status: 200 });
    }

    let signatureVerified = false;
    let signatureFailureReason: string | null = null;

    if (!webhookUsername || !webhookPassword) {
      signatureFailureReason = "PHONEPE_WEBHOOK_USERNAME/PASSWORD not configured";
    } else if (!authHeader) {
      signatureFailureReason = "missing authorization header";
    } else if (authHeader.startsWith("Basic ")) {
      const encoded = authHeader.substring(6);
      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      const [username, password] = decoded.split(":");

      signatureVerified = username === webhookUsername && password === webhookPassword;
      if (!signatureVerified) signatureFailureReason = "invalid basic auth credentials";
    } else {
      signatureFailureReason = "unsupported authorization scheme";
    }

    const eventRecord = await paymentWebhookEventService.recordReceived({
      provider: "PHONEPE",
      rawBody,
      headers,
      signatureVerified,
      signatureAlgorithm: "BASIC_AUTH",
      signatureFailureReason,
    });
    webhookEventId = eventRecord.event.id;

    if (eventRecord.duplicate && eventRecord.event.processing_status === "PROCESSED") {
      return NextResponse.json({ success: true, duplicate: true, data: eventRecord.event.processing_result }, { status: 200 });
    }

    if (!signatureVerified) {
      const abuseLimit = await rateLimitService.checkStatelessLimit({
        scope: "webhook:phonepe:auth-failed",
        identifier: requestIp,
        maxAttempts: 30,
        windowSeconds: 10 * 60,
      });
      logger.warn("webhook.phonepe.auth_invalid", {
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
        metadata: { reason: signatureFailureReason, provider: "PHONEPE" },
      });
      return new Response(abuseLimit.allowed ? "Unauthorized" : "Too Many Requests", {
        status: abuseLimit.allowed ? 401 : 429,
      });
    }

    const body = JSON.parse(rawBody);

    if (body.test || !body.payload || !body.payload.merchantOrderId) {
      logger.info("webhook.phonepe.validation_ping_non_payment", { request_id: requestId });
      return NextResponse.json({ success: true, message: "Webhook verified" }, { status: 200 });
    }

    merchantOrderId = body.payload.merchantOrderId;

    console.log(`[webhook.phonepe] Processing event ${body.event} for order ${merchantOrderId}`);
    logger.info("webhook.phonepe.event_received", {
      request_id: requestId,
      event: body.event,
      merchant_order_id: merchantOrderId,
      state: body.payload.state,
    });

    const result = await paymentService.handlePaymentWebhook("PHONEPE", headers, body, { requestId, webhookEventId: webhookEventId || undefined });

    console.log(`[webhook.phonepe] Event processed successfully for order ${merchantOrderId}`);
    logger.metrics("webhook_processed", {
      request_id: requestId,
      merchant_order_id: merchantOrderId,
      status: "success",
      duration_ms: Date.now() - startTime,
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: any) {
    statusCode = error.message?.includes("Invalid webhook payload") ? 200 : 500;
    
    console.error(`[webhook.phonepe] ERROR processing order ${merchantOrderId}:`, error);
    logger.error("webhook.phonepe.processing_failed", {
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
