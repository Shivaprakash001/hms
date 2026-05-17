export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/cron/reconcile-addons
 *
 * Periodic reconciliation job: compares addon_usage.reminders_remaining
 * against the immutable addon_transactions ledger.
 *
 * Detects and logs any drift caused by:
 *   - double-credits (bug in webhook handler)
 *   - missed decrements (crash mid-deduction)
 *   - manual DB edits
 *
 * Schedule: run daily (e.g., Vercel Cron: "0 3 * * *")
 * Auth: Bearer CRON_SECRET header
 */
export async function GET(_req: NextRequest) {
  return NextResponse.json(
    { ok: false, message: "Decommissioned: addon credit reconciliation removed in single-business migration" },
    { status: 410 }
  );
}
