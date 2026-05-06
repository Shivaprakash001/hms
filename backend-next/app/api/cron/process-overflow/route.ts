export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { overflowBillingService } from "@/lib/services/overflow-billing-service";

/**
 * 🕐 CRON — Monthly Overflow Billing
 * GET /api/cron/process-overflow
 *
 * Runs on the 2nd of every month (day after rent generation).
 * Protected by CRON_SECRET bearer token.
 * Idempotent: safe to call multiple times for the same billing month.
 *
 * Calculates and invoices overflow tenants for all eligible ACTIVE owners
 * on overflow-enabled plans (STARTER/GROWTH).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[CRON:overflow] CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const billingMonth = searchParams.get("month") ?? undefined;

  try {
    const summary = await overflowBillingService.processAllOwners(billingMonth);

    console.log("[CRON:overflow] Monthly overflow processing complete:", {
      billing_month: billingMonth ?? "current",
      processed: summary.processed,
      invoiced: summary.invoiced,
      zero: summary.zero,
      skipped: summary.skipped,
      errors: summary.errors,
      total_overflow_paise: summary.total_overflow_paise,
    });

    return NextResponse.json({
      success: true,
      billing_month: billingMonth ?? "current",
      ...summary,
    });
  } catch (error: any) {
    console.error("[CRON:overflow] Processing failed:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Overflow billing processing failed",
    }, { status: 500 });
  }
}
