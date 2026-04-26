export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { paymentService } from "@/lib/services/payment-service";


/**
 * 🔔 PhonePe Webhook (Checkout v2)
 * POST /api/webhooks/payments/phonepe
 * 
 * Events: pg.order.completed, pg.order.failed
 * Auth: SHA256(username:password) in Authorization header
 * 
 * This endpoint is PUBLIC (no JWT auth) — PhonePe calls it server-to-server.
 */
export async function POST(req: Request) {
  try {
    // Collect all headers
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const authHeader = headers["authorization"] || headers["Authorization"];
    const webhookUsername = process.env.PHONEPE_WEBHOOK_USERNAME;
    const webhookPassword = process.env.PHONEPE_WEBHOOK_PASSWORD;

    // 1. PhonePe Basic Auth Validation (happens before checking body)
    if (webhookUsername && webhookPassword && authHeader && authHeader.startsWith("Basic ")) {
      const encoded = authHeader.substring(6);
      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      const [username, password] = decoded.split(":");

      // Return 401 if credentials don't match (PhonePe will see "Unauthorized")
      if (username !== webhookUsername || password !== webhookPassword) {
        console.warn("[webhook.phonepe] Invalid Basic Auth credentials");
        return new Response("Unauthorized", { status: 401 });
      }
    }

    // 2. Read raw body text first
    const rawBody = await req.text();

    // 3. Handle PhonePe dashboard validation ping (empty or very short body)
    if (!rawBody || rawBody.trim().length === 0) {
      console.info("[webhook.phonepe] Received empty validation ping from PhonePe");
      return new Response("Webhook verified", { status: 200 });
    }

    // 4. Parse JSON for actual payment events
    const body = JSON.parse(rawBody);

    console.info("[webhook.phonepe] received event:", {
      event: body.event,
      merchantOrderId: body.payload?.merchantOrderId,
      state: body.payload?.state,
    });

    const result = await paymentService.handlePaymentWebhook("PHONEPE", headers, body);

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: any) {
    console.error("[webhook.phonepe] Error:", error);
    const message = String(error?.message ?? error);
    // Always return 200 to acknowledge receipt — prevents PhonePe from retrying
    // Errors are logged server-side for debugging
    return NextResponse.json(
      { success: false, error: message },
      { status: 200 }
    );
  }
}


/**
 * Handle browser GET requests gracefully.
 */
export async function GET() {
  return NextResponse.json(
    { success: true, message: "PhonePe webhook endpoint is active and listening for POST requests." },
    { status: 200 }
  );
}
