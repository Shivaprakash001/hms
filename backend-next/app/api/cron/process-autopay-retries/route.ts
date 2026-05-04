import { NextRequest, NextResponse } from "next/server";
import { autopayService } from "@/lib/services/autopay-service";

/**
 * POST /api/cron/process-autopay-retries
 * Called daily by Vercel Cron to process grace period retries (day 3, day 7).
 */
export async function POST(req: NextRequest) {
  // Verify cron secret
  const cronSecret = req.headers.get("authorization");
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET || "test"}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await autopayService.processGracePeriodRetries();
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (err: any) {
    console.error("[CRON] Autopay retry error:", err?.message);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
