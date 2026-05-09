export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { abandonmentService } from "@/lib/services/abandonment-service";

/**
 * 🕐 CRON — Daily Abandonment Nudge Engine
 * GET /api/cron/onboarding-nudges
 *
 * Called by Vercel Cron daily at 10:00 IST (04:30 UTC).
 * Detects stale onboarding owners and sends in-app recovery nudges.
 * Protected by CRON_SECRET bearer token.
 *
 * Vercel cron.json entry:
 *   { "path": "/api/cron/onboarding-nudges", "schedule": "30 4 * * *" }
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[CRON] CRON_SECRET not configured");
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await abandonmentService.processAbandonmentNudges();
    console.log("[CRON:ONBOARDING-NUDGES] Complete:", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    console.error("[CRON:ONBOARDING-NUDGES] Failed:", error);
    return NextResponse.json(
      { error: "Cron failed", message: error?.message },
      { status: 500 }
    );
  }
}
