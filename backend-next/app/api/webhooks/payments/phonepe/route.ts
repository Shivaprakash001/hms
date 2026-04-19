import { NextResponse } from "next/server";
import { paymentService } from "@/lib/services/payment-service";
import { apiError } from "@/lib/utils/api-utils";

export async function POST(req: Request) {
  try {
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const body = await req.arrayBuffer();
    const result = await paymentService.handlePaymentWebhook("PHONEPE", headers, Buffer.from(body));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("PhonePe Webhook Error:", error);
    const message = String(error?.message ?? error);
    return apiError(message, "BAD_REQUEST", 400);
  }
}
