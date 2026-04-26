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

    // Parse body as JSON (PhonePe v2 sends JSON directly)
    const body = await req.json();

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
