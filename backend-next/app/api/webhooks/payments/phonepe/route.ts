export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { paymentService } from "@/lib/services/payment-service";
import { getLogger } from "@/lib/logger";
import { incrementWebhook } from "@/lib/metrics";
import { randomUUID } from "crypto";

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

  try {
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const authHeader = headers["authorization"] || headers["Authorization"];
    const webhookUsername = process.env.PHONEPE_WEBHOOK_USERNAME;
    const webhookPassword = process.env.PHONEPE_WEBHOOK_PASSWORD;

    if (webhookUsername && webhookPassword && authHeader && authHeader.startsWith("Basic ")) {
      const encoded = authHeader.substring(6);
      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      const [username, password] = decoded.split(":");

      if (username !== webhookUsername || password !== webhookPassword) {
        logger.warn("webhook.phonepe.auth_invalid", {
          request_id: requestId,
          ip: req.headers.get("x-forwarded-for") || "unknown",
        });
        return new Response("Unauthorized", { status: 401 });
      }
    }

    const rawBody = await req.text();

    if (!rawBody || rawBody.trim().length === 0) {
      logger.info("webhook.phonepe.validation_ping_empty", { request_id: requestId });
      return new Response("Webhook verified", { status: 200 });
    }

    const body = JSON.parse(rawBody);

    if (body.test || !body.payload || !body.payload.merchantOrderId) {
      logger.info("webhook.phonepe.validation_ping_non_payment", { request_id: requestId });
      return NextResponse.json({ success: true, message: "Webhook verified" }, { status: 200 });
    }

    merchantOrderId = body.payload.merchantOrderId;

    logger.info("webhook.phonepe.event_received", {
      request_id: requestId,
      event: body.event,
      merchant_order_id: merchantOrderId,
      state: body.payload.state,
    });

    const result = await paymentService.handlePaymentWebhook("PHONEPE", headers, body, { requestId });

    logger.metrics("webhook_processed", {
      request_id: requestId,
      merchant_order_id: merchantOrderId,
      status: "success",
      duration_ms: Date.now() - startTime,
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: any) {
    statusCode = error.message?.includes("Invalid webhook payload") ? 200 : 500;
    
    logger.error("webhook.phonepe.processing_failed", {
      request_id: requestId,
      merchant_order_id: merchantOrderId,
      status_code: statusCode,
      duration_ms: Date.now() - startTime,
      error: error.message,
    });

    incrementWebhook(false);

    logger.metrics("webhook_processed", {
      request_id: requestId,
      merchant_order_id: merchantOrderId,
      status: "error",
      duration_ms: Date.now() - startTime,
    });

    if (error.message && error.message.includes("Invalid webhook payload")) {
       return NextResponse.json({ success: true, status: "validation_ping_ignored" }, { status: 200 });
    }

    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}


export async function GET() {
  return NextResponse.json(
    { success: true, message: "PhonePe webhook endpoint is active and listening for POST requests." },
    { status: 200 }
  );
}