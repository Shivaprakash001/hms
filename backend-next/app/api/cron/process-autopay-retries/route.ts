import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/cron/process-autopay-retries
 * Called daily by Vercel Cron to process grace period retries (day 3, day 7).
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { ok: false, message: "Decommissioned: autopay retries removed in single-business migration" },
    { status: 410 }
  );
}
