export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@/lib/services/payment-service";

export async function GET(req: NextRequest) {
  try {
    // Vercel Cron Security: Ensure the request comes from Vercel
    const authHeader = req.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    console.info("[cron.reconcile-payments] Starting reconciliation sweep...");

    // Reconcile pending attempts from the last 24 hours
    const result = await paymentService.reconcilePendingAttempts();

    console.info("[cron.reconcile-payments] Finished successfully.", result);

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: any) {
    console.error("[cron.reconcile-payments] Failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
