export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

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
export async function GET(_req: NextRequest) {
  return NextResponse.json(
    { ok: false, message: "Decommissioned: owner onboarding nudges removed in single-business migration" },
    { status: 410 }
  );
}
