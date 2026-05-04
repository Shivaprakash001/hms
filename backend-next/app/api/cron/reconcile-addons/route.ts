export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { reconcileAddonCredits } from "@/lib/services/plan-gate-service";
import { getLogger } from "@/lib/logger";

const logger = getLogger("cron.reconcile-addons");

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
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected   = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  logger.info("reconcile_addons.start");

  try {
    // Get all owners who have ever had addon credits
    const owners = await prisma.addonUsage.findMany({
      select: { owner_id: true },
    });

    const results: {
      owner_id: string;
      mismatch: boolean;
      drift: number;
      balance: number;
      expected: number;
    }[] = [];

    let mismatchCount = 0;

    for (const { owner_id } of owners) {
      try {
        const report = await reconcileAddonCredits(owner_id);
        results.push({
          owner_id: report.owner_id,
          mismatch: report.mismatch,
          drift: report.drift,
          balance: report.balance,
          expected: report.expected,
        });

        if (report.mismatch) {
          mismatchCount++;
          logger.error("reconcile_addons.mismatch_detected", {
            owner_id,
            balance:      report.balance,
            expected:     report.expected,
            drift:        report.drift,
            ledger_added: report.ledger_added,
            consumed:     report.ledger_consumed,
          });
        }
      } catch (err: any) {
        logger.error("reconcile_addons.owner_error", { owner_id, error: err?.message });
      }
    }

    const durationMs = Date.now() - startedAt;

    logger.info("reconcile_addons.complete", {
      owners_checked: owners.length,
      mismatches: mismatchCount,
      duration_ms: durationMs,
    });

    return NextResponse.json({
      ok: true,
      owners_checked: owners.length,
      mismatches: mismatchCount,
      duration_ms: durationMs,
      // Only include mismatched owners in response (PII-safe: owner_id only)
      mismatch_details: results.filter(r => r.mismatch),
    });
  } catch (err: any) {
    logger.error("reconcile_addons.fatal", { error: err?.message });
    return NextResponse.json({ error: "INTERNAL_ERROR", message: err?.message }, { status: 500 });
  }
}
